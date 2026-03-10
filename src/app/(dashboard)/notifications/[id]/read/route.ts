import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { markNotificationAsRead } from "@/server/services/notification-service";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function PATCH(_: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const updated = await markNotificationAsRead(id, session.user.id);
  if (!updated) {
    return NextResponse.json({ error: "Notificacao nao encontrada" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
