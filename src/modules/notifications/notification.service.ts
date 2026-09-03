import { prisma } from "../../prisma/index.js";
import { NotFoundError } from "../../common/AppError.js";

export async function createNotification(data: {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: unknown;
}) {
  try {
    return await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type as never,
        title: data.title,
        body: data.body,
        data: data.data ? JSON.parse(JSON.stringify(data.data)) : undefined,
      },
    });
  } catch {
    return null;
  }
}

export async function listNotifications(
  userId: string,
  query: { page: number; limit: number; type?: string; unreadOnly?: boolean },
) {
  const where = {
    userId,
    ...(query.type ? { type: query.type as never } : {}),
    ...(query.unreadOnly ? { isRead: false } : {}),
  };

  const [total, notifications] = await prisma.$transaction([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const unreadCount = await prisma.notification.count({
    where: { userId, isRead: false },
  });

  return { total, notifications, unreadCount };
}

export async function markAsRead(id: string, userId: string) {
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== userId) {
    throw new NotFoundError("Notification not found");
  }
  return prisma.notification.update({
    where: { id },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function markAllAsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return { message: "All notifications marked as read" };
}

export async function updatePreference(userId: string, data: {
  type: string;
  push?: boolean;
  sms?: boolean;
  email?: boolean;
}) {
  const existing = await prisma.notificationPreference.findUnique({
    where: { userId_type: { userId, type: data.type as never } },
  });
  if (existing) {
    return prisma.notificationPreference.update({
      where: { id: existing.id },
      data: {
        ...(data.push !== undefined ? { push: data.push } : {}),
        ...(data.sms !== undefined ? { sms: data.sms } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
      },
    });
  }
  return prisma.notificationPreference.create({
    data: {
      userId,
      type: data.type as never,
      push: data.push ?? true,
      sms: data.sms ?? false,
      email: data.email ?? false,
    },
  });
}

export async function getPreferences(userId: string) {
  return prisma.notificationPreference.findMany({ where: { userId } });
}