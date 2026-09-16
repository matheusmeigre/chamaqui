import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlarmClock,
  ArrowUpRight,
  Bell,
  BellOff,
  Check,
  CheckCheck,
  Flame,
  Gauge,
  MessageSquare,
  RefreshCcw,
  Scale,
  type LucideIcon,
} from "lucide-react";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { markAllNotificationsAsRead, markNotificationAsRead } from "@/app/actions/notifications";
import { NotificationLink } from "@/components/notifications/NotificationLink";
import { FormattedDate } from "@/components/FormattedDate";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { cn } from "@/lib/ui";

type Kind = { icon: LucideIcon; tone: string };

/**
 * O modelo não guarda o tipo da notificação; o título já carrega a intenção.
 * A inferência só escolhe o ícone — nada de lógica depende dela.
 */
function kindOf(title: string): Kind {
  const text = title.toLowerCase();
  if (/p1|crític|rajada/.test(text)) return { icon: Flame, tone: "bg-critical-soft text-critical-ink" };
  if (/sla|prazo|venc/.test(text)) return { icon: AlarmClock, tone: "bg-warning-soft text-warning-ink" };
  if (/teto|cota|excedente|consumo/.test(text)) return { icon: Gauge, tone: "bg-serious-soft text-serious-ink" };
  if (/contesta/.test(text)) return { icon: Scale, tone: "bg-brand-soft text-brand-ink" };
  if (/coment|mensagem|resposta/.test(text)) return { icon: MessageSquare, tone: "bg-brand-soft text-brand-ink" };
  if (/reab|status|atualiz/.test(text)) return { icon: RefreshCcw, tone: "bg-surface-3 text-ink-2" };
  return { icon: Bell, tone: "bg-surface-3 text-ink-2" };
}

const DAY_KEY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function groupLabel(date: Date, now: Date): string {
  const key = DAY_KEY.format(date);
  if (key === DAY_KEY.format(now)) return "Hoje";
  if (key === DAY_KEY.format(new Date(now.getTime() - 86_400_000))) return "Ontem";
  const days = (now.getTime() - date.getTime()) / 86_400_000;
  if (days < 7) return "Nesta semana";
  if (days < 31) return "Neste mês";
  return "Anteriores";
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  const { filter } = await searchParams;
  const onlyUnread = filter === "unread";

  const [notifications, totalCount, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.id, ...(onlyUnread ? { read: false } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.notification.count({ where: { userId: session.id } }),
    prisma.notification.count({ where: { userId: session.id, read: false } }),
  ]);

  const now = new Date();
  const groups: Array<{ label: string; items: typeof notifications }> = [];
  for (const notification of notifications) {
    const label = groupLabel(notification.createdAt, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(notification);
    else groups.push({ label, items: [notification] });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Notificações"
        description={
          unreadCount > 0
            ? `Você tem ${unreadCount} ${unreadCount === 1 ? "notificação não lida" : "notificações não lidas"}.`
            : "Tudo em dia — nenhuma notificação pendente."
        }
        actions={
          unreadCount > 0 ? (
            <form
              action={async () => {
                "use server";
                await markAllNotificationsAsRead();
              }}
            >
              <button
                type="submit"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-sm font-medium text-ink-2 transition hover:border-line-strong hover:text-ink"
              >
                <CheckCheck size={15} />
                Marcar todas como lidas
              </button>
            </form>
          ) : undefined
        }
      />

      <nav aria-label="Filtro" className="flex gap-1">
        {[
          { key: "all", label: "Todas", count: totalCount, href: "/notifications" },
          { key: "unread", label: "Não lidas", count: unreadCount, href: "/notifications?filter=unread" },
        ].map((tab) => {
          const active = (tab.key === "unread") === onlyUnread;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition",
                active ? "bg-surface text-ink shadow-card ring-1 ring-line" : "text-ink-3 hover:bg-surface hover:text-ink-2"
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                  active ? "bg-brand-soft text-brand-ink" : "bg-surface-3 text-ink-3"
                )}
              >
                {tab.count}
              </span>
            </Link>
          );
        })}
      </nav>

      {notifications.length === 0 ? (
        <Card>
          <EmptyState
            icon={onlyUnread ? <CheckCheck size={20} /> : <BellOff size={20} />}
            title={onlyUnread ? "Nenhuma notificação não lida" : "Nenhuma notificação ainda"}
            description="Alertas de SLA, teto e atualizações dos seus chamados aparecem aqui."
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.label} aria-label={group.label} className="space-y-2">
              <h3 className="px-1 text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">
                {group.label}
              </h3>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-line">
                  {group.items.map((notification) => {
                    const kind = kindOf(notification.title);
                    const unread = !notification.read;

                    return (
                      <li
                        key={notification.id}
                        className={cn("relative flex gap-3 px-4 py-3.5 transition sm:px-5", unread && "bg-brand-soft/40")}
                      >
                        {unread && (
                          <span aria-hidden className="absolute inset-y-3 left-0 w-0.5 rounded-r-full bg-brand" />
                        )}
                        <span className={cn("mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl", kind.tone)}>
                          <kind.icon size={16} />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                            <p className={cn("text-sm", unread ? "font-semibold text-ink" : "font-medium text-ink-2")}>
                              {notification.title}
                              {unread && <span className="sr-only"> (não lida)</span>}
                            </p>
                            <span className="shrink-0 text-xs text-ink-3">
                              <FormattedDate date={notification.createdAt} pattern="dd/MM HH:mm" />
                            </span>
                          </div>
                          <p className="mt-0.5 text-sm text-ink-3">{notification.message}</p>

                          <div className="mt-2 flex flex-wrap items-center gap-1">
                            {notification.link && (
                              <NotificationLink
                                id={notification.id}
                                href={notification.link}
                                className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-brand-ink transition hover:bg-brand-soft"
                              >
                                Abrir <ArrowUpRight size={13} />
                              </NotificationLink>
                            )}
                            {unread && (
                              <form
                                action={async () => {
                                  "use server";
                                  await markNotificationAsRead(notification.id);
                                }}
                              >
                                <button
                                  type="submit"
                                  className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-medium text-ink-3 transition hover:bg-surface-3 hover:text-ink"
                                >
                                  <Check size={13} />
                                  Marcar como lida
                                </button>
                              </form>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
