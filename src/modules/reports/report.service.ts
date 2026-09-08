import { prisma } from "../../prisma/index.js";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { ForbiddenError } from "../../common/AppError.js";

function toCSV(headers: string[], rows: unknown[][]) {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(","), ...rows.map((r) => r.map(esc).join(","))];
  return lines.join("\n");
}

/** A year of daily points is already past what any chart can render. */
const MAX_TREND_POINTS = 366;

/** `YYYY-MM-DD` in server-local time, matching the cut-off helpers. */
function toDayKey(date: Date) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function startOfLocalDay(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function endOfLocalDay(date: Date) {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

export async function salesReport(data: {
  from: Date;
  to: Date;
  shopId?: string;
  userRole: string;
  shopIds: string[];
}) {
  const where = {
    createdAt: { gte: data.from, lte: data.to },
    status: { notIn: [OrderStatus.DRAFT, OrderStatus.CANCELLED] },
    ...(data.userRole === "SHOP_OWNER" ? { shopId: { in: data.shopIds } } : {}),
    ...(data.shopId && data.userRole !== "SHOP_OWNER" ? { shopId: data.shopId } : {}),
  };

  const byShop = await prisma.order.groupBy({
    by: ["shopId"],
    where,
    _sum: { totalAmount: true },
    _count: true,
  });
  const shops = await prisma.shop.findMany({
    where: { id: { in: byShop.map((r) => r.shopId) } },
    select: { id: true, shopCode: true, shopName: true },
  });
  const shopMap = new Map(shops.map((s) => [s.id, s]));

  const byProduct = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: {
      order: where.status ? where : { ...where, status: where.status },
    },
    _sum: { quantity: true, totalAmount: true },
  });
  const products = await prisma.product.findMany({
    where: { id: { in: byProduct.map((r) => r.productId) } },
    select: { id: true, name: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const totalSales = byShop.reduce((s, r) => s + (r._sum?.totalAmount?.toNumber() ?? 0), 0);

  const rows = byShop.map((r) => {
    const shop = shopMap.get(r.shopId);
    return {
      shopCode: shop?.shopCode ?? r.shopId,
      shopName: shop?.shopName ?? "",
      orders: r._count,
      sales: r._sum?.totalAmount?.toNumber() ?? 0,
    };
  });

  const productRows = byProduct.map((r) => {
    const product = productMap.get(r.productId);
    return {
      productId: r.productId,
      productName: product?.name ?? "",
      quantity: r._sum?.quantity ?? 0,
      sales: r._sum?.totalAmount?.toNumber() ?? 0,
    };
  });

  return { totalSales, byShop: rows, byProduct: productRows, csv: toCSV(
    ["shopCode", "shopName", "orders", "sales"],
    rows.map((r) => [r.shopCode, r.shopName, r.orders, r.sales]),
  ) };
}

export async function outstandingReport(data: {
  userRole: string;
  shopIds: string[];
}) {
  const where = data.userRole === "SHOP_OWNER" ? { id: { in: data.shopIds } } : {};
  const shops = await prisma.shop.findMany({
    where,
    select: {
      shopCode: true,
      shopName: true,
      currentOutstanding: true,
      creditLimit: true,
    },
  });
  const rows = shops.map((s) => ({
    shopCode: s.shopCode,
    shopName: s.shopName,
    currentOutstanding: Number(s.currentOutstanding),
    creditLimit: Number(s.creditLimit),
    availableCredit: Number(s.creditLimit) - Number(s.currentOutstanding),
  }));

  const totalOutstanding = rows.reduce((s, r) => s + r.currentOutstanding, 0);

  return {
    totalOutstanding,
    rows,
    csv: toCSV(
      ["shopCode", "shopName", "currentOutstanding", "creditLimit", "availableCredit"],
      rows.map((r) => [r.shopCode, r.shopName, r.currentOutstanding, r.creditLimit, r.availableCredit]),
    ),
  };
}

export async function collectionsReport(data: {
  from: Date;
  to: Date;
  userRole: string;
  shopIds: string[];
}) {
  const where = {
    createdAt: { gte: data.from, lte: data.to },
    paymentStatus: PaymentStatus.SUCCESS,
    ...(data.userRole === "SHOP_OWNER" ? { shopId: { in: data.shopIds } } : {}),
  };

  const payments = await prisma.payment.findMany({
    where,
    include: { shop: { select: { shopCode: true, shopName: true } } },
  });

  const totalCollected = payments.reduce((s, p) => s + Number(p.amount), 0);

  const rows = payments.map((p) => ({
    paymentReference: p.paymentReference,
    shopCode: p.shop.shopCode,
    shopName: p.shop.shopName,
    amount: Number(p.amount),
    paymentMethod: p.paymentMethod,
    paymentDate: p.paymentDate,
  }));

  return {
    totalCollected,
    rows,
    csv: toCSV(
      ["paymentReference", "shopCode", "shopName", "amount", "paymentMethod", "paymentDate"],
      rows.map((r) => [r.paymentReference, r.shopCode, r.shopName, r.amount, r.paymentMethod, r.paymentDate]),
    ),
  };
}

export async function cutoffComplianceReport(data: { from: Date; to: Date }) {
  const orders = await prisma.order.findMany({
    where: {
      deliveryDate: { gte: data.from, lte: data.to },
      status: { notIn: [OrderStatus.DRAFT, OrderStatus.CANCELLED] },
    },
    include: { shop: { select: { shopCode: true, shopName: true } } },
  });

  const rows = orders.map((o) => ({
    orderNumber: o.orderNumber,
    shopCode: o.shop.shopCode,
    shopName: o.shop.shopName,
    deliveryDate: o.deliveryDate,
    submittedAt: o.submittedAt,
    onTime: o.submittedAt !== null && o.locked === false,
  }));

  const total = rows.length;
  const onTime = rows.filter((r) => r.onTime).length;

  return {
    complianceRate: total > 0 ? (onTime / total) * 100 : 0,
    total,
    onTime,
    rows,
    csv: toCSV(
      ["orderNumber", "shopCode", "shopName", "deliveryDate", "submittedAt", "onTime"],
      rows.map((r) => [r.orderNumber, r.shopCode, r.shopName, r.deliveryDate, r.submittedAt, r.onTime]),
    ),
  };
}
/**
 * FR-21 — order value and count bucketed by day.
 *
 * `salesReport` groups by shop and by product, so nothing in it can be drawn
 * as a time series. This is the missing per-day series (docs/api-gaps.md G5).
 *
 * Bucketing is done in JS rather than by `groupBy: ["createdAt"]`, which would
 * group by exact timestamp and hand back one bucket per order. Days are keyed
 * in server-local time, the same convention the cut-off helpers use.
 */
export async function orderTrendReport(data: {
  from: Date;
  to: Date;
  shopId?: string;
  userRole: string;
  shopIds: string[];
}) {
  const from = startOfLocalDay(data.from);
  // `to` arrives as a bare date, which coerces to midnight and would otherwise
  // drop everything ordered on the last day of the range.
  const to = endOfLocalDay(data.to);

  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      status: { notIn: [OrderStatus.DRAFT, OrderStatus.CANCELLED] },
      ...(data.userRole === "SHOP_OWNER" ? { shopId: { in: data.shopIds } } : {}),
      ...(data.shopId && data.userRole !== "SHOP_OWNER" ? { shopId: data.shopId } : {}),
    },
    select: { createdAt: true, totalAmount: true },
  });

  const buckets = new Map<string, { orderValue: number; orderCount: number }>();
  for (const order of orders) {
    const key = toDayKey(order.createdAt);
    const bucket = buckets.get(key) ?? { orderValue: 0, orderCount: 0 };
    bucket.orderValue += Number(order.totalAmount);
    bucket.orderCount += 1;
    buckets.set(key, bucket);
  }

  // Every day in the range is emitted, including the quiet ones: a chart that
  // skips empty days draws a flat line through a day of no trade.
  const points: Array<{ date: string; orderValue: number; orderCount: number }> = [];
  const cursor = startOfLocalDay(from);
  const last = startOfLocalDay(to);
  while (cursor.getTime() <= last.getTime() && points.length < MAX_TREND_POINTS) {
    const bucket = buckets.get(toDayKey(cursor));
    points.push({
      date: toDayKey(cursor),
      orderValue: bucket?.orderValue ?? 0,
      orderCount: bucket?.orderCount ?? 0,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const totalValue = points.reduce((sum, p) => sum + p.orderValue, 0);
  const totalOrders = points.reduce((sum, p) => sum + p.orderCount, 0);

  return {
    from: toDayKey(from),
    to: toDayKey(to),
    groupBy: "day" as const,
    totalValue,
    totalOrders,
    averageOrderValue: totalOrders > 0 ? totalValue / totalOrders : 0,
    points,
    csv: toCSV(
      ["date", "orderValue", "orderCount"],
      points.map((p) => [p.date, p.orderValue, p.orderCount]),
    ),
  };
}
