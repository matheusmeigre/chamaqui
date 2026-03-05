"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase";

export async function createTicket(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Não autorizado");

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const categoryId = formData.get("categoryId") as string;
  const priority = formData.get("priority") as "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";

  // Lidando com anexos (imagens)
  const files = formData.getAll("attachments") as File[];
  const attachmentUrls: string[] = [];

  for (const file of files) {
    if (file.size > 0) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `user_${session.user.id}/${fileName}`;

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

  await prisma.ticket.create({
    data: {
      title,
      description,
      priority,
      categoryId,
      requesterId: session.user.id,
      status: "ABERTO",
      attachmentUrls,
    }
  });

  revalidatePath("/tickets");
}

export async function updateTicketStatus(ticketId: string, status: any) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role === "SOLICITANTE") throw new Error("Não autorizado");

  const ticket = await prisma.ticket.update({
    where: { id: ticketId },
    data: { status, assigneeId: session.user.role === "ATENDENTE" ? session.user.id : undefined }
  });

  await prisma.comment.create({
    data: {
      content: `Status alterado para ${status}.`,
      ticketId: ticket.id,
      authorId: session.user.id,
      isSystem: true
    }
  });

  // Notificar o solicitante
  if (ticket.requesterId !== session.user.id) {
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
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Não autorizado");

  const ticketId = formData.get("ticketId") as string;
  const content = formData.get("content") as string;

  // Lidando com anexos nos comentários (opcional)
  const files = formData.getAll("attachments") as File[];
  const attachmentUrls: string[] = [];

  for (const file of files) {
    if (file.size > 0) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `comments_user_${session.user.id}/${fileName}`;

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
      authorId: session.user.id,
      isSystem: false,
      attachmentUrls
    }
  });

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  
  if (ticket) {
    const notifyUserId = session.user.id === ticket.requesterId ? ticket.assigneeId : ticket.requesterId;
    
    if (notifyUserId) {
      await prisma.notification.create({
        data: {
          userId: notifyUserId,
          title: `Nova mensagem no Chamado #${ticket.id.split('-')[0]}`,
          message: `${session.user.name} respondeu: "${content.length > 50 ? content.substring(0, 50) + '...' : content}"`,
          link: `/tickets/${ticket.id}`
        }
      });
    }
  }

  revalidatePath(`/tickets/${ticketId}`);
}

export async function resolveTicketCustomer(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Não autorizado");

  const ticketId = formData.get("ticketId") as string;
  const rating = Number(formData.get("rating"));
  const ratingNotes = formData.get("ratingNotes") as string;

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.requesterId !== session.user.id) throw new Error("Não autorizado");

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { 
      status: "RESOLVIDO", 
      rating, 
      ratingNotes, 
      resolvedAt: new Date() 
    }
  });

  await prisma.comment.create({
    data: {
      content: `Chamado validado e finalizado pelo usuário.\nNota: ${rating}/5.\nComentário: ${ratingNotes || "Sem comentários."}`,
      ticketId,
      authorId: session.user.id,
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
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Não autorizado");

  const ticketId = formData.get("ticketId") as string;
  const reason = formData.get("reason") as string;

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket || ticket.requesterId !== session.user.id) throw new Error("Não autorizado");

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: "EM_ATENDIMENTO" }
  });

  await prisma.comment.create({
    data: {
      content: `O usuário rejeitou a solução e o chamado foi REABERTO.\nMotivo: ${reason}`,
      ticketId,
      authorId: session.user.id,
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
