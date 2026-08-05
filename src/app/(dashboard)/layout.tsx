import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { DashboardLayoutInner } from "./dashboard-layout-inner";
import { getUnreadNotificationsCount } from "@/server/services/notification-service";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentUser();

  if (!session) {
    redirect("/login");
  }

  const unreadNotificationsCount = await getUnreadNotificationsCount(session.id);

  return (
    <DashboardLayoutInner 
      user={{ name: session.name, role: session.role }} 
      unreadCount={unreadNotificationsCount}
    >
      {children}
    </DashboardLayoutInner>
  );
}
