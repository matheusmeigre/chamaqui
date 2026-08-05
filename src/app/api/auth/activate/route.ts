import { NextRequest, NextResponse } from "next/server";
import { getDeviceSignalsFromRequest } from "@/lib/auth/request";
import { activateDeviceWithCode, writeAuditLog } from "@/lib/auth/auth";

// POST /api/auth/activate
// Ativa um dispositivo usando um código curto (ou token de QR).
// Body: { organizationId, code }
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
  const code = typeof body?.code === "string" ? body.code : "";

  if (!organizationId || !code) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const signals = getDeviceSignalsFromRequest(request);
  const result = await activateDeviceWithCode({ organizationId, code, signals });

  if (result.error) {
    const status =
      result.error === "ORGANIZATION_INVALID" ? 404 : result.error === "CODE_INVALID" ? 401 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  await writeAuditLog({
    action: "ACTIVATION_SUCCESS",
    organizationId: result.user.organizationId,
    userId: result.user.id,
    deviceId: result.device.id,
    signals,
  });

  return NextResponse.json({ success: true, user: result.user, device: result.device });
}
