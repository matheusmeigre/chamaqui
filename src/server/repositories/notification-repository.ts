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
    },
  });
}

export async function markAllNotificationsRead(userId: string) {
  return prisma.notification.updateMany({
    where: {
      userId,
      read: false,
    },
    data: {
      read: true,
    },
  });
}

export async function countUnreadNotifications(userId: string) {
  return prisma.notification.count({
    where: {
      userId,
      read: false,
    },
  });
}
