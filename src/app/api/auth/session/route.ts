import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAMES } from "@/lib/auth/config";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { getDeviceSignalsFromRequest } from "@/lib/auth/request";
import {
  rotateRefreshToken,
  restoreSessionWithDeviceToken,
  setSessionCookies,
} from "@/lib/auth/auth";

// GET /api/auth/session
// Fluxo de "próximos acessos": resolve a sessão atual sem exigir reativação.
// 1. Access token válido -> devolve o usuário.
// 2. Refresh token válido -> faz rotação e devolve novo access token.
// 3. Device token válido -> reestabelece refresh + access (sem reativação).
// Caso nenhum seja válido, retorna 401 para que o cliente inicie a ativação.
export async function GET(request: NextRequest) {
  const cookieStore = request.cookies;
  const accessToken = cookieStore.get(COOKIE_NAMES.access)?.value;
  const refreshToken = cookieStore.get(COOKIE_NAMES.refresh)?.value;
  const deviceToken = cookieStore.get(COOKIE_NAMES.device)?.value;
  const signals = getDeviceSignalsFromRequest(request);

  // 1. Access token válido
  if (accessToken) {
    const payload = await verifyAccessToken(accessToken);
    if (payload) {
      return NextResponse.json({
        authenticated: true,
        session: { userId: payload.sub, role: payload.role, organizationId: payload.org, deviceId: payload.dev },
      });
    }
  }

  // 2. Refresh rotation
  if (refreshToken) {
    const rotated = await rotateRefreshToken({ refreshToken, signals });
    if (rotated.accessToken) {
      const response = NextResponse.json({
        authenticated: true,
        session: { refreshRotated: true },
      });
      await setSessionCookies({
        accessToken: rotated.accessToken,
        refreshToken: rotated.refreshToken,
      });
      return response;
    }
  }

  // 3. Restauração por device token
  if (deviceToken) {
    const restored = await restoreSessionWithDeviceToken({ deviceToken, signals });
    if (restored.bundle) {
      const response = NextResponse.json({
        authenticated: true,
        session: {
          userId: restored.user.id,
          role: restored.user.role,
          organizationId: restored.device.organizationId,
          deviceId: restored.device.id,
        },
      });
      await setSessionCookies(restored.bundle);
      return response;
    }
  }

  return NextResponse.json({ authenticated: false }, { status: 401 });
}
