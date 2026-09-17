"use server";

import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";
import type {
  Severity,
  TicketCategoryCode,
  TicketChannel,
  TicketStatus,
} from "@prisma/client";
import { SEVERITY_TO_PRIORITY } from "@/server/domain/ticket-grid";
import {
  competencyOf,
  normalizeUnits,
  validateSeverity,
} from "@/server/services/ticket-classification";
import { evaluateP1Burst, evaluateQuotaAlerts } from "@/server/services/quota-alerts";
import {
  TRIAGE_BLOCKED_MESSAGE,
  buildTriageMessage,
  canEnterTriage,
} from "@/server/services/triage-service";
import { checkExecutionGate } from "@/server/services/quota-service";

export async function createTicket(formData: FormData) {
  const session = await getCurrentUser();
  if (!session) throw new Error("Não autorizado");

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const categoryId = formData.get("categoryId") as string;

  // --- Grade de Chamados: classificação na abertura --------------------------
  const categoryCode = (formData.get("categoryCode") as TicketCategoryCode) || null;
  if (!categoryCode) {
    throw new Error("Selecione a categoria da grade (C1..C6).");
  }

  const rawSeverity = (formData.get("severity") as Severity) || null;
  const severity = validateSeverity(categoryCode, rawSeverity);
  const channel = ((formData.get("channel") as TicketChannel) || "PORTAL") as TicketChannel;
  const units = normalizeUnits(categoryCode, Number(formData.get("units")));

  // Severidade e prioridade são o mesmo eixo: quando há severidade, ela manda,
  // para que listagens e dashboard não exibam uma classificação contraditória.
  const priority = severity
    ? SEVERITY_TO_PRIORITY[severity]
    : ((formData.get("priority") as "BAIXA" | "MEDIA" | "ALTA" | "CRITICA") ?? "BAIXA");

  // O marco zero do SLA é o registro no sistema, inclusive para chamados que
  // chegaram por telefone ou e-mail: chamado fora do canal oficial não existe
  // até ser registrado.
  const openedAt = new Date();

  // Lidando com anexos (imagens)
  const files = formData.getAll("attachments") as File[];
  const attachmentUrls: string[] = [];

  for (const file of files) {
    if (file.size > 0) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `user_${session.id}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('tickets') // O nome do bucket criado no Supabase
        .upload(filePath, file, { contentType: file.type });

      if (!error && data) {
        // Pega a URL pública
        const { data: publicData } = supabase.storage
          .from('tickets')
          .getPublicUrl(filePath);

        attachmentUrls.push(publicData.publicUrl);
      } else {
        console.error("Erro ao subir arquivo:", error);
      }
    }
  }

  const ticket = await prisma.ticket.create({
    data: {
      title,
      description,
      priority,
      categoryId,
      requesterId: session.id,
      status: "ABERTO",
      attachmentUrls,
      categoryCode,
      severity,
      channel,
      units,
      openedAt,
      competency: competencyOf(openedAt),
    }
  });

  // Automações da grade: avisos de 80%/100% do teto e detecção de rajada de P1.
  // Uma falha aqui não pode impedir a abertura do chamado.
  if (session.organizationId) {
    try {
      await evaluateQuotaAlerts(session.organizationId, ticket.competency ?? undefined);
      if (severity === "P1") {
        await evaluateP1Burst(session.organizationId, openedAt);
      }
    } catch (error) {
      console.error("Falha ao avaliar automações da grade:", error);
    }
  }

  revalidatePath("/tickets");
  revalidatePath("/reports/consumption");
}

export async function updateTicketStatus(ticketId: string, status: TicketStatus) {
  const session = await getCurrentUser();
  if (!session || session.role === "SOLICITANTE") throw new Error("Não autorizado");

  const current = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      status: true,
      categoryCode: true,
      competency: true,
      firstResponseAt: true,
      overrunDecision: true,
      triageEnteredAt: true,
      triageCompletedAt: true,
      requester: { select: { organizationId: true } },
    },
  });
  if (!current) throw new Error("Chamado não encontrado");

  // Triagem é etapa única: análise, categorização e dimensionamento acontecem
  // uma vez só. Concluída a etapa, o chamado não volta para ela — e a regra
  // olha os marcos da passagem pela triagem, não o status atual. A validação
  // vive aqui, no servidor: a interface apenas reflete a mesma regra.
  if (status === "EM_TRIAGEM" && !canEnterTriage(current)) {
    throw new Error(TRIAGE_BLOCKED_MESSAGE);
  }

  const enteringTriage = status === "EM_TRIAGEM" && current.status !== "EM_TRIAGEM";
  const leavingTriage = status !== "EM_TRIAGEM" && current.status === "EM_TRIAGEM";
  const now = new Date();

  // Bloqueio de execução no estouro do teto: só vale para o início do
  // atendimento. Triagem, resposta e encerramento seguem livres, porque o
  // compromisso é não executar sem consulta — não deixar o cliente sem retorno.
  if (status === "EM_ATENDIMENTO" && current.requester.organizationId) {
    const gate = await checkExecutionGate({
      organizationId: current.requester.organizationId,
      categoryCode: current.categoryCode,
      competency: current.competency ?? competencyOf(new Date()),
      overrunDecisionAlreadyTaken: current.overrunDecision !== null,
    });

    if (!gate.allowed) throw new Error(gate.message);
  }

  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status,
      assigneeId: session.role === "ADMINISTRADOR" ? session.id : undefined,
      // A primeira manifestação técnica registra o marco de 1ª resposta do SLA.
      ...(current.firstResponseAt ? {} : { firstResponseAt: now }),
      ...(enteringTriage ? { triageEnteredAt: now } : {}),
      ...(leavingTriage ? { triageCompletedAt: now } : {}),
    }
  });

  await prisma.comment.create({
    data: {
      content: `Status alterado para ${status}.`,
      ticketId: ticket.id,
      authorId: session.id,
      isSystem: true
    }
  });

  // A comunicação de entrada em triagem é responsabilidade do sistema: não
  // depende do campo de resposta nem do botão Enviar. Vai como mensagem do
  // suporte — é uma comunicação ao solicitante, não um log de evento.
  if (enteringTriage) {
    await prisma.comment.create({
      data: {
        content: buildTriageMessage(ticket),
        ticketId: ticket.id,
        authorId: session.id,
        isSystem: false
      }
    });
  }

  // Notificar o solicitante
  if (ticket.requesterId !== session.id) {
    const isPending = status === "PENDENTE";
    await prisma.notification.create({
      data: {
        userId: ticket.requesterId,
        title: isPending 
          ? `🚨 IMPORTANTE: Ação Requerida (#${ticket.id.split('-')[0]})` 
          : `Atualização no Chamado #${ticket.id.split('-')[0]}`,
        message: isPending 
          ? `Atenção: A solução do seu chamado "${ticket.title}" precisa ser validada. Você tem um prazo de apenas 8 horas para retornar ou avaliar.` 
          : `O status do seu chamado "${ticket.title}" foi alterado para ${status}.`,
        link: `/tickets/${ticket.id}`
      }
    });
  }

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
}

export async function addComment(formData: FormData) {
  const session = await getCurrentUser();
  if (!session) throw new Error("Não autorizado");

  const ticketId = formData.get("ticketId") as string;
  const content = formData.get("content") as string;

  const ticket = await prisma.ticket.findFirst({
    where: {
      id: ticketId,
      ...(session.role === "SOLICITANTE" ? { requesterId: session.id } : {}),
    },
  });
  if (!ticket) throw new Error("Não autorizado");

  // Lidando com anexos nos comentários (opcional)
  const files = formData.getAll("attachments") as File[];
  const attachmentUrls: string[] = [];

  for (const file of files) {
    if (file.size > 0) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `comments_user_${session.id}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('tickets') 
        .upload(filePath, file, { contentType: file.type });

      if (!error && data) {
        const { data: publicData } = supabase.storage
          .from('tickets')
          .getPublicUrl(filePath);
        attachmentUrls.push(publicData.publicUrl);
      }
    }
  }

  await prisma.comment.create({
    data: {
      content,
      ticketId,
      authorId: session.id,
      isSystem: false,
      attachmentUrls
    }
  });

  if (ticket) {
    const notifyUserId = session.id === ticket.requesterId ? ticket.assigneeId : ticket.requesterId;
    
    if (notifyUserId) {
      await prisma.notification.create({
        data: {
          userId: notifyUserId,
          title: `Nova mensagem no Chamado #${ticket.id.split('-')[0]}`,
          message: `${session.name} respondeu: "${content.length > 50 ? content.substring(0, 50) + '...' : content}"`,
          link: `/tickets/${ticket.id}`
        }
      });
    }
  }

  revalidatePath(`/tickets/${ticketId}`);
}

export async function resolveTicketCustomer(formData: FormData) {
  const session = await getCurrentUser();
  if (!session) throw new Error("Não autorizado");

  const ticketId = formData.get("ticketId") as string;
  const rating = Number(formData.get("rating"));
  const ratingNotes = formData.get("ratingNotes") as string;

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.requesterId !== session.id) throw new Error("Não autorizado");

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { 
      status: "FECHADO", 
      rating, 
      ratingNotes, 
      resolvedAt: new Date() 
    }
  });

  await prisma.comment.create({
    data: {
      content: `Chamado validado e finalizado pelo usuário.\nNota: ${rating}/5.\nComentário: ${ratingNotes || "Sem comentários."}`,
      ticketId,
      authorId: session.id,
      isSystem: true
    }
  });

  // Notificar o atendente
  if (ticket.assigneeId) {
    await prisma.notification.create({
      data: {
        userId: ticket.assigneeId,
        title: `Chamado Finalizado! (#${ticket.id.split('-')[0]})`,
        message: `O cliente finalizou a solicitação "${ticket.title}" e deixou uma avaliação de ${rating} estrelas.`,
        link: `/tickets/${ticket.id}`
      }
    });
  }

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath('/tickets');
}

export async function reopenTicketCustomer(formData: FormData) {
  const session = await getCurrentUser();
  if (!session) throw new Error("Não autorizado");

  const ticketId = formData.get("ticketId") as string;
  const reason = formData.get("reason") as string;

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.requesterId !== session.id) throw new Error("Não autorizado");

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: "EM_ATENDIMENTO",
      // A solução foi rejeitada: os marcos de correção voltam a ficar em aberto
      // para que o relógio de SLA não conte um fechamento que não se sustentou.
      resolvedAt: null,
      definitiveFixAt: null,
      outcome: null,
    }
  });

  await prisma.comment.create({
    data: {
      content: `O usuário rejeitou a solução e o chamado foi REABERTO.\nMotivo: ${reason}`,
      ticketId,
      authorId: session.id,
      isSystem: true
    }
  });

  // Notificar o atendente
  if (ticket.assigneeId) {
    await prisma.notification.create({
      data: {
        userId: ticket.assigneeId,
        title: `Chamado Reaberto! (#${ticket.id.split('-')[0]})`,
        message: `O cliente rejeitou a solução da solicitação "${ticket.title}". Motivo: ${reason.substring(0, 50)}...`,
        link: `/tickets/${ticket.id}`
      }
    });
  }

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath('/tickets');
}
