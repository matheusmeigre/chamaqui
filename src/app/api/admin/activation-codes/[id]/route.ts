import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, isAdminSession } from "@/lib/auth/session";
import { getDeviceSignalsFromRequest } from "@/lib/auth/request";
import { writeAuditLog } from "@/lib/auth/auth";

// DELETE /api/admin/activation-codes/[id] — revoga (deleta) um código não utilizado
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const isAdmin = await isAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
  }

  const currentUser = await getCurrentUser();
  const organizationId = currentUser?.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: "Organizacao invalida" }, { status: 400 });
  }

  const { id } = await params;

  const existing = await prisma.activationCode.findFirst({
    where: { id, organizationId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Codigo nao encontrado" }, { status: 404 });
  }
  if (existing.usedAt) {
    return NextResponse.json({ error: "Codigo ja utilizado" }, { status: 409 });
  }

  await prisma.activationCode.delete({ where: { id } });

  const signals = getDeviceSignalsFromRequest(request);
  await writeAuditLog({
    action: "CODE_DELETED",
    organizationId,
    userId: currentUser.id,
    deviceId: currentUser.deviceId,
    signals,
  });

  return NextResponse.json({ ok: true });
}
