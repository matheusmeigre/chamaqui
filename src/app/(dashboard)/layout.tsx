import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardLayoutInner } from "./dashboard-layout-inner";
import { getUnreadNotificationsCount } from "@/server/services/notification-service";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/api/auth/signin");
  }

  const unreadNotificationsCount = await getUnreadNotificationsCount(session.user.id);

  return (
    <DashboardLayoutInner 
      user={{ name: session.user.name, role: session.user.role }} 
      unreadCount={unreadNotificationsCount}
    >
      {children}
    </DashboardLayoutInner>
  );
}
