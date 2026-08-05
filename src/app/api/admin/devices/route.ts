import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, isAdminSession } from "@/lib/auth/session";

// GET /api/admin/devices — lista dispositivos da organização do admin
export async function GET() {
  const isAdmin = await isAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
  }

  const currentUser = await getCurrentUser();
  const organizationId = currentUser?.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: "Organizacao invalida" }, { status: 400 });
  }

  const devices = await prisma.device.findMany({
    where: { organizationId },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ devices });
}
