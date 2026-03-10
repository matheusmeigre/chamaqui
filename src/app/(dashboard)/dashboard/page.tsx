import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { headers } from "next/headers";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { NotificationLink } from "@/components/notifications/NotificationLink";
import { getDashboardActivity } from "@/server/services/dashboard-service";

type StatusDistributionItem = {
  status: string;
  count: number;
};

type DashboardMetrics = {
  totalTickets: number;
  openTickets: number;
  attendedTickets: number;
  pendingTickets: number;
  statusDistribution: StatusDistributionItem[];
};

const statusLabels: Record<string, string> = {
  ABERTO: "Aberto",
  EM_TRIAGEM: "Em Triagem",
  EM_ATENDIMENTO: "Em Atendimento",
  PENDENTE: "Pendente",
  RESOLVIDO: "Resolvido",
  FECHADO: "Fechado",
  CANCELADO: "Cancelado",
};

const statusColors: Record<string, string> = {
  ABERTO: "bg-blue-500",
  EM_TRIAGEM: "bg-purple-500",
  EM_ATENDIMENTO: "bg-amber-500",
  PENDENTE: "bg-slate-500",
  RESOLVIDO: "bg-emerald-500",
  FECHADO: "bg-slate-700",
  CANCELADO: "bg-red-500",
};

const statusPill: Record<string, string> = {
  ABERTO: "bg-blue-100 text-blue-800",
  EM_TRIAGEM: "bg-purple-100 text-purple-800",
  EM_ATENDIMENTO: "bg-amber-100 text-amber-800",
  PENDENTE: "bg-slate-100 text-slate-800",
  RESOLVIDO: "bg-emerald-100 text-emerald-800",
  FECHADO: "bg-slate-200 text-slate-800",
  CANCELADO: "bg-red-100 text-red-800",
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const headerList = await headers();
  const host = headerList.get("host");
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  const cookie = headerList.get("cookie") ?? "";
  const baseUrl = host ? `${protocol}://${host}` : "http://localhost:3000";

  const metricsResponse = await fetch(`${baseUrl}/dashboard/metrics`, {
    cache: "no-store",
    headers: cookie ? { cookie } : undefined,
  });
  const metrics: DashboardMetrics = metricsResponse.ok
    ? await metricsResponse.json()
    : {
        totalTickets: 0,
        openTickets: 0,
        attendedTickets: 0,
        pendingTickets: 0,
        statusDistribution: [],
      };

  const { recentTickets, recentNotifications } = session?.user
    ? await getDashboardActivity({ userId: session.user.id, role: session.user.role })
    : { recentTickets: [], recentNotifications: [] };

  const maxStatusCount = Math.max(
    1,
    ...metrics.statusDistribution.map((item) => item.count)
  );
  
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-gray-800">Bem-vindo, {session?.user?.name}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Total de Chamados</h3>
          <p className="text-3xl font-bold mt-2 text-gray-900">{metrics.totalTickets}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Chamados Abertos</h3>
          <p className="text-3xl font-bold mt-2 text-blue-600">{metrics.openTickets}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Chamados Atendidos</h3>
          <p className="text-3xl font-bold mt-2 text-emerald-600">{metrics.attendedTickets}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Chamados Pendentes</h3>
          <p className="text-3xl font-bold mt-2 text-amber-600">{metrics.pendingTickets}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-800">Distribuicao por Status</h3>
            <span className="text-xs text-slate-400">Ultima atualizacao</span>
          </div>
          <div className="mt-6 space-y-4">
            {metrics.statusDistribution.length === 0 ? (
              <p className="text-sm text-slate-500">Sem dados suficientes para o grafico.</p>
            ) : (
              metrics.statusDistribution.map((item) => (
                <div key={item.status} className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>{statusLabels[item.status] ?? item.status}</span>
                    <span className="font-medium text-slate-700">{item.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${statusColors[item.status] ?? "bg-slate-400"}`}
                      style={{ width: `${(item.count / maxStatusCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">Atividade Recente</h3>
          <div className="mt-4 space-y-5">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Chamados atualizados</p>
              {recentTickets.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum chamado atualizado recentemente.</p>
              ) : (
                <ul className="space-y-3">
                  {recentTickets.map((ticket) => (
                    <li key={ticket.id} className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <Link href={`/tickets/${ticket.id}`} className="text-sm font-semibold text-slate-800 hover:text-blue-600">
                          {ticket.title}
                        </Link>
                        <p className="text-xs text-slate-500">
                          {ticket.category?.name ?? "Sem categoria"} • {ticket.requester?.name ?? "Solicitante"}
                        </p>
                      </div>
                      <div className="text-right space-y-1">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusPill[ticket.status] ?? "bg-slate-100 text-slate-700"}`}>
                          {statusLabels[ticket.status] ?? ticket.status}
                        </span>
                        <p className="text-[11px] text-slate-400">
                          {format(new Date(ticket.updatedAt), "dd MMM, HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notificacoes recentes</p>
              {recentNotifications.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma notificacao recente.</p>
              ) : (
                <ul className="space-y-3">
                  {recentNotifications.map((notification) => {
                    const isRead = notification.read;
                    const content = (
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <p className={`text-sm ${isRead ? "text-slate-600" : "font-semibold text-slate-800"}`}>
                            {notification.title}
                          </p>
                          <p className="text-xs text-slate-500 line-clamp-2">{notification.message}</p>
                        </div>
                        <span className="text-[11px] text-slate-400 whitespace-nowrap">
                          {format(new Date(notification.createdAt), "dd/MM HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                    );

                    return (
                      <li key={notification.id}>
                        {notification.link ? (
                          <NotificationLink
                            id={notification.id}
                            href={notification.link}
                            className="block rounded-lg border border-slate-200 p-3 hover:border-blue-200 hover:bg-blue-50/40 transition"
                          >
                            {content}
                          </NotificationLink>
                        ) : (
                          <div className="rounded-lg border border-slate-200 p-3">
                            {content}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
