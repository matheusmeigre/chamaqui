import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import prisma from "@/lib/prisma";
import {
  clearFailedLogins,
  getClientHash,
  isLoginBlocked,
  registerFailedLogin,
} from "@/lib/auth-throttle";
import { generateActivationCode, hashActivationCode } from "@/lib/auth/tokens";
import { ACTIVATION_CODE_TTL_SECONDS } from "@/lib/auth/config";
import { getDeviceSignalsFromRequest } from "@/lib/auth/request";
import { writeAuditLog } from "@/lib/auth/auth";

const LEGACY_ACCESS_KEY_ENV: Record<string, string> = {
  hdl: "HDL_ACCESS_KEY",
  "instituto-energisa": "INSTITUTO_ENERGISA_ACCESS_KEY",
};

function getAccessKeyEnv(slug: string): string | undefined {
  return LEGACY_ACCESS_KEY_ENV[slug] ?? `ORG_ACCESS_KEY_${slug.replace(/-/g, "_").toUpperCase()}`;
}

function keysMatch(providedKey: string, expectedKey: string) {
  const providedDigest = createHash("sha256").update(providedKey).digest();
  const expectedDigest = createHash("sha256").update(expectedKey).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

// POST /api/auth/bootstrap-code
// Gera um código de ativação (role ADMINISTRADOR) para uma organização usando a
// chave de acesso da organização. Permite o primeiro login sem sessão admin
// (bootstrap), resolvendo o problema ovo-e-galinha.
// Body: { organizationId, accessKey }
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
  const accessKey = typeof body?.accessKey === "string" ? body.accessKey : "";

  if (!organizationId || !accessKey || accessKey.length > 256) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  });
  if (!organization || !organization.enabled) {
    return NextResponse.json({ error: "ORGANIZATION_INVALID" }, { status: 404 });
  }

  const clientHash = getClientHash(Object.fromEntries(request.headers.entries()));
  if (await isLoginBlocked(organization.slug, clientHash)) {
    return NextResponse.json({ error: "LOGIN_BLOCKED" }, { status: 429 });
  }

  const envVar = getAccessKeyEnv(organization.slug);
  const expectedKey = envVar ? process.env[envVar] : undefined;
  if (!expectedKey || !keysMatch(accessKey, expectedKey)) {
    const blockedUntil = await registerFailedLogin(organization.slug, clientHash);
    if (blockedUntil) {
      return NextResponse.json({ error: "LOGIN_BLOCKED" }, { status: 429 });
    }
    return NextResponse.json({ error: "ACCESS_KEY_INVALID" }, { status: 401 });
  }

  await clearFailedLogins(organization.slug, clientHash);

  const plainCode = generateActivationCode();
  const code = await prisma.activationCode.create({
    data: {
      codeHash: hashActivationCode(plainCode),
      role: "ADMINISTRADOR",
      expiresAt: new Date(Date.now() + ACTIVATION_CODE_TTL_SECONDS * 1000),
      organizationId: organization.id,
    },
  });

  const signals = getDeviceSignalsFromRequest(request);
  await writeAuditLog({
    action: "BOOTSTRAP_CODE_GENERATED",
    organizationId: organization.id,
    signals,
  });

  return NextResponse.json({
    code: {
      id: code.id,
      plainCode, // exibido apenas uma vez
      role: "ADMINISTRADOR",
      expiresAt: code.expiresAt,
      organization: { slug: organization.slug, name: organization.name },
    },
  });
}
