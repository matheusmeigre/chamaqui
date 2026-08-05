// ----------------------------------------------------------------------------
// Detecção do dispositivo (plataforma, navegador, IP e fingerprint)
// ----------------------------------------------------------------------------

import { getFingerprintSecret } from "./config";
import { computeDeviceFingerprint, constantTimeEqual } from "./tokens";

export type DeviceSignals = {
  userAgent: string;
  platform: string;
  clientDeviceId: string;
  ip: string | null;
};

type HeaderValue = string | string[] | undefined | null;

function pick(headers: Record<string, HeaderValue>, name: string): string {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export function getClientIp(headers: Record<string, HeaderValue>): string | null {
  const forwarded = pick(headers, "x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = pick(headers, "x-real-ip");
  if (realIp) return realIp.trim();
  return null;
}

/**
 * Normaliza o user-agent e extrai a plataforma/navegador para exibição.
 */
export function parseUserAgent(userAgent: string): { platform: string; browser: string } {
  const ua = userAgent;
  let platform = "Desconhecido";
  let browser = "Desconhecido";

  if (/Windows NT 10\.0/.test(ua)) platform = "Windows 10/11";
  else if (/Windows NT 6\.3/.test(ua)) platform = "Windows 8.1";
  else if (/Windows NT 6\.1/.test(ua)) platform = "Windows 7";
  else if (/Android/.test(ua)) platform = "Android";
  else if (/iPhone|iPad|iPod/.test(ua)) platform = "iOS";
  else if (/Mac OS X/.test(ua)) platform = "macOS";
  else if (/Linux/.test(ua)) platform = "Linux";
  else if (/CrOS/.test(ua)) platform = "ChromeOS";

  if (/Edg\//.test(ua)) browser = "Microsoft Edge";
  else if (/OPR\//.test(ua)) browser = "Opera";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua)) browser = "Safari";
  else if (/Firefox\//.test(ua)) browser = "Firefox";

  return { platform, browser };
}

/**
 * Calcula o fingerprint do dispositivo e verifica se corresponde ao esperado.
 */
export function getDeviceFingerprint(signals: DeviceSignals) {
  return computeDeviceFingerprint({
    userAgent: signals.userAgent,
    platform: signals.platform,
    clientDeviceId: signals.clientDeviceId,
    secret: getFingerprintSecret(),
  });
}

export function fingerprintsMatch(a: string, b: string) {
  return constantTimeEqual(a, b);
}

/**
 * Gera um nome amigável para o dispositivo (ex: "Notebook Windows", "Celular Android").
 */
export function getDeviceDisplayName(platform: string, browser: string): string {
  const deviceType =
    platform === "Android" || platform === "iOS" ? "Celular" : "Dispositivo";
  const label = [deviceType, platform, browser].filter(Boolean).join(" ");
  return label.trim() || "Dispositivo desconhecido";
}
