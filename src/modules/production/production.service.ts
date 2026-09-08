import { prisma } from "../../prisma/index.js";
import { NotFoundError, ConflictError, AppError } from "../../common/AppError.js";

export async function listPlans(query: { page: number; limit: number }) {
  const [total, plans] = await prisma.$transaction([
    prisma.productionPlan.count(),
    prisma.productionPlan.findMany({
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { productionDate: "desc" },
      include: {
        items: { include: { product: true } },
      },
    }),
  ]);
  return { total, plans };
}

/** Orders that count towards a day's production, keyed by product. */
async function aggregateOrdersFor(dateOnly: Date) {
  const orders = await prisma.order.findMany({
    where: {
      deliveryDate: dateOnly,
      status: { notIn: ["DRAFT", "CANCELLED", "NO_ORDER_PLACED"] },
    },
    select: { shopId: true, items: true },
  });

  const byProduct = new Map<
    string,
    { requiredQuantity: number; productName: string; shopIds: Set<string> }
  >();

  for (const order of orders) {
    for (const item of order.items) {
      const current = byProduct.get(item.productId);
      if (current) {
        current.requiredQuantity += item.quantity;
        current.shopIds.add(order.shopId);
      } else {
        byProduct.set(item.productId, {
          requiredQuantity: item.quantity,
          productName: item.productName,
          shopIds: new Set([order.shopId]),
        });
      }
    }
  }

  return byProduct;
}

/**
 * The consolidated requirement for a date that has no saved plan yet.
 *
 * A plan row is only written by `generatePlan`, which is a deliberate act after
 * the cut-off. Before that the kitchen still needs to see what is accumulating,
 * so the read computes the same aggregate live and marks it `generated: false`.
 * Returning 404 here left the admin dashboard's production card permanently
 * blank, since nothing generated the plan in the first place.
 */
async function buildProvisionalPlan(dateOnly: Date) {
  const byProduct = await aggregateOrdersFor(dateOnly);

  const products = await prisma.product.findMany({
    where: { id: { in: Array.from(byProduct.keys()) } },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const items = Array.from(byProduct.entries())
    .map(([productId, entry]) => ({
      // No row exists yet, so there is no item id to hand out.
      id: null,
      productionPlanId: null,
      productId,
      requiredQuantity: entry.requiredQuantity,
      producedQuantity: 0,
      shopCount: entry.shopIds.size,
      // Falls back to the name snapshotted on the order line if the product
      // itself has since been removed.
      product:
        productMap.get(productId) ??
        { name: entry.productName, unit: "", description: null },
    }))
    .sort((a, b) => b.requiredQuantity - a.requiredQuantity);

  return {
    id: null,
    productionDate: dateOnly,
    status: "PROVISIONAL" as const,
    generated: false,
    createdAt: null,
    updatedAt: null,
    items,
  };
}

export async function getPlanByDate(date: Date) {
  const dateOnly = new Date(date.toISOString().split("T")[0] + "T00:00:00.000Z");
  const plan = await prisma.productionPlan.findUnique({
    where: { productionDate: dateOnly },
    include: {
      items: { include: { product: true } },
    },
  });

  if (!plan) {
    return buildProvisionalPlan(dateOnly);
  }

  // The saved plan aggregates across shops without recording how many
  // contributed, so the per-line shop count is recovered from the orders.
  const byProduct = await aggregateOrdersFor(dateOnly);

  return {
    ...plan,
    generated: true,
    items: plan.items
      .map((item) => ({
        ...item,
        shopCount: byProduct.get(item.productId)?.shopIds.size ?? 0,
      }))
      .sort((a, b) => b.requiredQuantity - a.requiredQuantity),
  };
}

export async function getPlanById(id: string) {
  const plan = await prisma.productionPlan.findUnique({
    where: { id },
    include: {
      items: { include: { product: true } },
    },
  });
  if (!plan) {
    throw new NotFoundError("Production plan not found");
  }
  return plan;
}

export async function generatePlan(productionDate: Date) {
  const dateOnly = new Date(productionDate.toISOString().split("T")[0] + "T00:00:00.000Z");

  const existing = await prisma.productionPlan.findUnique({
    where: { productionDate: dateOnly },
  });
  if (existing) {
    throw new ConflictError("Production plan already exists for this date");
  }

  const productQuantities = await aggregateOrdersFor(dateOnly);

  const plan = await prisma.productionPlan.create({
    data: {
      productionDate: dateOnly,
      status: "DRAFT",
      items: {
        create: Array.from(productQuantities.entries()).map(
          ([productId, { requiredQuantity }]) => ({
            productId,
            requiredQuantity,
            producedQuantity: 0,
          }),
        ),
      },
    },
    include: { items: { include: { product: true } } },
  });

  return { ...plan, generated: true };
}

export async function updatePlan(
  id: string,
  data: {
    status?: string;
    items?: Array<{
      productId?: string;
      itemId?: string;
      requiredQuantity?: number;
      producedQuantity?: number;
    }>;
  },
) {
  const plan = await prisma.productionPlan.findUnique({ where: { id } });
  if (!plan) {
    throw new NotFoundError("Production plan not found");
  }

  await prisma.$transaction(async (tx) => {
    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        if (item.itemId) {
          await tx.productionPlanItem.update({
            where: { id: item.itemId },
            data: {
              ...(item.requiredQuantity !== undefined
                ? { requiredQuantity: item.requiredQuantity }
                : {}),
              ...(item.producedQuantity !== undefined
                ? { producedQuantity: item.producedQuantity }
                : {}),
            },
          });
        } else if (item.productId) {
          await tx.productionPlanItem.updateMany({
            where: { productionPlanId: id, productId: item.productId },
            data: {
              ...(item.requiredQuantity !== undefined
                ? { requiredQuantity: item.requiredQuantity }
                : {}),
              ...(item.producedQuantity !== undefined
                ? { producedQuantity: item.producedQuantity }
                : {}),
            },
          });
        }
      }
    }
    if (data.status) {
      await tx.productionPlan.update({
        where: { id },
        data: { status: data.status as never },
      });
    }
  });

  return getPlanById(id);
}