import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAMES } from "@/lib/auth/config";
import { revokeCurrentRefreshToken, clearSessionCookies } from "@/lib/auth/auth";

// POST /api/auth/logout
// Encerra a sessão: revoga o refresh token atual e limpa os cookies.
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(COOKIE_NAMES.refresh)?.value;
  await revokeCurrentRefreshToken(refreshToken);
  await clearSessionCookies();
  return NextResponse.json({ success: true });
}
