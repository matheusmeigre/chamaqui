import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, isAdminSession } from "@/lib/auth/session";
import { getDeviceSignalsFromRequest } from "@/lib/auth/request";
import { revokeDevice, writeAuditLog } from "@/lib/auth/auth";

type RouteParams = {
  params: Promise<{ id: string }>;
};

// POST /api/admin/devices/[id]/revoke — revoga um dispositivo da organização
export async function POST(_: NextRequest, { params }: RouteParams) {
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

  const device = await prisma.device.findFirst({
    where: { id, organizationId },
    include: { user: { select: { id: true } } },
  });
  if (!device) {
    return NextResponse.json({ error: "Dispositivo nao encontrado" }, { status: 404 });
  }

  const result = await revokeDevice(id);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  const signals = getDeviceSignalsFromRequest(_);
  await writeAuditLog({
    action: "DEVICE_REVOKED",
    organizationId,
    userId: currentUser.id,
    deviceId: device.id,
    signals,
  });

  return NextResponse.json({ success: true });
}
