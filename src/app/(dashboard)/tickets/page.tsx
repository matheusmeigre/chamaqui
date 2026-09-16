import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Inbox, PlusCircle, UserRound } from "lucide-react";
import type { Prisma, Severity, TicketCategoryCode, TicketStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { FormattedDate } from "@/components/FormattedDate";
import { ButtonLink, Card, EmptyState, PageHeader, TableShell, Td, Th } from "@/components/ui";
import {
  CategoryBadge,
  SeverityBadge,
  STATUS_DOT,
  STATUS_LABEL,
  STATUS_ORDER,
  StatusBadge,
} from "@/components/domain/labels";
import { SlaChip } from "@/components/domain/SlaChip";
import { CATEGORY_ORDER, SEVERITY_ORDER } from "@/server/domain/ticket-grid";
import { loadBusinessCalendar } from "@/server/services/business-hours";
import { assessSla } from "@/server/services/sla-service";
import { summarizeSla } from "@/server/services/sla-summary";
import { cn, formatAge, initialsOf, shortId } from "@/lib/ui";
import { TicketFilters } from "./ticket-filters";

const PAGE_SIZE = 20;
const BOARD_LIMIT = 80;

const VIEWS = {
  all: { statuses: null as TicketStatus[] | null },
  active: { statuses: ["ABERTO", "EM_TRIAGEM", "EM_ATENDIMENTO", "PENDENTE"] as TicketStatus[] },
  awaiting: { statuses: ["PENDENTE", "RESOLVIDO"] as TicketStatus[] },
  done: { statuses: ["FECHADO", "CANCELADO"] as TicketStatus[] },
};

type ViewKey = keyof typeof VIEWS;

const BOARD_COLUMNS: TicketStatus[] = ["ABERTO", "EM_TRIAGEM", "EM_ATENDIMENTO", "PENDENTE", "RESOLVIDO"];

type SearchParams = {
  q?: string;
  view?: string;
  status?: string;
  severity?: string;
  category?: string;
  org?: string;
  sort?: string;
  layout?: string;
  page?: string;
  assignee?: string;
  opened?: string;
};

function pick<T extends string>(value: string | undefined, allowed: readonly T[]): T | null {
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

/** Filtro de vários valores na URL: "ABERTO,PENDENTE". Valores desconhecidos caem fora. */
function pickMany<T extends string>(value: string | undefined, allowed: readonly T[]): T[] {
  if (!value) return [];
  const unique = new Set(value.split(",").map((item) => item.trim()));
  return allowed.filter((item) => unique.has(item));
}

/** Início da janela "aberto nos últimos N dias" — o relógio fica fora da renderização. */
function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  const params = await searchParams;
  const isAdmin = session.role === "ADMINISTRADOR";

  const view: ViewKey = pick(params.view, ["all", "active", "awaiting", "done"] as const) ?? "all";
  const statuses = pickMany(params.status, STATUS_ORDER);
  const severities = pickMany(params.severity, SEVERITY_ORDER);
  const categories = pickMany(params.category, CATEGORY_ORDER);
  const assignee = isAdmin ? pick(params.assignee, ["me", "none"] as const) : null;
  const opened = pick(params.opened, ["7", "30", "90"] as const);
  const layout = params.layout === "board" ? "board" : "list";
  const sort = pick(params.sort, ["updated", "opened", "oldest", "severity"] as const) ?? "updated";
  const q = (params.q ?? "").trim();
  const page = Math.max(1, Number(params.page) || 1);

  const organizations = isAdmin
    ? await prisma.organization.findMany({
        where: { enabled: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : null;
  const org = isAdmin ? (organizations?.find((item) => item.id === params.org)?.id ?? null) : null;

  /* --- Recorte ------------------------------------------------------------ */
  const scope: Prisma.TicketWhereInput = isAdmin
    ? org
      ? { requester: { organizationId: org } }
      : {}
    : { requesterId: session.id };

  const filters: Prisma.TicketWhereInput[] = [scope];
  if (severities.length) filters.push({ severity: { in: severities } });
  if (categories.length) filters.push({ categoryCode: { in: categories } });
  if (assignee === "me") filters.push({ assigneeId: session.id });
  if (assignee === "none") filters.push({ assigneeId: null });
  if (opened) filters.push({ openedAt: { gte: daysAgo(Number(opened)) } });
  if (q) {
    filters.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { id: { startsWith: q.toLowerCase().replace(/^#/, "") } },
      ],
    });
  }

  // As abas contam sobre os filtros, mas antes do próprio recorte de status.
  const baseWhere: Prisma.TicketWhereInput = { AND: filters };

  const statusFilter: Prisma.TicketWhereInput[] = [];
  const viewStatuses = VIEWS[view].statuses;
  if (viewStatuses) statusFilter.push({ status: { in: viewStatuses } });
  if (statuses.length) statusFilter.push({ status: { in: statuses } });
  if (layout === "board" && statuses.length === 0 && !viewStatuses) {
    statusFilter.push({ status: { in: BOARD_COLUMNS } });
  }

  const where: Prisma.TicketWhereInput = { AND: [...filters, ...statusFilter] };

  const orderBy: Prisma.TicketOrderByWithRelationInput[] =
    sort === "opened"
      ? [{ openedAt: "desc" }]
      : sort === "oldest"
        ? [{ openedAt: "asc" }]
        : sort === "severity"
          ? [{ severity: { sort: "asc", nulls: "last" } }, { openedAt: "asc" }]
          : [{ updatedAt: "desc" }];

  const [statusGroups, total, tickets, calendar] = await Promise.all([
    prisma.ticket.groupBy({ by: ["status"], where: baseWhere, _count: { _all: true } }),
    prisma.ticket.count({ where }),
    prisma.ticket.findMany({
      where,
      orderBy,
      skip: layout === "board" ? 0 : (page - 1) * PAGE_SIZE,
      take: layout === "board" ? BOARD_LIMIT : PAGE_SIZE,
      select: {
        id: true,
        title: true,
        status: true,
        severity: true,
        categoryCode: true,
        openedAt: true,
        updatedAt: true,
        firstResponseAt: true,
        workaroundAt: true,
        definitiveFixAt: true,
        correctionClass: true,
        sentToStoreAt: true,
        storeApprovedAt: true,
        executionBlocked: true,
        overrunDecision: true,
        _count: { select: { comments: true } },
        requester: { select: { name: true } },
        assignee: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
    loadBusinessCalendar(),
  ]);

  const counts = Object.fromEntries(statusGroups.map((group) => [group.status, group._count._all])) as Partial<
    Record<TicketStatus, number>
  >;
  const countOf = (statuses: TicketStatus[] | null) =>
    (statuses ?? STATUS_ORDER).reduce((acc, item) => acc + (counts[item] ?? 0), 0);

  const rows = tickets.map((ticket) => ({
    ...ticket,
    sla: summarizeSla(assessSla(ticket, calendar)),
  }));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(
    q || statuses.length || severities.length || categories.length || org || assignee || opened
  );

  const hrefWith = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string" && value) next.set(key, value);
    }
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    return query ? `/tickets?${query}` : "/tickets";
  };

  const tabs: Array<{ key: ViewKey; label: string }> = [
    { key: "all", label: "Todos" },
    { key: "active", label: "Fila ativa" },
    { key: "awaiting", label: isAdmin ? "Aguardando cliente" : "Aguardando você" },
    { key: "done", label: "Concluídos" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title={isAdmin ? "Chamados" : "Meus chamados"}
        description={
          isAdmin
            ? "Acompanhe a fila, priorize pelo SLA e atue no que está travado."
            : "Acompanhe o andamento das suas solicitações e valide o que foi entregue."
        }
        actions={
          <ButtonLink href="/tickets/new">
            <PlusCircle size={16} />
            Novo chamado
          </ButtonLink>
        }
      />

      {/* Visões rápidas */}
      <nav aria-label="Visões" className="scroll-thin -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {tabs.map((tab) => {
          const active = view === tab.key;
          const count = countOf(VIEWS[tab.key].statuses);
          return (
            <Link
              key={tab.key}
              href={hrefWith({ view: tab.key === "all" ? null : tab.key, status: null, page: null })}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition",
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
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      <TicketFilters
        state={{
          q,
          statuses,
          severities,
          categories,
          org: org ?? "",
          assignee: assignee ?? "",
          opened: opened ?? "",
          sort,
          layout,
        }}
        isAdmin={isAdmin}
        organizations={organizations?.map((item) => ({ value: item.id, label: item.name })) ?? null}
      />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox size={20} />}
            title={hasFilters ? "Nenhum chamado com esses filtros" : "Nenhum chamado por aqui"}
            description={
              hasFilters
                ? "Ajuste a busca ou limpe os filtros para ver mais resultados."
                : "Quando um chamado for aberto, ele aparece nesta lista."
            }
            action={
              <ButtonLink href="/tickets/new" variant="outline" size="sm">
                <PlusCircle size={14} />
                Abrir chamado
              </ButtonLink>
            }
          />
        </Card>
      ) : layout === "board" ? (
        <Board rows={rows} total={total} />
      ) : (
        <>
          {/* Cartões no mobile */}
          <ul className="space-y-2.5 md:hidden">
            {rows.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/tickets/${ticket.id}`}
                  className="block rounded-2xl border border-line bg-surface p-4 shadow-card transition active:bg-surface-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-semibold text-ink">{ticket.title}</p>
                      <p className="mt-0.5 truncate text-xs text-ink-3">
                        {shortId(ticket.id)} · {ticket.requester.name}
                      </p>
                    </div>
                    <StatusBadge status={ticket.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {ticket.severity && <SeverityBadge severity={ticket.severity} withLabel={false} />}
                    {ticket.categoryCode && <CategoryBadge code={ticket.categoryCode} withLabel={false} />}
                    <SlaChip summary={ticket.sla} compact />
                  </div>
                  <p className="mt-3 border-t border-line pt-2.5 text-xs text-ink-3">
                    Atualizado <FormattedDate date={ticket.updatedAt} pattern="dd MMM, HH:mm" />
                    {ticket.assignee && ` · ${ticket.assignee.name}`}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {/* Tabela no desktop */}
          <Card className="hidden overflow-hidden md:block">
            <TableShell minWidth={960}>
              <thead>
                <tr>
                  <Th className="w-[38%]">Chamado</Th>
                  <Th>Status</Th>
                  <Th>Classificação</Th>
                  <Th>SLA</Th>
                  <Th>Responsável</Th>
                  <Th align="right">Atualizado</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((ticket) => (
                  <tr key={ticket.id} className="group relative transition hover:bg-surface-2">
                    <Td>
                      <Link
                        href={`/tickets/${ticket.id}`}
                        className="block min-w-0 after:absolute after:inset-0 after:content-['']"
                      >
                        <span className="line-clamp-1 font-semibold text-ink group-hover:text-brand-ink">
                          {ticket.title}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-ink-3">
                          {shortId(ticket.id)} · {ticket.requester.name} · {ticket.category.name}
                          {ticket._count.comments > 0 && ` · ${ticket._count.comments} interações`}
                        </span>
                      </Link>
                    </Td>
                    <Td>
                      <StatusBadge status={ticket.status} />
                      {ticket.executionBlocked && !ticket.overrunDecision && (
                        <span className="mt-1 block text-[11px] font-medium text-critical-ink">
                          Bloqueado pelo teto
                        </span>
                      )}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {ticket.categoryCode ? (
                          <CategoryBadge code={ticket.categoryCode} withLabel={false} />
                        ) : (
                          <span className="text-xs text-ink-3">Não classificado</span>
                        )}
                        {ticket.severity && <SeverityBadge severity={ticket.severity} withLabel={false} />}
                      </div>
                    </Td>
                    <Td>
                      <SlaChip summary={ticket.sla} compact />
                    </Td>
                    <Td>
                      {ticket.assignee ? (
                        <span className="flex items-center gap-2">
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-soft text-[10px] font-bold text-brand-ink">
                            {initialsOf(ticket.assignee.name)}
                          </span>
                          <span className="truncate text-xs text-ink-2">{ticket.assignee.name}</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs text-ink-3">
                          <UserRound size={13} />
                          Sem responsável
                        </span>
                      )}
                    </Td>
                    <Td align="right" className="whitespace-nowrap text-xs text-ink-3">
                      <span title={ticket.updatedAt.toISOString()}>{formatAge(ticket.updatedAt)}</span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          </Card>

          {/* Paginação */}
          <div className="flex flex-col items-center justify-between gap-3 text-sm text-ink-3 sm:flex-row">
            <p>
              Mostrando{" "}
              <span className="font-semibold text-ink">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}
              </span>{" "}
              de <span className="font-semibold text-ink">{total}</span>
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <PageLink href={hrefWith({ page: page > 2 ? String(page - 1) : null })} disabled={page <= 1}>
                  <ChevronLeft size={15} />
                  Anterior
                </PageLink>
                <span className="px-3 tabular-nums">
                  {page} / {totalPages}
                </span>
                <PageLink href={hrefWith({ page: String(page + 1) })} disabled={page >= totalPages}>
                  Próxima
                  <ChevronRight size={15} />
                </PageLink>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="inline-flex h-9 items-center gap-1 rounded-xl border border-line px-3 text-ink-3 opacity-50">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center gap-1 rounded-xl border border-line bg-surface px-3 font-medium text-ink-2 transition hover:border-line-strong hover:text-ink"
    >
      {children}
    </Link>
  );
}

type BoardRow = {
  id: string;
  title: string;
  status: TicketStatus;
  severity: Severity | null;
  categoryCode: TicketCategoryCode | null;
  updatedAt: Date;
  requester: { name: string };
  assignee: { name: string } | null;
  sla: ReturnType<typeof summarizeSla>;
  executionBlocked: boolean;
  overrunDecision: string | null;
};

/** Quadro por status: a fila vista como fluxo, da entrada à entrega. */
function Board({ rows, total }: { rows: BoardRow[]; total: number }) {
  const columns = BOARD_COLUMNS.map((status) => ({
    status,
    items: rows.filter((row) => row.status === status),
  }));
  const outside = rows.filter((row) => !BOARD_COLUMNS.includes(row.status));

  return (
    <div className="space-y-3">
      <div className="scroll-thin -mx-3.5 overflow-x-auto px-3.5 pb-2 sm:mx-0 sm:px-0">
        <div className="grid min-w-275 grid-cols-5 gap-3">
          {columns.map((column) => (
            <section key={column.status} aria-label={STATUS_LABEL[column.status]} className="flex min-w-0 flex-col rounded-2xl bg-surface-3/60 p-2">
              <header className="flex items-center justify-between px-2 py-1.5">
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: STATUS_DOT[column.status] }} aria-hidden />
                  {STATUS_LABEL[column.status]}
                </span>
                <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink-3">
                  {column.items.length}
                </span>
              </header>

              <ul className="mt-1 flex flex-col gap-2">
                {column.items.length === 0 && (
                  <li className="rounded-xl border border-dashed border-line-strong/60 px-3 py-6 text-center text-xs text-ink-3">
                    Vazio
                  </li>
                )}
                {column.items.map((ticket) => (
                  <li key={ticket.id}>
                    <Link
                      href={`/tickets/${ticket.id}`}
                      className={cn(
                        "block rounded-xl border bg-surface p-3 shadow-card transition hover:-translate-y-px hover:shadow-raised",
                        ticket.sla.state === "BREACHED"
                          ? "border-critical/40"
                          : ticket.sla.state === "RISK"
                            ? "border-warning/50"
                            : "border-line"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium text-ink-3">{shortId(ticket.id)}</span>
                        {ticket.severity && <SeverityBadge severity={ticket.severity} withLabel={false} />}
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-snug text-ink">
                        {ticket.title}
                      </p>
                      {ticket.executionBlocked && !ticket.overrunDecision && (
                        <p className="mt-1 text-[11px] font-medium text-critical-ink">Bloqueado pelo teto</p>
                      )}
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <SlaChip summary={ticket.sla} compact />
                        <span
                          className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-surface-3 text-[9px] font-bold text-ink-2"
                          title={ticket.assignee ? `Responsável: ${ticket.assignee.name}` : `Solicitante: ${ticket.requester.name}`}
                        >
                          {initialsOf(ticket.assignee?.name ?? ticket.requester.name)}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>

      <p className="text-xs text-ink-3">
        {total > rows.length
          ? `Quadro mostra os ${rows.length} chamados atualizados mais recentemente de ${total}. Use filtros para focar.`
          : `${rows.length} ${rows.length === 1 ? "chamado" : "chamados"} no quadro.`}
        {outside.length > 0 && ` ${outside.length} em status fora das colunas (fechado/cancelado) não aparecem aqui.`}
      </p>
    </div>
  );
}
