import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashActivationCode } from "@/lib/auth/tokens";
import {
  isLoginBlocked,
  registerFailedLogin,
  THROTTLE_BUCKETS,
  tryGetClientHash,
} from "@/lib/auth-throttle";

// GET /api/auth/activate-info?code=XXXX-XXXX
// Resolve a organização associada a um código de ativação (login e fluxo QR).
// Não revela o código em si; apenas dados de apresentação — e só para quem já
// tem um código válido. Consultas com código inexistente contam para o limite
// de tentativas, senão a rota serviria para varrer códigos.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code") ?? "";
  if (!code || code.length > 64) {
    return NextResponse.json({ error: "CODE_MISSING" }, { status: 400 });
  }

  const clientHash = tryGetClientHash(Object.fromEntries(request.headers.entries()));
  if (clientHash && (await isLoginBlocked(THROTTLE_BUCKETS.activation, clientHash))) {
    return NextResponse.json({ error: "LOGIN_BLOCKED" }, { status: 429 });
  }

  const codeHash = hashActivationCode(code);
  const activationCode = await prisma.activationCode.findUnique({
    where: { codeHash },
    include: { organization: { select: { id: true, name: true, enabled: true } } },
  });

  if (!activationCode || !activationCode.organization.enabled) {
    if (!activationCode && clientHash) {
      const blockedUntil = await registerFailedLogin(THROTTLE_BUCKETS.activation, clientHash);
      if (blockedUntil) {
        return NextResponse.json({ error: "LOGIN_BLOCKED" }, { status: 429 });
      }
    }
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
