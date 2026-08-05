import { NextRequest, NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth/session";
import { normalizeActivationCode } from "@/lib/auth/tokens";
import QRCode from "qrcode";

// GET /api/auth/qr?code=XXXX-XXXX
// Renderiza o QR Code de ativação (link direto para /activate/CODE).
// Restrito a sessões de administrador da organização.
export async function GET(request: NextRequest) {
  const isAdmin = await isAdminSession();
  if (!isAdmin) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 403 });
  }

  const raw = request.nextUrl.searchParams.get("code") ?? "";
  const code = normalizeActivationCode(raw);
  if (!code) {
    return NextResponse.json({ error: "CODIGO_INVALIDO" }, { status: 400 });
  }

  const origin = request.nextUrl.origin;
  const target = `${origin}/activate/${code}`;

  const svg = await QRCode.toString(target, {
    type: "svg",
    margin: 1,
    width: 256,
    errorCorrectionLevel: "M",
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store",
    },
  });
}
