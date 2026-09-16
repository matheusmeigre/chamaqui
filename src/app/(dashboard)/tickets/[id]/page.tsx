import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarDays,
  ChevronRight,
  Clock,
  Gauge,
  Hash,
  Layers,
  Link2,
  MessageSquare,
  Paperclip,
  Radio,
  Star,
  Tag,
  Timer,
  UserRound,
  Wrench,
} from "lucide-react";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { FormattedDate } from "@/components/FormattedDate";
import { Card, CardBody, CardHeader } from "@/components/ui";
import { SlaPanel } from "@/components/grid/SlaPanel";
import { LifecycleStepper } from "@/components/domain/LifecycleStepper";
import {
  CategoryBadge,
  OutcomeBadge,
  PriorityBadge,
  SeverityBadge,
  StatusBadge,
} from "@/components/domain/labels";
import { CATEGORY_DEFINITIONS } from "@/server/domain/ticket-grid";
import { assessSla } from "@/server/services/sla-service";
import { loadBusinessCalendar } from "@/server/services/business-hours";
import { checkExecutionGate } from "@/server/services/quota-service";
import { competencyOf } from "@/server/services/ticket-classification";
import { expireOverdueContestations } from "@/server/services/quota-alerts";
import { cn, formatAge, initialsOf, shortId } from "@/lib/ui";
import { ImageGallery } from "./image-gallery";
import { RequesterActions } from "./requester-actions";
import { GridActions } from "./grid-actions";
import { ClientGridPanel } from "./client-grid-panel";
import { TechStatusForm } from "./tech-status-form";
import { CommentComposer } from "./comment-composer";

const CHANNEL_LABEL = {
  PORTAL: "Portal",
  EMAIL: "E-mail",
  TELEFONE: "Telefone",
  PRESENCIAL: "Presencial",
  OUTRO: "Outro",
} as const;

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;

  const session = await getCurrentUser();
  if (!session) redirect("/login");

  // Sem manifestação no prazo, a categoria atribuída é mantida.
  await expireOverdueContestations();

  const ticket = await prisma.ticket.findFirst({
    where: {
      id: resolvedParams.id,
      ...(session.role === "SOLICITANTE" ? { requesterId: session.id } : {}),
    },
    include: {
      category: true,
      requester: true,
      assignee: true,
      comments: {
        include: { author: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket) redirect("/tickets");

  const isAdmin = session.role === "ADMINISTRADOR";

  // --- Grade de Chamados ----------------------------------------------------
  const calendar = await loadBusinessCalendar();
  const sla = assessSla(ticket, calendar);

  const organizationId = ticket.requester.organizationId;
  const gate = organizationId
    ? await checkExecutionGate({
        organizationId,
        categoryCode: ticket.categoryCode,
        competency: ticket.competency ?? competencyOf(ticket.openedAt),
        overrunDecisionAlreadyTaken: ticket.overrunDecision !== null,
      })
    : ({ allowed: true } as const);

  const categoryDefinition = ticket.categoryCode ? CATEGORY_DEFINITIONS[ticket.categoryCode] : null;
  const isClosed = ticket.status === "FECHADO" || ticket.status === "CANCELADO";
  const humanComments = ticket.comments.filter((comment) => !comment.isSystem).length;
  const attachmentsCount =
    ticket.attachmentUrls.length +
    ticket.comments.reduce((acc, comment) => acc + comment.attachmentUrls.length, 0);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Trilha */}
      <nav aria-label="Trilha" className="flex items-center gap-1 text-sm text-ink-3">
        <Link href="/tickets" className="rounded-md px-1 hover:text-ink">
          Chamados
        </Link>
        <ChevronRight size={14} />
        <span className="font-medium text-ink-2">{shortId(ticket.id)}</span>
      </nav>

      {/* Cabeçalho do chamado */}
      <Card className="animate-fade-up overflow-hidden">
        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={ticket.status} />
            {ticket.categoryCode && <CategoryBadge code={ticket.categoryCode} />}
            {ticket.severity ? (
              <SeverityBadge severity={ticket.severity} />
            ) : (
              <PriorityBadge priority={ticket.priority} />
            )}
            {ticket.outcome && <OutcomeBadge outcome={ticket.outcome} />}
          </div>

          <div>
            <h2 className="text-balance text-xl font-bold tracking-tight text-ink sm:text-2xl">
              {ticket.title}
            </h2>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-3">
              <span className="inline-flex items-center gap-1.5">
                <UserRound size={14} />
                {ticket.requester.name}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays size={14} />
                Aberto <FormattedDate date={ticket.openedAt} pattern="dd/MM/yyyy 'às' HH:mm" />
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock size={14} />
                Atualizado {formatAge(ticket.updatedAt)}
              </span>
            </p>
          </div>
        </div>

        <div className="border-t border-line bg-surface-2 px-4 py-4 sm:px-6">
          <LifecycleStepper status={ticket.status} />
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ------------------------------------------------------------ */}
        {/* Coluna principal                                              */}
        {/* ------------------------------------------------------------ */}
        <div className="min-w-0 space-y-5 lg:col-span-2">
          {session.id === ticket.requesterId &&
            (ticket.status === "PENDENTE" || ticket.status === "RESOLVIDO") && (
              <RequesterActions ticketId={ticket.id} />
            )}

          <ClientGridPanel
            ticketId={ticket.id}
            categoryCode={ticket.categoryCode}
            contestationOpenedAt={ticket.contestationOpenedAt}
            contestationDeadline={ticket.contestationDeadline}
            contestationDecision={ticket.contestationDecision}
            overrunDecision={ticket.overrunDecision}
            quotaExceeded={!gate.allowed}
            quotaMessage={gate.allowed ? null : gate.message}
          />

          <Card>
            <CardHeader title="Descrição" icon={<Layers size={16} />} />
            <CardBody className="space-y-5">
              <p className="whitespace-pre-wrap wrap-break-word text-[15px] leading-relaxed text-ink-2">
                {ticket.description}
              </p>

              {ticket.attachmentUrls.length > 0 && (
                <div className="space-y-2.5 border-t border-line pt-4">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">
                    <Paperclip size={13} />
                    Anexos iniciais ({ticket.attachmentUrls.length})
                  </p>
                  <ImageGallery urls={ticket.attachmentUrls} />
                </div>
              )}
            </CardBody>
          </Card>

          {ticket.rating !== null && (
            <Card>
              <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-0.5" aria-label={`Avaliação: ${ticket.rating} de 5`}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={20}
                      className={star <= ticket.rating! ? "fill-warning text-warning" : "text-line-strong"}
                    />
                  ))}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">Avaliação do solicitante</p>
                  {ticket.ratingNotes && (
                    <p className="mt-0.5 text-sm text-ink-2">“{ticket.ratingNotes}”</p>
                  )}
                </div>
              </CardBody>
            </Card>
          )}

          {/* Conversa */}
          <Card>
            <CardHeader
              icon={<MessageSquare size={16} />}
              title="Histórico e conversa"
              subtitle={`${humanComments} ${humanComments === 1 ? "mensagem" : "mensagens"} · ${ticket.comments.length - humanComments} eventos do sistema`}
            />
            <CardBody className="space-y-5">
              {ticket.comments.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-3">
                  Nenhuma interação ainda. Use o campo abaixo para enviar uma atualização.
                </p>
              ) : (
                <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-4.25 before:top-2 before:w-px before:bg-line">
                  {ticket.comments.map((comment) => {
                    if (comment.isSystem) {
                      return (
                        <li key={comment.id} className="relative flex items-start gap-3 pl-0">
                          <span className="relative z-10 grid h-9 w-9 shrink-0 place-items-center">
                            <span className="h-2.5 w-2.5 rounded-full border-2 border-surface bg-line-strong ring-4 ring-surface" />
                          </span>
                          <p className="min-w-0 pt-2 text-xs text-ink-3">
                            <span className="text-ink-2">{comment.content}</span>
                            {" · "}
                            <FormattedDate date={comment.createdAt} pattern="dd/MM HH:mm" />
                          </p>
                        </li>
                      );
                    }

                    const mine = comment.authorId === session.id;
                    const staff = comment.author.role === "ADMINISTRADOR";

                    return (
                      <li key={comment.id} className="relative flex items-start gap-3">
                        <span
                          className={cn(
                            "relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold ring-4 ring-surface",
                            staff ? "bg-brand text-on-brand" : "bg-surface-3 text-ink-2"
                          )}
                          aria-hidden
                        >
                          {initialsOf(comment.author.name)}
                        </span>
                        <div
                          className={cn(
                            "min-w-0 flex-1 rounded-2xl rounded-tl-md border px-4 py-3",
                            mine ? "border-brand/25 bg-brand-soft" : "border-line bg-surface-2"
                          )}
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                            <p className="text-sm font-semibold text-ink">
                              {comment.author.name}
                              {staff && (
                                <span className="ml-1.5 rounded bg-surface px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-ink">
                                  Suporte
                                </span>
                              )}
                            </p>
                            <span className="text-[11px] text-ink-3">
                              <FormattedDate date={comment.createdAt} pattern="dd/MM/yyyy HH:mm" />
                            </span>
                          </div>
                          <p className="mt-1.5 whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-ink-2">
                            {comment.content}
                          </p>
                          {comment.attachmentUrls.length > 0 && (
                            <div className="mt-3">
                              <ImageGallery urls={comment.attachmentUrls} />
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}

              {isClosed ? (
                <p className="rounded-xl bg-surface-2 px-4 py-3 text-center text-sm text-ink-3">
                  Chamado {ticket.status === "FECHADO" ? "fechado" : "cancelado"}: a conversa está
                  encerrada.
                </p>
              ) : (
                <CommentComposer ticketId={ticket.id} />
              )}
            </CardBody>
          </Card>
        </div>

        {/* ------------------------------------------------------------ */}
        {/* Coluna lateral                                                */}
        {/* ------------------------------------------------------------ */}
        <aside className="min-w-0 space-y-5">
          <Card>
            <CardHeader title="Detalhes" icon={<Tag size={16} />} />
            <dl className="divide-y divide-line text-sm">
              <DetailRow icon={<Hash size={14} />} label="Identificador">
                <span className="font-mono text-xs" title={ticket.id}>
                  {shortId(ticket.id)}
                </span>
              </DetailRow>
              <DetailRow icon={<UserRound size={14} />} label="Solicitante">
                {ticket.requester.name}
              </DetailRow>
              <DetailRow icon={<Wrench size={14} />} label="Responsável">
                {ticket.assignee ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-soft text-[9px] font-bold text-brand-ink">
                      {initialsOf(ticket.assignee.name)}
                    </span>
                    {ticket.assignee.name}
                  </span>
                ) : (
                  <span className="text-ink-3">Não atribuído</span>
                )}
              </DetailRow>
              <DetailRow icon={<Tag size={14} />} label="Categoria técnica">
                {ticket.category.name}
              </DetailRow>
              <DetailRow icon={<Layers size={14} />} label="Natureza">
                {categoryDefinition ? (
                  `${ticket.categoryCode} · ${categoryDefinition.label}`
                ) : (
                  <span className="text-critical-ink">Não classificado</span>
                )}
              </DetailRow>
              {categoryDefinition &&
                categoryDefinition.unit !== "CHAMADO" &&
                categoryDefinition.unit !== "PROJETO" && (
                  <DetailRow icon={<Gauge size={14} />} label="Unidades">
                    {ticket.units}{" "}
                    {ticket.units === 1 ? categoryDefinition.unitLabel.one : categoryDefinition.unitLabel.many}
                  </DetailRow>
                )}
              <DetailRow icon={<Radio size={14} />} label="Canal">
                {CHANNEL_LABEL[ticket.channel]}
              </DetailRow>
              <DetailRow icon={<CalendarDays size={14} />} label="Competência">
                {ticket.competency ?? "—"}
              </DetailRow>
              <DetailRow icon={<Gauge size={14} />} label="Consome teto">
                {ticket.consumesQuota ? "Sim" : "Não"}
              </DetailRow>
              {ticket.actualHours !== null && (
                <DetailRow icon={<Timer size={14} />} label="Esforço real">
                  {ticket.actualHours.toLocaleString("pt-BR")} h
                </DetailRow>
              )}
              {attachmentsCount > 0 && (
                <DetailRow icon={<Paperclip size={14} />} label="Anexos">
                  {attachmentsCount}
                </DetailRow>
              )}
              {ticket.parentTicketId && (
                <DetailRow icon={<Link2 size={14} />} label="Reincidência de">
                  <Link
                    href={`/tickets/${ticket.parentTicketId}`}
                    className="font-medium text-brand-ink hover:underline"
                  >
                    {shortId(ticket.parentTicketId)}
                  </Link>
                </DetailRow>
              )}
            </dl>
          </Card>

          <SlaPanel assessment={sla} />

          {isAdmin && <TechStatusForm ticketId={ticket.id} currentStatus={ticket.status} />}

          {isAdmin && (
            <GridActions
              ticketId={ticket.id}
              categoryCode={ticket.categoryCode}
              severity={ticket.severity}
              units={ticket.units}
              actualHours={ticket.actualHours}
              correctionClass={ticket.correctionClass}
              sentToStoreAt={ticket.sentToStoreAt}
              storeApprovedAt={ticket.storeApprovedAt}
              workaroundAt={ticket.workaroundAt}
              contestationOpen={Boolean(ticket.contestationOpenedAt) && !ticket.contestationDecision}
              contestationReason={ticket.contestationReason}
            />
          )}
        </aside>
      </div>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5 sm:px-5">
      <dt className="flex shrink-0 items-center gap-2 text-ink-3">
        {icon}
        {label}
      </dt>
      <dd className="min-w-0 text-right font-medium text-ink">{children}</dd>
    </div>
  );
}
