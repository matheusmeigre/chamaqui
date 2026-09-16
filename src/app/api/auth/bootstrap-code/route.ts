import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import type { Organization } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  clearFailedLogins,
  getClientHash,
  isLoginBlocked,
  registerFailedLogin,
  THROTTLE_BUCKETS,
} from "@/lib/auth-throttle";
import { generateActivationCode, hashActivationCode } from "@/lib/auth/tokens";
import { ACTIVATION_CODE_TTL_SECONDS, isAdminOrganization } from "@/lib/auth/config";
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

function expectedKeyFor(organization: Pick<Organization, "slug">): string | undefined {
  const envVar = getAccessKeyEnv(organization.slug);
  return envVar ? process.env[envVar] : undefined;
}

/**
 * Descobre a organização dona da chave sem que ela seja informada. Compara com
 * todas as organizações habilitadas, sem parar no primeiro acerto: o tempo de
 * resposta não entrega a posição da organização na lista.
 */
async function findOrganizationByAccessKey(accessKey: string) {
  const organizations = await prisma.organization.findMany({ where: { enabled: true } });
  const matches = organizations.filter((organization) => {
    const expected = expectedKeyFor(organization);
    return expected ? keysMatch(accessKey, expected) : false;
  });

  if (matches.length > 1) {
    // Duas organizações com a mesma chave é erro de configuração: recusar é
    // mais seguro que escolher uma delas.
    console.error(
      "[bootstrap-code] chave de acesso compartilhada entre organizações:",
      matches.map((organization) => organization.slug).join(", ")
    );
    return null;
  }
  return matches[0] ?? null;
}

// POST /api/auth/bootstrap-code
// Gera um código de ativação para uma organização usando a chave de acesso da
// organização. Permite o primeiro login sem sessão admin (bootstrap),
// resolvendo o problema ovo-e-galinha.
// Body: { accessKey, organizationId? }
//
// A organização não precisa ser informada: a chave identifica a organização,
// e a tela de login não expõe a lista de clientes.
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
  const accessKey = typeof body?.accessKey === "string" ? body.accessKey : "";

  if (!accessKey || accessKey.length > 256) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }

  // Compatibilidade: com organização informada, a contagem continua por organização.
  const informed = organizationId
    ? await prisma.organization.findUnique({ where: { id: organizationId } })
    : null;
  if (organizationId && (!informed || !informed.enabled)) {
    return NextResponse.json({ error: "ORGANIZATION_INVALID" }, { status: 404 });
  }

  const throttleKey = informed ? informed.slug : THROTTLE_BUCKETS.bootstrap;
  const clientHash = getClientHash(Object.fromEntries(request.headers.entries()));
  if (await isLoginBlocked(throttleKey, clientHash)) {
    return NextResponse.json({ error: "LOGIN_BLOCKED" }, { status: 429 });
  }

  let organization: Organization | null;
  if (informed) {
    const expectedKey = expectedKeyFor(informed);
    organization = expectedKey && keysMatch(accessKey, expectedKey) ? informed : null;
  } else {
    organization = await findOrganizationByAccessKey(accessKey);
  }

  if (!organization) {
    const blockedUntil = await registerFailedLogin(throttleKey, clientHash);
    if (blockedUntil) {
      return NextResponse.json({ error: "LOGIN_BLOCKED" }, { status: 429 });
    }
    return NextResponse.json({ error: "ACCESS_KEY_INVALID" }, { status: 401 });
  }

  await clearFailedLogins(throttleKey, clientHash);

  const plainCode = generateActivationCode();
  const role = isAdminOrganization(organization.slug) ? "ADMINISTRADOR" : "SOLICITANTE";
  const code = await prisma.activationCode.create({
    data: {
      codeHash: hashActivationCode(plainCode),
      role,
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
      role,
      expiresAt: code.expiresAt,
      organization: { slug: organization.slug, name: organization.name },
    },
  });
}
