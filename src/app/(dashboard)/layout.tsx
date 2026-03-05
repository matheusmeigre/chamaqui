import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { DashboardLayoutInner } from "./dashboard-layout-inner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/api/auth/signin");
  }

  const unreadNotificationsCount = await prisma.notification.count({
    where: {
      userId: session.user.id,
      read: false
    }
  });

  return (
    <DashboardLayoutInner 
      user={{ name: session.user.name, role: session.user.role }} 
      unreadCount={unreadNotificationsCount}
    >
      {children}
    </DashboardLayoutInner>
  );
}
