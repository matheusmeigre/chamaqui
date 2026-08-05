// ----------------------------------------------------------------------------
// Sessão: leitura de cookies e resolução do usuário autenticado
// ----------------------------------------------------------------------------

import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import { COOKIE_NAMES } from "./config";
import { verifyAccessToken } from "./tokens";

export type CurrentSessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId: string | null;
  deviceId: string;
};

/**
 * Resolve o usuário autenticado a partir do access token no cookie.
 * Retorna null quando o token é inválido, expirado ou quando o dispositivo
 * associado foi revogado.
 */
export async function getCurrentUser(): Promise<CurrentSessionUser | null> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(COOKIE_NAMES.access)?.value;

  if (!accessToken) return null;

  const payload = await verifyAccessToken(accessToken);
  if (!payload) return null;

  const device = await prisma.device.findUnique({
    where: { id: payload.dev },
    select: { id: true, status: true, revokedAt: true, userId: true, organizationId: true },
  });

  if (!device || device.status === "REVOGADO" || device.revokedAt) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, name: true, email: true, role: true, organizationId: true },
  });

  if (!user) return null;
  if (user.id !== device.userId) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    deviceId: device.id,
  };
}

export async function isAdminSession(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === "ADMINISTRADOR";
}
