import { createHmac } from "node:crypto";
import prisma from "@/lib/prisma";

const MAX_ATTEMPTS = 5;

type RequestHeaders = Record<string, string | string[] | undefined>;

function getHeader(headers: RequestHeaders, name: string) {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function getClientIdentifier(headers: RequestHeaders) {
  const forwarded = process.env.VERCEL === "1"
    ? getHeader(headers, "x-vercel-forwarded-for") ?? "unknown-client"
    : getHeader(headers, "x-forwarded-for")
      ?? getHeader(headers, "x-real-ip")
      ?? "unknown-client";

  return forwarded.split(",")[0].trim().toLowerCase();
}

export function getClientHash(headers: RequestHeaders) {
  const secret = process.env.AUTH_RATE_LIMIT_SECRET;

  if (!secret) {
    throw new Error("AUTH_RATE_LIMIT_SECRET is not configured");
  }

  return createHmac("sha256", secret)
    .update(getClientIdentifier(headers))
    .digest("hex");
}

export async function isLoginBlocked(organization: string, clientHash: string) {
  const throttle = await prisma.authThrottle.findUnique({
    where: { organization_clientHash: { organization, clientHash } },
    select: { blockedUntil: true },
  });

  return Boolean(throttle?.blockedUntil && throttle.blockedUntil > new Date());
}

export async function registerFailedLogin(organization: string, clientHash: string) {
  const rows = await prisma.$queryRaw<Array<{ blockedUntil: Date | null }>>`
    INSERT INTO "AuthThrottle" (
      "organization", "clientHash", "failedAttempts", "windowStartedAt", "blockedUntil", "updatedAt"
    )
    VALUES (${organization}, ${clientHash}, 1, CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP)
    ON CONFLICT ("organization", "clientHash") DO UPDATE SET
      "failedAttempts" = CASE
        WHEN "AuthThrottle"."blockedUntil" > CURRENT_TIMESTAMP THEN "AuthThrottle"."failedAttempts"
        WHEN "AuthThrottle"."windowStartedAt" <= CURRENT_TIMESTAMP - INTERVAL '5 minutes' THEN 1
        ELSE "AuthThrottle"."failedAttempts" + 1
      END,
      "windowStartedAt" = CASE
        WHEN "AuthThrottle"."blockedUntil" > CURRENT_TIMESTAMP THEN "AuthThrottle"."windowStartedAt"
        WHEN "AuthThrottle"."windowStartedAt" <= CURRENT_TIMESTAMP - INTERVAL '5 minutes' THEN CURRENT_TIMESTAMP
        ELSE "AuthThrottle"."windowStartedAt"
      END,
      "blockedUntil" = CASE
        WHEN "AuthThrottle"."blockedUntil" > CURRENT_TIMESTAMP THEN "AuthThrottle"."blockedUntil"
        WHEN "AuthThrottle"."windowStartedAt" <= CURRENT_TIMESTAMP - INTERVAL '5 minutes' THEN NULL
        WHEN "AuthThrottle"."failedAttempts" + 1 >= ${MAX_ATTEMPTS} THEN CURRENT_TIMESTAMP + INTERVAL '5 minutes'
        ELSE NULL
      END,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "blockedUntil"
  `;

  return rows[0]?.blockedUntil ?? null;
}

export async function clearFailedLogins(organization: string, clientHash: string) {
  await prisma.authThrottle.deleteMany({ where: { organization, clientHash } });
}
