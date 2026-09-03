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

export async function getPlanByDate(date: Date) {
  const dateOnly = new Date(date.toISOString().split("T")[0] + "T00:00:00.000Z");
  const plan = await prisma.productionPlan.findUnique({
    where: { productionDate: dateOnly },
    include: {
      items: { include: { product: true } },
    },
  });
  if (!plan) {
    throw new NotFoundError("No production plan found for this date");
  }
  return plan;
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

  const orders = await prisma.order.findMany({
    where: {
      deliveryDate: dateOnly,
      status: { notIn: ["DRAFT", "CANCELLED", "NO_ORDER_PLACED"] },
    },
    include: { items: true },
  });

  const productQuantities = new Map<
    string,
    { requiredQuantity: number; productName: string }
  >();

  for (const order of orders) {
    for (const item of order.items) {
      const current = productQuantities.get(item.productId);
      const productName = current?.productName ?? item.productName;
      if (current) {
        current.requiredQuantity += item.quantity;
      } else {
        productQuantities.set(item.productId, {
          requiredQuantity: item.quantity,
          productName,
        });
      }
    }
  }

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

  return plan;
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