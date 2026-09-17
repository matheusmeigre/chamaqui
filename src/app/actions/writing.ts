"use server";

import { getCurrentUser } from "@/lib/auth/session";
import {
  type ImprovedDescription,
  improveDescription,
} from "@/server/services/writing-assistant";

/**
 * Revisa a descrição escrita pelo solicitante. Devolve um resultado em vez de
 * lançar: o texto original fica na tela e a falha vira aviso, nunca perda.
 */
export async function improveTicketDescription(
  original: string
): Promise<ImprovedDescription> {
  const session = await getCurrentUser();
  if (!session) {
    return { ok: false, error: "Sua sessão expirou. Entre novamente para usar o auxílio com IA." };
  }

  return improveDescription(original);
}
