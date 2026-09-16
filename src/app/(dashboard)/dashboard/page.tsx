import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardAnalytics, parsePeriod } from "@/server/services/analytics-service";
import { getDashboardActivity } from "@/server/services/dashboard-service";
import { getQuotaSnapshot } from "@/server/services/quota-service";
import { DashboardView } from "./dashboard-view";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; org?: string }>;
}) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  const params = await searchParams;
  const isAdmin = session.role === "ADMINISTRADOR";
  const days = parsePeriod(params.period);

  const organizations = isAdmin
    ? await prisma.organization.findMany({
        where: { enabled: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : null;

  // Administrador escolhe o recorte; "todas" é um recorte legítimo para ele.
  const organizationId = isAdmin
    ? (organizations?.find((org) => org.id === params.org)?.id ?? null)
    : session.organizationId;

  const [analytics, activity, quota] = await Promise.all([
    getDashboardAnalytics({
      userId: session.id,
      role: session.role,
      organizationId,
      days,
    }),
    getDashboardActivity({ userId: session.id, role: session.role, organizationId }),
    organizationId ? getQuotaSnapshot(organizationId) : Promise.resolve(null),
  ]);

  return (
    <DashboardView
      userName={session.name}
      days={days}
      isAdmin={isAdmin}
      organizations={organizations}
      organizationId={organizationId}
      analytics={analytics}
      activity={activity}
      quota={quota}
    />
  );
}
