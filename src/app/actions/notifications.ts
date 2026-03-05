"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function markNotificationAsRead(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Não autorizado");

  const notification = await prisma.notification.findUnique({ where: { id } });
  if (notification?.userId === session.user.id) {
    await prisma.notification.update({
      where: { id },
      data: { read: true }
    });
  }

  revalidatePath("/notifications");
}

export async function markAllNotificationsAsRead() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Não autorizado");

  await prisma.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true }
  });

  revalidatePath("/notifications");
}