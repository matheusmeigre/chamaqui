import { NextRequest, NextResponse } from "next/server";
import { getDeviceSignalsFromRequest } from "@/lib/auth/request";
import { activateDeviceWithCode, writeAuditLog } from "@/lib/auth/auth";
import {
  clearFailedLogins,
  isLoginBlocked,
  registerFailedLogin,
  THROTTLE_BUCKETS,
  tryGetClientHash,
} from "@/lib/auth-throttle";

// POST /api/auth/activate
// Ativa um dispositivo usando um código curto (ou token de QR).
// Body: { code, organizationId? }
//
// A organização é descoberta pelo código — a tela de login não expõe a lista de
// clientes. Sem ela, o código é a única credencial, por isso as tentativas com
// código inexistente contam para o limite por cliente.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const organizationId = typeof body?.organizationId === "string" ? body.organizationId : null;
  const code = typeof body?.code === "string" ? body.code : "";

  if (!code || code.length > 64) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const clientHash = tryGetClientHash(Object.fromEntries(request.headers.entries()));
  if (clientHash && (await isLoginBlocked(THROTTLE_BUCKETS.activation, clientHash))) {
    return NextResponse.json({ error: "LOGIN_BLOCKED" }, { status: 429 });
  }

  const signals = getDeviceSignalsFromRequest(request);
  const result = await activateDeviceWithCode({ organizationId, code, signals });

  if (result.error) {
    // Só o código inexistente indica tentativa às cegas; usado ou expirado
    // significa que a pessoa tinha um código de verdade.
    if (result.error === "CODE_INVALID" && clientHash) {
      const blockedUntil = await registerFailedLogin(THROTTLE_BUCKETS.activation, clientHash);
      if (blockedUntil) {
        return NextResponse.json({ error: "LOGIN_BLOCKED" }, { status: 429 });
      }
    }
    const status =
      result.error === "ORGANIZATION_INVALID" ? 404 : result.error === "CODE_INVALID" ? 401 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  if (clientHash) await clearFailedLogins(THROTTLE_BUCKETS.activation, clientHash);

  await writeAuditLog({
    action: "ACTIVATION_SUCCESS",
    organizationId: result.user.organizationId,
    userId: result.user.id,
    deviceId: result.device.id,
    signals,
  });

  return NextResponse.json({ success: true, user: result.user, device: result.device });
}
