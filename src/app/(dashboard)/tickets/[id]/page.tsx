import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft, User, Calendar, Tag, MessageCircle } from "lucide-react";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { updateTicketStatus, addComment } from "@/app/actions/tickets";
import { SubmitButton } from "../new/submit-button"; // Reutilizando
import { ImageGallery } from "./image-gallery";
import { RequesterActions } from "./requester-actions";

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const ticket = await prisma.ticket.findUnique({
    where: { id: resolvedParams.id },
    include: {
      category: true,
      requester: true,
      assignee: true,
      comments: {
        include: { author: true },
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!ticket) redirect("/tickets");

  const isAttendantOrAdmin = session.user.role === "ATENDENTE" || session.user.role === "ADMINISTRADOR";
  const canChangeStatus = isAttendantOrAdmin;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header com voltar */}
      <div className="flex items-center gap-4">
        <Link href="/tickets" className="p-2 hover:bg-slate-200 rounded-full transition text-slate-500">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-gray-800 line-clamp-1">{ticket.title}</h2>
          <p className="text-slate-500 text-sm">#{ticket.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Principal - Descrição e Comentários */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Descrição do Problema</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
            
            {ticket.attachmentUrls && ticket.attachmentUrls.length > 0 && (
              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-sm font-semibold text-gray-600 mb-3">Anexos Iniciais ({ticket.attachmentUrls.length})</h4>
                <ImageGallery urls={ticket.attachmentUrls} />
              </div>
            )}
          </div>

          {/* Componente de Ação do Solicitante (Avaliar ou Reabrir) */}
          {session.user.id === ticket.requesterId && (ticket.status === "PENDENTE" || ticket.status === "RESOLVIDO") && (
            <RequesterActions ticketId={ticket.id} />
          )}

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <MessageCircle size={20} /> Histórico de Interações
            </h3>
            
            <div className="space-y-4">
              {ticket.comments.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-4">Nenhum comentário ainda.</p>
              )}
              {ticket.comments.map((comment) => (
                <div key={comment.id} className={`flex ${comment.isSystem ? 'justify-center' : 'flex-col'}`}>
                  {comment.isSystem ? (
                    <span className="bg-slate-100 text-slate-600 text-xs px-3 py-1 rounded-full font-medium">
                      {comment.content} • {format(new Date(comment.createdAt), "dd/MM HH:mm")}
                    </span>
                  ) : (
                    <div className={`p-4 rounded-lg text-sm ${comment.authorId === session.user.id ? 'bg-blue-50 border border-blue-100' : 'bg-slate-50 border border-slate-100'}`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-gray-800">{comment.author.name}</span>
                        <span className="text-xs text-slate-400">{format(new Date(comment.createdAt), "dd/MM/yyyy HH:mm")}</span>
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                      
                      {comment.attachmentUrls && comment.attachmentUrls.length > 0 && (
                        <div className="mt-3">
                          <ImageGallery urls={comment.attachmentUrls} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Adicionar Comentário */}
            {ticket.status !== "FECHADO" && ticket.status !== "CANCELADO" && (
              <form action={async (formData) => {
                "use server"
                await addComment(formData);
              }} className="pt-4 border-t border-slate-200 space-y-3">
                <input type="hidden" name="ticketId" value={ticket.id} />
                <textarea 
                  name="content"
                  required
                  rows={3}
                  className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm text-slate-900 bg-white"
                  placeholder="Escreva sua resposta ou atualização..."
                ></textarea>
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <label htmlFor="attachments" className="text-xs font-medium text-slate-600 block mb-1 cursor-pointer">Anexar imagens:</label>
                    <input 
                      type="file" 
                      name="attachments" 
                      id="attachments" 
                      multiple 
                      accept="image/*"
                      className="text-xs text-slate-700 file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                    />
                  </div>
                  <button type="submit" className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition">
                    Enviar Mensagem
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Coluna Sidebar - Meta Info e Ações */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Detalhes</h3>
            
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1"><Tag size={16}/> Status</span>
                <span className="font-medium bg-slate-100 px-2 py-1 rounded text-slate-700">{ticket.status}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1"><User size={16}/> Solicitante</span>
                <span className="font-medium">{ticket.requester.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1"><User size={16}/> Atendente</span>
                <span className="font-medium">{ticket.assignee?.name || "Não atribuído"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1"><Calendar size={16}/> Aberto em</span>
                <span className="font-medium">{format(new Date(ticket.createdAt), "dd/MM/yyyy HH:mm")}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1"><Tag size={16}/> Categoria</span>
                <span className="font-medium">{ticket.category.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 flex items-center gap-1"><Tag size={16}/> SLA Padrão</span>
                <span className="font-medium">{ticket.category.defaultSlaHours}h</span>
              </div>
            </div>
          </div>

          {canChangeStatus && (
            <div className="bg-blue-50 rounded-xl shadow-sm border border-blue-100 p-6 space-y-4">
              <h3 className="text-lg font-semibold text-blue-900 border-b border-blue-200 pb-2">Ações Técnicas</h3>
              <form action={async (formData) => {
                "use server"
                const newStatus = formData.get("status") as string;
                await updateTicketStatus(ticket.id, newStatus);
              }} className="space-y-3">
                <label className="block text-sm font-medium text-blue-800">Alterar Status e Assumir</label>
                <select name="status" defaultValue={ticket.status} className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white outline-none text-slate-900">
                  <option value="ABERTO">Aberto</option>
                  <option value="EM_TRIAGEM">Em Triagem</option>
                  <option value="EM_ATENDIMENTO">Em Atendimento</option>
                  <option value="PENDENTE">Pendente (Aguardando Retorno)</option>
                  <option value="RESOLVIDO">Resolvido</option>
                  <option value="FECHADO">Fechado</option>
                  <option value="CANCELADO">Cancelado</option>
                </select>
                <button type="submit" className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
                  Confirmar Ação
                </button>
              </form>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
