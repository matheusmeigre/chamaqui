import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardMetrics } from "@/server/services/dashboard-service";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const metrics = await getDashboardMetrics();
  return NextResponse.json(metrics);
}
