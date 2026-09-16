import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardMetrics } from "@/server/services/dashboard-service";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  // Mesmo recorte da dashboard: solicitante não enxerga a contagem global.
  const metrics = await getDashboardMetrics({
    userId: session.id,
    role: session.role,
    organizationId: session.role === "SOLICITANTE" ? session.organizationId : null,
  });
  return NextResponse.json(metrics);
}
