import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashActivationCode } from "@/lib/auth/tokens";

// GET /api/auth/activate-info?code=XXXX-XXXX
// Resolve a organização associada a um código de ativação (fluxo QR).
// Não revela o código em si; apenas dados de apresentação.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code") ?? "";
  if (!code) {
    return NextResponse.json({ error: "CODE_MISSING" }, { status: 400 });
  }

  const codeHash = hashActivationCode(code);
  const activationCode = await prisma.activationCode.findUnique({
    where: { codeHash },
    include: { organization: { select: { id: true, name: true, enabled: true } } },
  });

  if (!activationCode || !activationCode.organization.enabled) {
    return NextResponse.json({ error: "CODE_INVALID" }, { status: 404 });
  }

  return NextResponse.json({
    organizationId: activationCode.organizationId,
    organizationName: activationCode.organization.name,
    role: activationCode.role,
    used: Boolean(activationCode.usedAt),
    expired: activationCode.expiresAt < new Date(),
  });
}
