import { Prisma } from "@prisma/client";
import { prisma } from "../../prisma/index.js";
import {
  NotFoundError,
  ConflictError,
  AppError,
  ForbiddenError,
} from "../../common/AppError.js";
import { generateOrderNumber } from "../../common/utils/numbers.js";
import {
  getDeliveryDateCutoffStatus,
  isValidOrderDate,
} from "../../common/utils/cutoff.js";
import { getApplicablePrice } from "../price-lists/priceList.service.js";
import { createInvoice } from "../invoices/invoice.service.js";
import type { AuthUser } from "../../common/types.js";

const TAX_RATE = 0.0; // Configure GST here e.g. 0.05 for 5% or 0.12 for 12%

interface OrderItemInput {
  productId: string;
  quantity: number;
  notes?: string;
}

interface OrderInput {
  shopId: string;
  deliveryDate: Date;
  notes?: string;
  offerId?: string;
  items: OrderItemInput[];
}

async function assertShopCanOrder(
  shopId: string,
  user: AuthUser | undefined,
) {
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) {
    throw new NotFoundError("Shop not found");
  }
  if (shop.status !== "ACTIVE") {
    throw new AppError(`Shop is ${shop.status}. Cannot place orders.`, 403);
  }

  if (user && user.role === "SHOP_OWNER" && !user.shopIds?.includes(shopId)) {
    throw new ForbiddenError("You do not have access to this shop");
  }

  return shop;
}

async function buildOrderItems(
  shopId: string,
  items: OrderItemInput[],
  offerId?: string,
) {
  const productIds = items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
  });

  const productMap = new Map(products.map((p) => [p.id, p]));

  let subtotal = 0;
  let discountAmount = 0;

  const offer = offerId
    ? await prisma.offer.findFirst({
        where: {
          id: offerId,
          status: "ACTIVE",
          startDate: { lte: new Date() },
          endDate: { gte: new Date() },
          OR: [
            { targetAllShops: true },
            { shops: { some: { shopId } } },
          ],
        },
        include: { products: true },
      })
    : null;

  if (offerId && !offer) {
    throw new AppError("Offer is not active or does not apply to this shop", 400);
  }

  const orderItems: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    tax: number;
    discount: number;
    totalAmount: number;
    notes?: string;
  }> = [];
  let flatOfferApplied = false;

  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new NotFoundError(`Product ${item.productId} not found`);
    }
    if (product.status !== "ACTIVE") {
      throw new AppError(`Product ${product.name} is not available`, 400);
    }

    if (product.minimumOrderQuantity > 0 && item.quantity < product.minimumOrderQuantity) {
      throw new AppError(
        `MOQ for ${product.name} is ${product.minimumOrderQuantity}. Requested ${item.quantity}`,
        400,
      );
    }

    const { price } = await getApplicablePrice(shopId, product.id);
    const lineSubtotal = price * item.quantity;
    const tax = lineSubtotal * TAX_RATE;
    const appliesToProduct =
      Boolean(offer) &&
      (offer!.products.length === 0 ||
        offer!.products.some((offerProduct) => offerProduct.productId === product.id));
    let lineDiscount = 0;

    if (appliesToProduct && offer!.discountType === "PERCENTAGE") {
      lineDiscount = lineSubtotal * Number(offer!.discountValue) / 100;
    } else if (
      appliesToProduct &&
      offer!.discountType === "FLAT" &&
      !flatOfferApplied
    ) {
      lineDiscount = Math.min(lineSubtotal, Number(offer!.discountValue));
      flatOfferApplied = true;
    } else if (
      appliesToProduct &&
      offer!.discountType === "BUY_X_GET_Y" &&
      offer!.buyQuantity &&
      offer!.getQuantity
    ) {
      const bundle = offer!.buyQuantity + offer!.getQuantity;
      const freeUnits = Math.floor(item.quantity / bundle) * offer!.getQuantity;
      lineDiscount = Math.min(lineSubtotal, freeUnits * price);
    }

    const lineTotal = lineSubtotal + tax - lineDiscount;

    subtotal += lineSubtotal;
    discountAmount += lineDiscount;
    orderItems.push({
      productId: product.id,
      productName: product.name,
      quantity: item.quantity,
      unitPrice: price,
      tax,
      discount: lineDiscount,
      totalAmount: lineTotal,
      notes: item.notes,
    });
  }

  const taxAmount = orderItems.reduce((sum, i) => sum + i.tax, 0);
  const totalAmount = subtotal + taxAmount - discountAmount;

  return { orderItems, subtotal, taxAmount, discountAmount, totalAmount };
}

async function checkProductAvailability(items: OrderItemInput[], deliveryDate: Date) {
  const dateOnly = new Date(deliveryDate.toISOString().split("T")[0] + "T00:00:00.000Z");
  const availability = await prisma.productAvailability.findMany({
    where: { date: dateOnly, available: false },
  });
  const unavailableProductIds = new Set(availability.map((a) => a.productId));
  const blocked = items.filter((i) => unavailableProductIds.has(i.productId));
  if (blocked.length > 0) {
    const names = await prisma.product.findMany({
      where: { id: { in: blocked.map((b) => b.productId) } },
      select: { id: true, name: true },
    });
    const namesMap = new Map(names.map((n) => [n.id, n.name]));
    throw new AppError(
      `Product(s) unavailable on ${deliveryDate.toISOString().split("T")[0]}: ${blocked
        .map((b) => namesMap.get(b.productId) ?? b.productId)
        .join(", ")}`,
      400,
    );
  }
}

export async function calculateOrderTotals(shopId: string, items: OrderItemInput[]) {
  return buildOrderItems(shopId, items);
}

export async function createDraftOrder(input: OrderInput, user: AuthUser) {
  const shop = await assertShopCanOrder(input.shopId, user);

  if (!(await isValidOrderDate(input.deliveryDate))) {
    throw new AppError("Orders can only be placed for next-day delivery", 400);
  }

  await checkProductAvailability(input.items, input.deliveryDate);

  const { orderItems, subtotal, taxAmount, discountAmount, totalAmount } =
    await buildOrderItems(input.shopId, input.items, input.offerId);

  const orderNumber = await generateOrderNumber();

  const order = await prisma.order.create({
    data: {
      orderNumber,
      shopId: input.shopId,
      deliveryDate: normalizeDate(input.deliveryDate),
      status: "DRAFT",
      subtotal: new Prisma.Decimal(subtotal),
      taxAmount: new Prisma.Decimal(taxAmount),
      discountAmount: new Prisma.Decimal(discountAmount),
      totalAmount: new Prisma.Decimal(totalAmount),
      notes: [
        input.notes,
        input.offerId ? `Offer applied: ${input.offerId}` : undefined,
      ]
        .filter(Boolean)
        .join("\n") || undefined,
      items: {
        create: orderItems.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: new Prisma.Decimal(item.unitPrice),
          tax: new Prisma.Decimal(item.tax),
          discount: new Prisma.Decimal(item.discount),
          totalAmount: new Prisma.Decimal(item.totalAmount),
          notes: item.notes,
        })),
      },
    },
    include: {
      items: true,
      shop: { select: { id: true, shopName: true, shopCode: true } },
    },
  });

  return order;
}

export async function getOrders(query: {
  page: number;
  limit: number;
  status?: string;
  shopId?: string;
  deliveryDate?: Date;
  search?: string;
  user: AuthUser;
}) {
  const where: Prisma.OrderWhereInput = {
    ...(query.status ? { status: query.status as never } : {}),
    ...(query.shopId ? { shopId: query.shopId } : {}),
    ...(query.deliveryDate
      ? { deliveryDate: normalizeDate(query.deliveryDate) }
      : {}),
    ...(query.search
      ? { orderNumber: { contains: query.search, mode: "insensitive" as const } }
      : {}),
  };

  if (query.user.role === "SHOP_OWNER") {
    where.shopId = { in: query.user.shopIds ?? [] };
  }

  const [total, orders] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { createdAt: "desc" },
      include: {
        shop: { select: { id: true, shopCode: true, shopName: true } },
        items: true,
        delivery: true,
        invoice: { select: { id: true, invoiceNumber: true, status: true } },
      },
    }),
  ]);

  return { total, orders };
}

export async function getOrderById(id: string, user: AuthUser) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
      shop: true,
      delivery: { include: { items: true } },
      invoice: { include: { items: true, payments: true } },
    },
  });
  if (!order) {
    throw new NotFoundError("Order not found");
  }
  if (user.role === "SHOP_OWNER" && !user.shopIds?.includes(order.shopId)) {
    throw new ForbiddenError("You do not have access to this order");
  }
  return order;
}

export async function updateDraftOrder(
  id: string,
  data: {
    notes?: string;
    deliveryDate?: Date;
    offerId?: string | null;
    items?: OrderItemInput[];
  },
  user: AuthUser,
) {
  const order = await getOrderById(id, user);
  if (order.status !== "DRAFT") {
    throw new AppError("Only draft orders can be edited", 400);
  }

  if (order.locked) {
    throw new AppError("Order is locked after cutoff", 403);
  }

  let orderItems: Awaited<ReturnType<typeof buildOrderItems>>["orderItems"] | undefined;
  let subtotal = Number(order.subtotal);
  let taxAmount = Number(order.taxAmount);
  let discountAmount = Number(order.discountAmount);
  let totalAmount = Number(order.totalAmount);
  let deliveryDate = order.deliveryDate;

  const offerId = data.offerId === undefined ? undefined : data.offerId ?? undefined;

  if (data.items) {
    const calc = await buildOrderItems(order.shopId, data.items, offerId);
    orderItems = calc.orderItems;
    subtotal = calc.subtotal;
    taxAmount = calc.taxAmount;
    discountAmount = calc.discountAmount;
    totalAmount = calc.totalAmount;
  }

  if (data.deliveryDate) {
    if (!(await isValidOrderDate(data.deliveryDate))) {
      throw new AppError("Orders can only be for next-day delivery", 400);
    }
    deliveryDate = normalizeDate(data.deliveryDate);
  }

  await prisma.$transaction(async (tx) => {
    if (data.items) {
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      await tx.orderItem.createMany({
        data: orderItems!.map((item) => ({
          orderId: id,
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          tax: item.tax,
          discount: item.discount,
          totalAmount: item.totalAmount,
          notes: item.notes,
        })),
      });
    }

    await tx.order.update({
      where: { id },
      data: {
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        deliveryDate,
        subtotal: new Prisma.Decimal(subtotal),
        taxAmount: new Prisma.Decimal(taxAmount),
        discountAmount: new Prisma.Decimal(discountAmount),
        totalAmount: new Prisma.Decimal(totalAmount),
      },
    });
  });

  return getOrderById(id, user);
}

export async function submitOrder(id: string, user: AuthUser) {
  const order = await getOrderById(id, user);
  if (order.status !== "DRAFT") {
    throw new AppError("Only draft orders can be submitted", 400);
  }

  if (order.locked) {
    throw new AppError("Order is locked after cutoff", 403);
  }

  const { cutOffPassed } = await getDeliveryDateCutoffStatus(
    order.shopId,
    order.deliveryDate,
  );
  if (cutOffPassed) {
    throw new AppError("Cut-off time has passed for this delivery date", 403);
  }

  return prisma.order.update({
    where: { id },
    data: { status: "SUBMITTED", submittedAt: new Date(), submittedBy: user.userId },
    include: { items: true, shop: true },
  });
}

export async function cancelOrder(id: string, user: AuthUser) {
  const order = await getOrderById(id, user);
  if (!["DRAFT", "SUBMITTED", "ACCEPTED"].includes(order.status)) {
    throw new AppError("This order can no longer be cancelled", 400);
  }

  const { cutOffPassed } = await getDeliveryDateCutoffStatus(
    order.shopId,
    order.deliveryDate,
  );
  if (order.status === "SUBMITTED" && cutOffPassed) {
    throw new AppError("Cut-off time has passed. Order cannot be cancelled.", 403);
  }

  return prisma.order.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
}

export async function deleteDraftOrder(id: string, user: AuthUser) {
  const order = await getOrderById(id, user);
  if (order.status !== "DRAFT") {
    throw new AppError("Only draft orders can be deleted", 400);
  }
  await prisma.order.delete({ where: { id } });
  return { message: "Draft deleted" };
}

export async function repeatOrder(data: {
  shopId: string;
  deliveryDate: Date;
  sourceOrderId?: string;
}, user: AuthUser) {
  let sourceOrder: Awaited<ReturnType<typeof getOrderById>>;
  if (data.sourceOrderId) {
    sourceOrder = await getOrderById(data.sourceOrderId, user);
  } else {
    const latest = await prisma.order.findFirst({
      where: { shopId: data.shopId, status: { notIn: ["DRAFT", "CANCELLED"] } },
      orderBy: { createdAt: "desc" },
      include: { items: true, shop: true, delivery: { include: { items: true } }, invoice: { include: { items: true, payments: true } } },
    });
    if (!latest) {
      throw new NotFoundError("No previous order found to repeat");
    }
    sourceOrder = latest;
  }

  if (!(await isValidOrderDate(data.deliveryDate))) {
    throw new AppError("Orders can only be for next-day delivery", 400);
  }

  const repeatItems = sourceOrder.items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    notes: item.notes ?? undefined,
  }));

  return createDraftOrder(
    { shopId: data.shopId, deliveryDate: data.deliveryDate, items: repeatItems },
    user,
  );
}

export async function repeatWeekdayOrder(data: {
  shopId: string;
  deliveryDate: Date;
}, user: AuthUser) {
  const target = new Date(data.deliveryDate);
  const targetWeekday = target.getDay();

  const lastOrder = await prisma.order.findFirst({
    where: {
      shopId: data.shopId,
      status: { notIn: ["DRAFT", "CANCELLED"] },
      deliveryDate: target,
    },
    orderBy: { deliveryDate: "desc" },
    include: {
      items: true,
      shop: true,
      delivery: { include: { items: true } },
      invoice: { include: { items: true, payments: true } },
    },
  });

  if (!lastOrder) {
    throw new NotFoundError("No previous order found for this weekday");
  }

  return createDraftOrder(
    {
      shopId: data.shopId,
      deliveryDate: data.deliveryDate,
      items: lastOrder.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        notes: item.notes ?? undefined,
      })),
    },
    user,
  );
}

export async function updateOrderStatus(
  id: string,
  status: string,
  user: AuthUser,
) {
  const order = await getOrderById(id, user);
  if (user.role !== "ADMIN") {
    throw new ForbiddenError("Only admins can update order status");
  }

  const flow = [
    "SUBMITTED",
    "ACCEPTED",
    "IN_PRODUCTION",
    "DISPATCHED",
    "DELIVERED",
    "INVOICED",
  ];
  const currentIdx = flow.indexOf(order.status);
  const nextIdx = flow.indexOf(status);

  if (nextIdx === -1) {
    throw new AppError("Invalid target status", 400);
  }

  if (currentIdx >= nextIdx) {
    throw new AppError("Cannot move order backwards in status flow", 400);
  }

  if (status === "INVOICED") {
    if (order.invoice) {
      throw new AppError("Invoice already exists for this order", 400);
    }
    if (!order.delivery) {
      throw new AppError("Cannot invoice an order before it is delivered", 400);
    }
    const result = await createInvoice({
      shopId: order.shop.id,
      orderId: id,
      dueDate: order.deliveryDate,
      basedOnDelivered: true,
      createdBy: user.userId,
    });
    return prisma.order.update({
      where: { id },
      data: { status: "INVOICED" as never },
      include: { items: true, shop: true, invoice: { include: { items: true } } },
    });
  }

  return prisma.order.update({
    where: { id },
    data: { status: status as never },
    include: { items: true, shop: true },
  });
}

function normalizeDate(d: Date): Date {
  return new Date(d.toISOString().split("T")[0] + "T00:00:00.000Z");
}