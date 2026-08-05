// ----------------------------------------------------------------------------
// Extrai os sinais do dispositivo a partir de um request (route handlers)
// ----------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { COOKIE_NAMES } from "./config";
import { getClientIp } from "./device";
import type { DeviceSignals } from "./device";

export function getDeviceSignalsFromRequest(request: NextRequest): DeviceSignals {
  const headers = Object.fromEntries(request.headers.entries());
  const userAgent = request.headers.get("user-agent") ?? "";
  const platform = request.headers.get("sec-ch-ua-platform")?.replace(/"/g, "") ?? "";
  const clientDeviceId =
    request.cookies.get(COOKIE_NAMES.clientDeviceId)?.value ?? "unknown-client";

  return {
    userAgent,
    platform,
    clientDeviceId,
    ip: getClientIp(headers),
  };
}
