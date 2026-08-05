import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser, isAdminSession } from "@/lib/auth/session";
import { getDeviceSignalsFromRequest } from "@/lib/auth/request";
import {
  generateActivationCode,
  hashActivationCode,
} from "@/lib/auth/tokens";
import { ACTIVATION_CODE_TTL_SECONDS } from "@/lib/auth/config";
import { writeAuditLog } from "@/lib/auth/auth";

// GET /api/admin/activation-codes — lista códigos da organização do admin
export async function GET() {
  const isAdmin = await isAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
  }

  const currentUser = await getCurrentUser();

  const codes = await prisma.activationCode.findMany({
    where: { organizationId: currentUser?.organizationId ?? "" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ codes });
}

// POST /api/admin/activation-codes — gera um novo código curto para a organização
export async function POST(request: NextRequest) {
  const isAdmin = await isAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
  }

  const currentUser = await getCurrentUser();
  const organizationId = currentUser?.organizationId;
  if (!organizationId) {
    return NextResponse.json({ error: "Organizacao invalida" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const role = body?.role === "ADMINISTRADOR" || body?.role === "ATENDENTE" ? body.role : "SOLICITANTE";
  const ttl = Number.isInteger(body?.ttlDays) && body.ttlDays > 0 && body.ttlDays <= 30
    ? body.ttlDays * 24 * 60 * 60
    : ACTIVATION_CODE_TTL_SECONDS;

  const plainCode = generateActivationCode();
  const codeHash = hashActivationCode(plainCode);

  const code = await prisma.activationCode.create({
    data: {
      codeHash,
      role,
      expiresAt: new Date(Date.now() + ttl * 1000),
      organizationId,
      createdById: currentUser.id,
    },
  });

  const signals = getDeviceSignalsFromRequest(request);
  await writeAuditLog({
    action: "CODE_GENERATED",
    organizationId,
    userId: currentUser.id,
    deviceId: currentUser.deviceId,
    signals,
  });

  return NextResponse.json({
    code: {
      id: code.id,
      plainCode, // exibido apenas uma vez para gerar o QR / compartilhar
      role: code.role,
      expiresAt: code.expiresAt,
    },
  });
}
