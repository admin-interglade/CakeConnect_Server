import { prisma } from "../../prisma/index.js";
import { NotFoundError, ConflictError, AppError } from "../../common/AppError.js";

export async function createDelivery(data: {
  orderId: string;
  deliveryDate: Date;
  notes?: string;
}) {
  const order = await prisma.order.findUnique({
    where: { id: data.orderId },
    include: { items: true },
  });
  if (!order) {
    throw new NotFoundError("Order not found");
  }

  const existing = await prisma.delivery.findUnique({
    where: { orderId: data.orderId },
  });
  if (existing) {
    throw new ConflictError("Delivery already exists for this order");
  }

  if (!["ACCEPTED", "IN_PRODUCTION", "DISPATCHED"].includes(order.status)) {
    throw new AppError("Order must be accepted before creating a delivery", 400);
  }

  const dateOnly = new Date(data.deliveryDate.toISOString().split("T")[0] + "T00:00:00.000Z");

  const delivery = await prisma.delivery.create({
    data: {
      orderId: data.orderId,
      deliveryDate: data.deliveryDate,
      notes: data.notes,
      items: {
        create: order.items.map((item) => ({
          productId: item.productId,
          orderedQuantity: item.quantity,
          deliveredQuantity: 0,
          shortQuantity: item.quantity,
        })),
      },
    },
    include: { items: true },
  });

  return delivery;
}

export async function listDeliveries(query: {
  page: number;
  limit: number;
  status?: string;
  deliveryDate?: Date;
}) {
  const where = {
    ...(query.status ? { status: query.status as never } : {}),
    ...(query.deliveryDate
      ? { deliveryDate: new Date(query.deliveryDate.toISOString().split("T")[0] + "T00:00:00.000Z") }
      : {}),
  };

  const [total, deliveries] = await prisma.$transaction([
    prisma.delivery.count({ where }),
    prisma.delivery.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { createdAt: "desc" },
      include: {
        order: { select: { id: true, orderNumber: true, status: true, shop: { select: { id: true, shopName: true } } } },
        items: true,
      },
    }),
  ]);

  return { total, deliveries };
}

export async function getDeliveryById(id: string) {
  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: {
      order: { include: { shop: true } },
      items: { include: { product: true } },
    },
  });
  if (!delivery) {
    throw new NotFoundError("Delivery not found");
  }
  return delivery;
}

export async function markDispatched(id: string, notes?: string) {
  const delivery = await prisma.delivery.findUnique({ where: { id } });
  if (!delivery) {
    throw new NotFoundError("Delivery not found");
  }
  if (!["PENDING"].includes(delivery.status)) {
    throw new AppError("Only pending deliveries can be dispatched", 400);
  }

  await prisma.order.update({
    where: { id: delivery.orderId },
    data: { status: "DISPATCHED" },
  });

  return prisma.delivery.update({
    where: { id },
    data: {
      status: "IN_TRANSIT",
      dispatchedAt: new Date(),
      ...(notes ? { notes } : {}),
    },
    include: { items: true },
  });
}

export async function markDelivered(
  id: string,
  data: {
    receivedBy?: string;
    notes?: string;
    items: Array<{
      productId: string;
      deliveredQuantity: number;
      shortSupplyReason?: string;
    }>;
  },
) {
  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!delivery) {
    throw new NotFoundError("Delivery not found");
  }

  const deliveredMap = new Map(data.items.map((i) => [i.productId, i.deliveredQuantity]));

  const hasShortSupply = delivery.items.some(
    (item) => (deliveredMap.get(item.productId) ?? 0) < item.orderedQuantity,
  );

  const status = hasShortSupply ? "PARTIALLY_DELIVERED" : "DELIVERED";

  await prisma.$transaction(async (tx) => {
    for (const item of delivery.items) {
      const deliveredQuantity = deliveredMap.get(item.productId) ?? 0;
      const shortQuantity = Math.max(0, item.orderedQuantity - deliveredQuantity);
      const deliveryItem = data.items.find((i) => i.productId === item.productId);

      await tx.deliveryItem.update({
        where: { id: item.id },
        data: {
          deliveredQuantity,
          shortQuantity,
          shortSupplyReason: deliveryItem?.shortSupplyReason,
        },
      });
    }

    const result = await tx.delivery.update({
      where: { id },
      data: {
        status,
        deliveredAt: new Date(),
        receivedBy: data.receivedBy,
        notes: data.notes,
      },
    });

    if (status === "DELIVERED" || status === "PARTIALLY_DELIVERED") {
      await tx.order.update({
        where: { id: delivery.orderId },
        data: { status: "DELIVERED" },
      });
    }

    if (result) {
      return result;
    }
  });

  return getDeliveryById(id);
}