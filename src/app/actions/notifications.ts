"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  markAllNotificationsAsRead as markAllNotificationsReadService,
  markNotificationAsRead as markNotificationReadService,
} from "@/server/services/notification-service";

export async function markNotificationAsRead(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Não autorizado");

  await markNotificationReadService(id, session.user.id);

  revalidatePath("/notifications");
}

export async function markAllNotificationsAsRead() {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Não autorizado");

  await markAllNotificationsReadService(session.user.id);

  revalidatePath("/notifications");
}