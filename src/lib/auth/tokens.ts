// ----------------------------------------------------------------------------
// Tokens: assinatura JWT (jose), criptografia AES-256-GCM e hashing
// ----------------------------------------------------------------------------

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  ACCESS_TOKEN_TYPE,
  DEVICE_TOKEN_TTL_SECONDS,
  DEVICE_TOKEN_TYPE,
  getEncryptionKey,
  getJwtSecret,
} from "./config";

// ----------------------------------------------------------------------------
// JWT
// ----------------------------------------------------------------------------

export type AccessTokenPayload = {
  sub: string; // userId
  role: string;
  org: string; // organizationId
  dev: string; // deviceId
  typ: typeof ACCESS_TOKEN_TYPE;
};

export type DeviceTokenPayload = {
  sub: string; // userId
  org: string; // organizationId
  dev: string; // deviceId
  typ: typeof DEVICE_TOKEN_TYPE;
};

const encoder = new TextEncoder();

function secretKey(secret: string) {
  return encoder.encode(secret);
}

export async function signAccessToken(payload: Omit<AccessTokenPayload, "typ">) {
  return new SignJWT({ ...payload, typ: ACCESS_TOKEN_TYPE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS)
    .sign(secretKey(getJwtSecret()));
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(getJwtSecret()), {
      algorithms: ["HS256"],
    });
    if (payload.typ !== ACCESS_TOKEN_TYPE) return null;
    return payload as unknown as AccessTokenPayload;
  } catch {
    return null;
  }
}

export async function signDeviceToken(payload: Omit<DeviceTokenPayload, "typ">) {
  return new SignJWT({ ...payload, typ: DEVICE_TOKEN_TYPE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + DEVICE_TOKEN_TTL_SECONDS)
    .sign(secretKey(getJwtSecret()));
}

export async function verifyDeviceToken(token: string): Promise<DeviceTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(getJwtSecret()), {
      algorithms: ["HS256"],
    });
    if (payload.typ !== DEVICE_TOKEN_TYPE) return null;
    return payload as unknown as DeviceTokenPayload;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// Tokens opacos (refresh token)
// ----------------------------------------------------------------------------

export function generateOpaqueToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

// ----------------------------------------------------------------------------
// Criptografia AES-256-GCM (refresh tokens em repouso)
// ----------------------------------------------------------------------------

function toBase64Url(buffer: Buffer) {
  return buffer.toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

export function encryptToken(plain: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // formato: iv(12) + tag(16) + dados
  return toBase64Url(Buffer.concat([iv, tag, encrypted]));
}

export function decryptToken(payload: string): string | null {
  try {
    const key = getEncryptionKey();
    const buffer = fromBase64Url(payload);
    const iv = buffer.subarray(0, 12);
    const tag = buffer.subarray(12, 28);
    const encrypted = buffer.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------------------
// Fingerprint do dispositivo (device binding)
// ----------------------------------------------------------------------------

/**
 * Calcula o fingerprint do dispositivo a partir de sinais do request.
 * O mesmo fingerprint precisa ser apresentado em todos os requests para que
 * tokens sejam considerados válidos (evita uso de tokens copiados).
 */
export function computeDeviceFingerprint({
  userAgent,
  platform,
  clientDeviceId,
  secret,
}: {
  userAgent: string;
  platform: string;
  clientDeviceId: string;
  secret: string;
}) {
  return createHmac("sha256", secret)
    .update(`${userAgent}|${platform}|${clientDeviceId}`)
    .digest("hex");
}

export function constantTimeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

// ----------------------------------------------------------------------------
// Código de ativação curto (ex: 7NQH-KX4R)
// ----------------------------------------------------------------------------

// Alfabeto sem caracteres ambíguos (0/O, 1/I/L)
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_PART_LENGTH = 4;
const CODE_PARTS = 2;

export function generateActivationCode(): string {
  const parts: string[] = [];
  for (let p = 0; p < CODE_PARTS; p++) {
    const bytes = randomBytes(CODE_PART_LENGTH);
    let part = "";
    for (let i = 0; i < CODE_PART_LENGTH; i++) {
      part += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
    }
    parts.push(part);
  }
  return parts.join("-");
}

export function normalizeActivationCode(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashActivationCode(code: string) {
  return createHash("sha256").update(normalizeActivationCode(code)).digest("hex");
}
