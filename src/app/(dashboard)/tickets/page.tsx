import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { PlusCircle, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusColors: any = {
  ABERTO: "bg-blue-100 text-blue-800",
  EM_TRIAGEM: "bg-purple-100 text-purple-800",
  EM_ATENDIMENTO: "bg-amber-100 text-amber-800",
  PENDENTE: "bg-gray-100 text-gray-800",
  RESOLVIDO: "bg-green-100 text-green-800",
  FECHADO: "bg-slate-200 text-slate-800",
  CANCELADO: "bg-red-100 text-red-800",
};

const priorityColors: any = {
  BAIXA: "text-green-600",
  MEDIA: "text-blue-600",
  ALTA: "text-amber-600",
  CRITICA: "text-red-600",
};

export default async function TicketsPage() {
  const session = await getServerSession(authOptions);
  
  // Filtrar chamados se for Solicitante
  const whereClause = session?.user.role === "SOLICITANTE" ? { requesterId: session.user.id } : {};

  const tickets = await prisma.ticket.findMany({
    where: whereClause,
    include: {
      category: true,
      requester: true,
      assignee: true,
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Meus Chamados</h2>
        <Link 
          href="/tickets/new"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          <PlusCircle size={20} />
          Novo Chamado
        </Link>
      </div>

      {/* Lista / Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">ID / Título</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Prioridade</th>
                <th className="px-6 py-4">Categoria</th>
                <th className="px-6 py-4">Criado em</th>
                <th className="px-6 py-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    Nenhum chamado encontrado.
                  </td>
                </tr>
              )}
              {tickets.map((ticket) => (
                <tr key={ticket.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4">
                    <p className="font-medium text-slate-900 line-clamp-1">{ticket.title}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {ticket.id.split('-')[0].toUpperCase()} • {ticket.requester.name}
                    </p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusColors[ticket.status]}`}>
                      {ticket.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium">
                    <span className={priorityColors[ticket.priority]}>{ticket.priority}</span>
                  </td>
                  <td className="px-6 py-4">{ticket.category.name}</td>
                  <td className="px-6 py-4 text-slate-500">
                    {format(new Date(ticket.createdAt), "dd MMM yyyy, HH:mm", { locale: ptBR })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link 
                      href={`/tickets/${ticket.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                    >
                      Visualizar &rarr;
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
