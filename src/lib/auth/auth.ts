// ----------------------------------------------------------------------------
// Núcleo da autenticação por dispositivo:
// ativação, criação de tokens, refresh rotation, revogação e auditoria.
// ----------------------------------------------------------------------------

import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import type { Role } from "@prisma/client";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  COOKIE_NAMES,
  DEVICE_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from "./config";
import {
  decryptToken,
  encryptToken,
  generateOpaqueToken,
  hashActivationCode,
  sha256Hex,
  signAccessToken,
  signDeviceToken,
  verifyDeviceToken,
} from "./tokens";
import {
  fingerprintsMatch,
  getDeviceFingerprint,
  getDeviceDisplayName,
  parseUserAgent,
} from "./device";
import type { DeviceSignals } from "./device";

// ----------------------------------------------------------------------------
// Auditoria
// ----------------------------------------------------------------------------

export async function writeAuditLog({
  action,
  organizationId,
  userId,
  deviceId,
  signals,
}: {
  action: string;
  organizationId?: string | null;
  userId?: string | null;
  deviceId?: string | null;
  signals: DeviceSignals;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        organizationId: organizationId ?? null,
        userId: userId ?? null,
        deviceId: deviceId ?? null,
        ip: signals.ip,
        userAgent: signals.userAgent,
      },
    });
  } catch (error) {
    console.error("Falha ao registrar auditoria:", error);
  }
}

// ----------------------------------------------------------------------------
// Cookies
// ----------------------------------------------------------------------------

function isSecureEnv() {
  return process.env.NODE_ENV === "production";
}

export async function setSessionCookies({
  accessToken,
  refreshToken,
  deviceToken,
}: {
  accessToken: string;
  refreshToken?: string;
  deviceToken?: string;
}) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAMES.access, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureEnv(),
    maxAge: ACCESS_TOKEN_TTL_SECONDS,
    path: "/",
  });
  if (refreshToken) {
    cookieStore.set(COOKIE_NAMES.refresh, refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: isSecureEnv(),
      maxAge: REFRESH_TOKEN_TTL_SECONDS,
      path: "/",
    });
  }
  if (deviceToken) {
    cookieStore.set(COOKIE_NAMES.device, deviceToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: isSecureEnv(),
      maxAge: DEVICE_TOKEN_TTL_SECONDS,
      path: "/",
    });
  }
}

export async function clearSessionCookies() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAMES.access, "", { httpOnly: true, maxAge: 0, path: "/" });
  cookieStore.set(COOKIE_NAMES.refresh, "", { httpOnly: true, maxAge: 0, path: "/" });
  cookieStore.set(COOKIE_NAMES.device, "", { httpOnly: true, maxAge: 0, path: "/" });
}

// ----------------------------------------------------------------------------
// Criação de tokens para um dispositivo
// ----------------------------------------------------------------------------

type TokenBundle = {
  accessToken: string;
  refreshToken: string;
  deviceToken: string;
};

/**
 * Cria access token + refresh token (persistido criptografado) + device token
 * para um dispositivo. O refresh token antigo daquele dispositivo (se houver)
 * é revogado (rotação) quando `revokePrevious` é verdadeiro.
 */
export async function createTokenBundle(
  device: { id: string; userId: string; organizationId: string; role: Role; name: string },
  opts: { revokePrevious?: boolean } = {}
): Promise<TokenBundle> {
  if (opts.revokePrevious) {
    await prisma.refreshToken.updateMany({
      where: { deviceId: device.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  const refreshToken = generateOpaqueToken();
  const refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);

  await prisma.refreshToken.create({
    data: {
      tokenHash: sha256Hex(refreshToken),
      tokenEncrypted: encryptToken(refreshToken),
      deviceId: device.id,
      expiresAt: refreshTokenExpiresAt,
    },
  });

  const accessToken = await signAccessToken({
    sub: device.userId,
    role: device.role,
    org: device.organizationId,
    dev: device.id,
  });

  const deviceToken = await signDeviceToken({
    sub: device.userId,
    org: device.organizationId,
    dev: device.id,
  });

  return { accessToken, refreshToken, deviceToken };
}

// ----------------------------------------------------------------------------
// Ativação de dispositivo
// ----------------------------------------------------------------------------

export async function activateDeviceWithCode({
  organizationId,
  code,
  signals,
}: {
  organizationId: string;
  code: string;
  signals: DeviceSignals;
}) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  });
  if (!organization || !organization.enabled) {
    return { error: "ORGANIZATION_INVALID" as const };
  }

  const codeHash = hashActivationCode(code);
  const activationCode = await prisma.activationCode.findUnique({
    where: { codeHash },
  });

  if (!activationCode || activationCode.organizationId !== organization.id) {
    return { error: "CODE_INVALID" as const };
  }
  if (activationCode.usedAt) {
    return { error: "CODE_ALREADY_USED" as const };
  }
  if (activationCode.expiresAt < new Date()) {
    return { error: "CODE_EXPIRED" as const };
  }

  // Resolve/cria o usuário da organização
  const user = await prisma.user.upsert({
    where: { email: organization.email },
    update: { name: organization.name, role: activationCode.role, organizationId: organization.id },
    create: {
      email: organization.email,
      name: organization.name,
      role: activationCode.role,
      organizationId: organization.id,
    },
  });

  const fingerprint = getDeviceFingerprint(signals);
  const { platform, browser } = parseUserAgent(signals.userAgent);

  // Dispositivo reutilizável: mesmo fingerprint recupera o dispositivo existente
  const existingDevice = await prisma.device.findFirst({
    where: { fingerprintHash: fingerprint, organizationId: organization.id, status: "ATIVO" },
  });

  const device = existingDevice
    ? existingDevice
    : await prisma.device.create({
        data: {
          name: getDeviceDisplayName(platform, browser),
          fingerprintHash: fingerprint,
          platform,
          browser,
          lastIp: signals.ip,
          lastSeenAt: new Date(),
          status: "ATIVO",
          userId: user.id,
          organizationId: organization.id,
        },
      });

  if (!existingDevice) {
    // Vincular o código de ativação ao dispositivo que o utilizou
    await prisma.activationCode.update({
      where: { id: activationCode.id },
      data: { usedAt: new Date(), usedByDeviceId: device.id },
    });
  } else {
    await prisma.activationCode.update({
      where: { id: activationCode.id },
      data: { usedAt: new Date(), usedByDeviceId: device.id },
    });
  }

  const bundle = await createTokenBundle(
    {
      id: device.id,
      userId: user.id,
      organizationId: organization.id,
      role: user.role,
      name: user.name,
    },
    { revokePrevious: true }
  );

  await setSessionCookies(bundle);

  await writeAuditLog({
    action: "DEVICE_ACTIVATED",
    organizationId: organization.id,
    userId: user.id,
    deviceId: device.id,
    signals,
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: organization.id,
    },
    device: {
      id: device.id,
      name: device.name,
    },
  };
}

// ----------------------------------------------------------------------------
// Refresh rotation
// ----------------------------------------------------------------------------

/**
 * Valida o refresh token (criptografado em repouso) e faz rotação:
 * revoga o atual, emite um novo, e devolve um novo access token.
 */
export async function rotateRefreshToken({
  refreshToken,
  signals,
}: {
  refreshToken: string;
  signals: DeviceSignals;
}) {
  const tokenHash = sha256Hex(refreshToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: {
      device: {
        include: { user: true, organization: true },
      },
    },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    return { error: "REFRESH_INVALID" as const };
  }

  const decrypted = decryptToken(stored.tokenEncrypted);
  if (!decrypted || decrypted !== refreshToken) {
    return { error: "REFRESH_TAMPERED" as const };
  }

  const { device } = stored;
  if (device.status === "REVOGADO" || device.revokedAt) {
    return { error: "DEVICE_REVOKED" as const };
  }

  // Device binding: o fingerprint do request atual precisa bater com o do dispositivo
  const currentFingerprint = getDeviceFingerprint(signals);
  if (!fingerprintsMatch(currentFingerprint, device.fingerprintHash)) {
    return { error: "DEVICE_MISMATCH" as const };
  }

  // Rotação: revoga o token atual e emite um novo
  const newRefreshToken = generateOpaqueToken();
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        tokenHash: sha256Hex(newRefreshToken),
        tokenEncrypted: encryptToken(newRefreshToken),
        deviceId: device.id,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
      },
    }),
    prisma.device.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date(), lastIp: signals.ip },
    }),
  ]);

  const accessToken = await signAccessToken({
    sub: device.userId,
    role: device.user.role,
    org: device.organizationId,
    dev: device.id,
  });

  return { accessToken, refreshToken: newRefreshToken };
}

// ----------------------------------------------------------------------------
// Reativação automática por device token (próximos acessos)
// ----------------------------------------------------------------------------

/**
 * Usa o device token (longo prazo) para reestabelecer a sessão sem reativação,
 * verificando o fingerprint do dispositivo.
 */
export async function restoreSessionWithDeviceToken({
  deviceToken,
  signals,
}: {
  deviceToken: string;
  signals: DeviceSignals;
}) {
  const payload = await verifyDeviceToken(deviceToken);
  if (!payload) return { error: "DEVICE_TOKEN_INVALID" as const };

  const device = await prisma.device.findUnique({
    where: { id: payload.dev },
    include: { user: true, organization: true },
  });
  if (!device || device.status === "REVOGADO" || device.revokedAt) {
    return { error: "DEVICE_REVOKED" as const };
  }
  if (!device.organization.enabled) {
    return { error: "ORGANIZATION_DISABLED" as const };
  }

  const currentFingerprint = getDeviceFingerprint(signals);
  if (!fingerprintsMatch(currentFingerprint, device.fingerprintHash)) {
    return { error: "DEVICE_MISMATCH" as const };
  }

  const bundle = await createTokenBundle(
    {
      id: device.id,
      userId: device.userId,
      organizationId: device.organizationId,
      role: device.user.role,
      name: device.user.name,
    },
    { revokePrevious: true }
  );

  await setSessionCookies(bundle);

  await writeAuditLog({
    action: "LOGIN",
    organizationId: device.organizationId,
    userId: device.userId,
    deviceId: device.id,
    signals,
  });

  return { bundle, device, user: device.user };
}

// ----------------------------------------------------------------------------
// Logout e revogação
// ----------------------------------------------------------------------------

export async function revokeCurrentRefreshToken(refreshToken?: string) {
  if (!refreshToken) return;
  await prisma.refreshToken.updateMany({
    where: { tokenHash: sha256Hex(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Revoga um dispositivo: revoga todos os refresh tokens e marca como revogado.
 * Também limpa os cookies de sessão se o dispositivo revogado for o atual.
 */
export async function revokeDevice(deviceId: string) {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    include: { user: true },
  });
  if (!device) return { error: "DEVICE_NOT_FOUND" as const };

  await prisma.$transaction([
    prisma.refreshToken.updateMany({
      where: { deviceId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.device.update({
      where: { id: deviceId },
      data: { status: "REVOGADO", revokedAt: new Date() },
    }),
  ]);

  return { device };
}
