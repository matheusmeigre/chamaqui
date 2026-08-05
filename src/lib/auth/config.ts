import { createHash } from "node:crypto";

// ----------------------------------------------------------------------------
// Configuração do fluxo de autenticação por dispositivo
// ----------------------------------------------------------------------------

export const COOKIE_NAMES = {
  access: "chq_access",
  refresh: "chq_refresh",
  device: "chq_device",
  clientDeviceId: "chq_client_device_id",
} as const;

// Tempos de vida (em segundos)
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutos
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 dias
export const DEVICE_TOKEN_TTL_SECONDS = 180 * 24 * 60 * 60; // 180 dias
export const ACTIVATION_CODE_TTL_SECONDS = 24 * 60 * 60; // 24 horas (padrão)

// Identificadores dos tokens JWT
export const ACCESS_TOKEN_TYPE = "access";
export const DEVICE_TOKEN_TYPE = "device";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.length < 16) {
    throw new Error(
      `${name} is not configured. Configure it in the environment before using authentication.`
    );
  }
  return value;
}

/**
 * Segredo usado para assinar os JWT (access token e device token).
 * Preferência: AUTH_TOKEN_SECRET -> NEXTAUTH_SECRET.
 */
export function getJwtSecret(): string {
  return process.env.AUTH_TOKEN_SECRET ?? requiredEnv("NEXTAUTH_SECRET");
}

/**
 * Chave usada para criptografar os refresh tokens em repouso (AES-256-GCM).
 * Preferência: TOKEN_ENCRYPTION_KEY -> derivada do NEXTAUTH_SECRET.
 */
export function getEncryptionKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (raw) {
    const hex = raw.startsWith("hex:") ? raw.slice(4) : raw;
    const decoded = hex.length === 64 ? Buffer.from(hex, "hex") : Buffer.from(raw, "utf8");
    if (decoded.length >= 32) return decoded.subarray(0, 32);
    throw new Error("TOKEN_ENCRYPTION_KEY must contain at least 32 bytes");
  }
  // Fallback determinístico derivado do NEXTAUTH_SECRET (mantém compatibilidade local)
  return Buffer.from(createHash("sha256").update(requiredEnv("NEXTAUTH_SECRET")).digest("hex"), "hex");
}

/**
 * Segredo usado para gerar o fingerprint do dispositivo (device binding).
 */
export function getFingerprintSecret(): string {
  return process.env.AUTH_FINGERPRINT_SECRET ?? getJwtSecret();
}
