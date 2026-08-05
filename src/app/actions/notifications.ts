"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import {
  markAllNotificationsAsRead as markAllNotificationsReadService,
  markNotificationAsRead as markNotificationReadService,
} from "@/server/services/notification-service";

export async function markNotificationAsRead(id: string) {
  const session = await getCurrentUser();
  if (!session) throw new Error("Não autorizado");

  await markNotificationReadService(id, session.id);

  revalidatePath("/notifications");
}

export async function markAllNotificationsAsRead() {
  const session = await getCurrentUser();
  if (!session) throw new Error("Não autorizado");

  await markAllNotificationsReadService(session.id);

  revalidatePath("/notifications");
}