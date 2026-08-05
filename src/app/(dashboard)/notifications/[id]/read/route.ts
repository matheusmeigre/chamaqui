import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { markNotificationAsRead } from "@/server/services/notification-service";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function PATCH(_: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const session = await getCurrentUser();
  if (!session) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const updated = await markNotificationAsRead(id, session.id);
  if (!updated) {
    return NextResponse.json({ error: "Notificacao nao encontrada" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
