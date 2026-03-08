import prisma from "@/lib/prisma";

type RecentNotificationsParams = {
  userId: string;
  take: number;
};

export async function getRecentNotifications({ userId, take }: RecentNotificationsParams) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      title: true,
      message: true,
      link: true,
      read: true,
      isRead: true,
      createdAt: true,
    },
  });
}

export async function markNotificationRead(id: string, userId: string) {
  const notification = await prisma.notification.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });

  if (!notification || notification.userId !== userId) {
    return null;
  }

  return prisma.notification.update({
    where: { id },
    data: {
      read: true,
      isRead: true,
      readAt: new Date(),
    },
  });
}

export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({
    where: {
      userId,
      OR: [{ isRead: false }, { read: false }],
    },
    data: {
      read: true,
      isRead: true,
      readAt: new Date(),
    },
  });
}

export async function countUnreadNotifications(userId: string) {
  return prisma.notification.count({
    where: {
      userId,
      OR: [{ isRead: false }, { read: false }],
    },
  });
}
