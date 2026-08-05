import {
  countUnreadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/server/repositories/notification-repository";

export async function markNotificationAsRead(id: string, userId: string) {
  return markNotificationRead(id, userId);
}

export async function markAllNotificationsAsRead(userId: string) {
  return markAllNotificationsRead(userId);
}

export async function getUnreadNotificationsCount(userId: string) {
  return countUnreadNotifications(userId);
}
