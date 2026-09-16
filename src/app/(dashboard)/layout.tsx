import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
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

  const [unreadNotificationsCount, organization] = await Promise.all([
    getUnreadNotificationsCount(session.id),
    session.organizationId
      ? prisma.organization.findUnique({
          where: { id: session.organizationId },
          select: { name: true },
        })
      : Promise.resolve(null),
  ]);

  return (
    <AppShell
      user={{
        name: session.name,
        role: session.role,
        organizationName: organization?.name ?? null,
      }}
      unreadCount={unreadNotificationsCount}
    >
      {children}
    </AppShell>
  );
}
