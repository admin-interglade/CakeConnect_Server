import { prisma } from "../../prisma/index.js";
import { NotFoundError, ForbiddenError } from "../../common/AppError.js";

export async function getShopOwnerDashboard(data: {
  userId: string;
  shopIds: string[];
  start: Date;
  end: Date;
}) {
  const shopId = data.shopIds[0];
  if (!shopId) {
    throw new NotFoundError("No shop assigned to this user");
  }

  const orders = await prisma.order.findMany({
    where: {
      shopId,
      createdAt: { gte: data.start, lte: data.end },
      status: { notIn: ["DRAFT", "CANCELLED"] },
    },
    include: { items: true },
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayOrders = await prisma.order.findMany({
    where: {
      shopId,
      status: { notIn: ["DRAFT", "CANCELLED"] },
      createdAt: { gte: todayStart },
    },
    include: { items: true },
  });

  const invoices = await prisma.invoice.findMany({
    where: { shopId, status: { notIn: ["CANCELLED"] } },
  });
  const payments = await prisma.payment.findMany({
    where: { shopId, paymentStatus: "SUCCESS" },
  });

  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) {
    throw new NotFoundError("Shop not found");
  }
  const ledger = await prisma.ledgerEntry.findFirst({
    where: { shopId },
    orderBy: { createdAt: "desc" },
  });

  const currentOutstanding = ledger?.runningBalance.toNumber() ?? shop.currentOutstanding.toNumber();

  const totalOrderedValue = orders.reduce(
    (sum, o) => sum + Number(o.totalAmount),
    0,
  );
  const totalDeliveredQuantity = orders
    .filter((o) => ["DELIVERED", "INVOICED"].includes(o.status))
    .reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0);
  const amountPaid = payments.reduce((s, p) => s + Number(p.amount), 0);

  const productSalesMap = new Map<string, { name: string; quantity: number; value: number }>();
  for (const order of orders) {
    for (const item of order.items) {
      const entry = productSalesMap.get(item.productId);
      if (entry) {
        entry.quantity += item.quantity;
        entry.value += Number(item.totalAmount);
      } else {
        productSalesMap.set(item.productId, {
          name: item.productName,
          quantity: item.quantity,
          value: Number(item.totalAmount),
        });
      }
    }
  }
  const topProducts = Array.from(productSalesMap.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  const currentOrderStatus = await prisma.order.findFirst({
    where: { shopId, status: { notIn: ["DRAFT", "CANCELLED", "INVOICED"] } },
    orderBy: { createdAt: "desc" },
    select: { status: true },
  });

  const orderStatuses = await prisma.order.findMany({
    where: { shopId, status: { notIn: ["DRAFT", "CANCELLED"] } },
    select: { status: true, totalAmount: true },
  });

  const statusBreakdown = orderStatuses.reduce<Record<string, number>>(
    (acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1;
      return acc;
    },
    {},
  );

  return {
    shop: {
      id: shop.id,
      shopCode: shop.shopCode,
      shopName: shop.shopName,
      creditLimit: Number(shop.creditLimit),
    },
    totalOrderedValue,
    orderCount: orders.length,
    todayOrderCount: todayOrders.length,
    quantityDelivered: totalDeliveredQuantity,
    amountPaid,
    currentOutstanding,
    availableCredit: Number(shop.creditLimit) - currentOutstanding,
    currentOrderStatus: currentOrderStatus?.status ?? "NONE",
    statusBreakdown,
    topProducts,
  };
}

export async function getAdminDashboard(data: { start: Date; end: Date }) {
  const shops = await prisma.shop.findMany({
    select: {
      status: true,
      currentOutstanding: true,
      creditLimit: true,
      shopCode: true,
      shopName: true,
    },
  });

  const totalShops = shops.length;
  const activeShops = shops.filter((s) => s.status === "ACTIVE").length;
  const suspendedShops = shops.filter((s) => s.status === "SUSPENDED").length;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const ordersToday = await prisma.order.count({
    where: { createdAt: { gte: todayStart }, status: { notIn: ["DRAFT", "CANCELLED"] } },
  });

  const ordersPending = await prisma.order.count({
    where: { status: "SUBMITTED" },
  });

  const ordersInRange = await prisma.order.findMany({
    where: {
      createdAt: { gte: data.start, lte: data.end },
      status: { notIn: ["DRAFT", "CANCELLED"] },
    },
    select: { totalAmount: true },
  });
  const todayOrderValue = ordersInRange
    .filter((o) => o !== ordersInRange[0] || true)
    .reduce((s, o) => s + Number(o.totalAmount), 0);

  const todayOrders = await prisma.order.findMany({
    where: {
      createdAt: { gte: todayStart },
      status: { notIn: ["DRAFT", "CANCELLED"] },
    },
    select: { totalAmount: true },
  });
  const todayOrderValueActual = todayOrders.reduce((s, o) => s + Number(o.totalAmount), 0);

  const paymentsToday = await prisma.payment.aggregate({
    where: {
      createdAt: { gte: todayStart },
      paymentStatus: "SUCCESS",
    },
    _sum: { amount: true },
  });

  const totalOutstanding = shops.reduce(
    (sum, s) => sum + Number(s.currentOutstanding),
    0,
  );

  const productionRequirement = await prisma.productionPlan.findMany({
    where: { productionDate: { gte: data.start, lte: data.end }, status: { notIn: ["COMPLETED"] } },
    include: { items: true },
  });

  const rawProduction = new Map<string, number>();
  for (const plan of productionRequirement) {
    for (const item of plan.items) {
      rawProduction.set(
        item.productId,
        (rawProduction.get(item.productId) ?? 0) + item.requiredQuantity,
      );
    }
  }
  const consolidatedProduction = Array.from(rawProduction.entries()).map(
    ([productId, requiredQuantity]) => ({ productId, requiredQuantity }),
  );
  const productNames = await prisma.product.findMany({
    where: { id: { in: Array.from(rawProduction.keys()) } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(productNames.map((p) => [p.id, p.name]));

  const shopWiseOutstanding = shops.map((s) => ({
    shopCode: s.shopCode,
    shopName: s.shopName,
    currentOutstanding: Number(s.currentOutstanding),
    availableCredit: Number(s.creditLimit) - Number(s.currentOutstanding),
  }));

  const ageing = await prisma.invoice.findMany({
    where: { status: { in: ["ISSUED", "PARTIALLY_PAID", "OVERDUE"] } },
    include: { shop: { select: { shopCode: true, shopName: true } } },
  });
  const ageingReport = ageing.map((inv) => ({
    invoiceNumber: inv.invoiceNumber,
    shop: inv.shop.shopName,
    totalAmount: Number(inv.totalAmount),
    outstandingAmount: Number(inv.outstandingAmount),
    daysOverdue: Math.max(
      0,
      Math.floor((Date.now() - inv.dueDate.getTime()) / (24 * 60 * 60 * 1000)),
    ),
  }));

  return {
    totalShops,
    activeShops,
    suspendedShops,
    ordersToday,
    ordersPendingBeforeCutoff: ordersPending,
    todayOrderValue,
    todayOrderValueActual,
    collectionsToday: paymentsToday._sum.amount?.toNumber() ?? 0,
    totalNetworkOutstanding: totalOutstanding,
    consolidatedProduction: consolidatedProduction.map((item) => ({
      productId: item.productId,
      productName: nameMap.get(item.productId) ?? "",
      requiredQuantity: item.requiredQuantity,
    })),
    shopWiseOutstanding,
    ageingReport,
  };
}