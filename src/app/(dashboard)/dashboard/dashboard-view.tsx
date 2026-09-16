import Link from "next/link";
import {
  Activity,
  AlarmClock,
  AlertOctagon,
  ArrowRight,
  BellRing,
  CheckCircle2,
  Clock3,
  Flame,
  Gauge,
  Hourglass,
  Inbox,
  Layers,
  ListChecks,
  RotateCcw,
  Scale,
  ShieldCheck,
  Target,
  TimerReset,
  TrendingUp,
} from "lucide-react";
import { FormattedDate } from "@/components/FormattedDate";
import { NotificationLink } from "@/components/notifications/NotificationLink";
import {
  Badge,
  ButtonLink,
  Callout,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Meter,
} from "@/components/ui";
import { StatTile } from "@/components/ui/StatTile";
import { DashboardFilters, LiveRefresh } from "@/components/ui/FilterControls";
import { TimeSeriesChart } from "@/components/charts/TimeSeriesChart";
import { BarList } from "@/components/charts/BarList";
import { StackedBars } from "@/components/charts/StackedBars";
import { Heatmap } from "@/components/charts/Heatmap";
import { RadialGauge } from "@/components/charts/RadialGauge";
import { SERIES, STATUS } from "@/components/charts/primitives";
import {
  CategoryBadge,
  QUOTA_STATE_LABEL,
  QUOTA_STATE_TONE,
  SEVERITY_TONE,
  SeverityBadge,
  STATUS_LABEL,
  StatusBadge,
} from "@/components/domain/labels";
import { CATEGORY_DEFINITIONS, SEVERITY_DEFINITIONS } from "@/server/domain/ticket-grid";
import {
  AGING_BUCKETS,
  PERIOD_OPTIONS,
  type DashboardAnalytics,
} from "@/server/services/analytics-service";
import type { getDashboardActivity } from "@/server/services/dashboard-service";
import type { QuotaSnapshot } from "@/server/services/quota-service";
import { cn, formatHours, formatNumber, formatPercent, shortId } from "@/lib/ui";

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("pt-BR", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "America/Sao_Paulo",
    }).format(new Date())
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export type DashboardActivity = Awaited<ReturnType<typeof getDashboardActivity>>;

export type DashboardViewProps = {
  userName: string;
  days: number;
  isAdmin: boolean;
  organizations: Array<{ id: string; name: string }> | null;
  organizationId: string | null;
  analytics: DashboardAnalytics;
  activity: DashboardActivity;
  quota: QuotaSnapshot | null;
};

/**
 * A dashboard sem acesso a dados: recebe tudo pronto. Separar a visão do
 * carregamento permite renderizá-la com dados de exemplo e testar o layout
 * sem sessão nem banco.
 */
export function DashboardView({
  userName,
  days,
  isAdmin,
  organizations,
  organizationId,
  analytics,
  activity,
  quota,
}: DashboardViewProps) {
  const { kpi } = analytics;
  const periodLabel = `vs. ${days} dias anteriores`;
  const focusName = isAdmin
    ? (organizations?.find((org) => org.id === organizationId)?.name ?? "Todas as organizações")
    : null;

  const quotaLines = quota?.lines.filter((line) => line.definition.hasQuota) ?? [];
  const quotaAlerts = quotaLines.filter((line) => line.state === "ALERTA" || line.state === "ESTOURADO");
  const capacityRatio =
    quota?.capacityHours ? quota.totalConsumedHours / quota.capacityHours : null;

  const slaTone =
    kpi.slaCompliance === null
      ? "neutral"
      : kpi.slaCompliance >= 0.95
        ? "good"
        : kpi.slaCompliance >= 0.8
          ? "warning"
          : "critical";

  const slaColor =
    slaTone === "good" ? STATUS.good : slaTone === "warning" ? STATUS.warning : slaTone === "critical" ? STATUS.critical : STATUS.neutral;

  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* Cabeçalho + filtros (uma linha, acima de tudo o que eles recortam)  */}
      {/* ------------------------------------------------------------------ */}
      <div className="animate-fade-up flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-3">
            {greeting()}, {userName.split(" ")[0]}
          </p>
          <h2 className="mt-0.5 text-balance text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]">
            Centro de comando
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            {focusName && <span className="font-medium text-ink">{focusName} · </span>}
            Últimos {days} dias · competência {analytics.competency}
          </p>
        </div>

        <div className="no-print flex flex-wrap items-center gap-2">
          <DashboardFilters
            period={days}
            periods={PERIOD_OPTIONS}
            organizations={organizations}
            organizationId={organizationId}
          />
          <LiveRefresh />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Alertas que pedem ação agora                                        */}
      {/* ------------------------------------------------------------------ */}
      {(kpi.breached > 0 || analytics.decisions.length > 0 || quotaAlerts.length > 0) && (
        <div className="grid gap-3 lg:grid-cols-3">
          {kpi.breached > 0 && (
            <Callout
              tone="critical"
              icon={<Flame size={16} />}
              title={`${kpi.breached} ${kpi.breached === 1 ? "chamado com SLA estourado" : "chamados com SLA estourado"}`}
            >
              Prazos contratuais já vencidos na fila ativa.{" "}
              <a href="#sla-risco" className="font-semibold underline underline-offset-2">
                Ver lista
              </a>
            </Callout>
          )}
          {analytics.decisions.length > 0 && (
            <Callout
              tone="warning"
              icon={<Scale size={16} />}
              title={`${analytics.decisions.length} ${analytics.decisions.length === 1 ? "decisão pendente" : "decisões pendentes"}`}
            >
              Excedente de teto ou contestação de categoria aguardando manifestação.{" "}
              <a href="#decisoes" className="font-semibold underline underline-offset-2">
                Resolver
              </a>
            </Callout>
          )}
          {quotaAlerts.length > 0 && (
            <Callout
              tone={quotaAlerts.some((line) => line.state === "ESTOURADO") ? "critical" : "warning"}
              icon={<Gauge size={16} />}
              title="Teto mensal sob pressão"
            >
              {quotaAlerts
                .map((line) => `${line.categoryCode} em ${formatPercent(line.ratio)}`)
                .join(" · ")}
              .{" "}
              <Link href="/reports/consumption" className="font-semibold underline underline-offset-2">
                Relatório
              </Link>
            </Callout>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Indicadores                                                         */}
      {/* ------------------------------------------------------------------ */}
      <section
        aria-label="Indicadores principais"
        className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:gap-4 lg:grid-cols-3 min-[1400px]:grid-cols-5"
      >
        <StatTile
          label="Fila ativa"
          value={formatNumber(kpi.backlog)}
          icon={<Inbox size={16} />}
          href="/tickets?view=active"
          trend={kpi.backlogTrend}
          delta={{ value: kpi.backlogDelta, period: periodLabel, goodWhen: "down" }}
          tone="brand"
        />
        <StatTile
          label="Abertos no período"
          value={formatNumber(kpi.opened)}
          icon={<TrendingUp size={16} />}
          trend={kpi.openedTrend}
          delta={{ value: kpi.openedDelta, period: periodLabel, goodWhen: "down" }}
          tone="neutral"
        />
        <StatTile
          label="Resolvidos no período"
          value={formatNumber(kpi.resolved)}
          icon={<CheckCircle2 size={16} />}
          trend={kpi.resolvedTrend}
          delta={{ value: kpi.resolvedDelta, period: periodLabel, goodWhen: "up" }}
          tone="good"
        />
        <StatTile
          label="SLA cumprido"
          className="lg:col-span-2 min-[1400px]:col-span-1"
          value={formatPercent(kpi.slaCompliance)}
          icon={<ShieldCheck size={16} />}
          caption={kpi.slaCompliance === null ? "Sem marcos de C1 no período" : undefined}
          delta={
            kpi.slaComplianceDelta !== null
              ? { value: kpi.slaComplianceDelta, period: periodLabel, goodWhen: "up", suffix: " p.p." }
              : undefined
          }
          tone={slaTone === "neutral" ? "neutral" : slaTone}
        />
        <StatTile
          label="1ª resposta média"
          className="min-[480px]:col-span-2 lg:col-span-1"
          value={formatHours(kpi.avgFirstResponseHours)}
          icon={<Clock3 size={16} />}
          caption="em horas úteis"
          delta={
            kpi.avgFirstResponseDelta !== null
              ? { value: kpi.avgFirstResponseDelta, period: periodLabel, goodWhen: "down", suffix: " h" }
              : undefined
          }
          tone="neutral"
        />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Fluxo + saúde do SLA                                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader
            icon={<Activity size={16} />}
            title="Entrada × saída da fila"
            subtitle={
              days > 45
                ? "Chamados abertos e resolvidos por semana"
                : "Chamados abertos e resolvidos por dia"
            }
            action={
              <div className="flex items-center gap-3 text-xs text-ink-3">
                <span>
                  Saldo{" "}
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      kpi.opened - kpi.resolved > 0 ? "text-critical-ink" : "text-good-ink"
                    )}
                  >
                    {kpi.opened - kpi.resolved > 0 ? "+" : ""}
                    {kpi.opened - kpi.resolved}
                  </span>
                </span>
              </div>
            }
          />
          <CardBody>
            {kpi.opened === 0 && kpi.resolved === 0 ? (
              <EmptyState
                icon={<Activity size={20} />}
                title="Sem movimento no período"
                description="Nenhum chamado foi aberto ou resolvido nestes dias. Amplie o período para comparar."
              />
            ) : (
              <TimeSeriesChart
                height={260}
                points={analytics.trend.map((point) => ({
                  label: point.label,
                  fullLabel: point.fullLabel,
                  values: { opened: point.opened, resolved: point.resolved },
                }))}
                series={[
                  { key: "opened", label: "Abertos", color: SERIES[0], area: true },
                  { key: "resolved", label: "Resolvidos", color: SERIES[1] },
                ]}
                footnote="Saldo positivo significa que a fila cresceu no período. Passe o cursor ou use as setas do teclado para ler cada ponto."
              />
            )}
          </CardBody>
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader
            icon={<ShieldCheck size={16} />}
            title="Saúde do SLA"
            subtitle="Marcos de C1 em horas úteis (9h–18h)"
          />
          <CardBody className="space-y-5">
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center xl:flex-col 2xl:flex-row">
              <RadialGauge
                ratio={kpi.slaCompliance}
                label="Marcos cumpridos no prazo"
                caption="no período"
                color={slaColor}
              />
              <dl className="grid w-full grid-cols-2 gap-2.5 sm:max-w-60 xl:max-w-none 2xl:max-w-60">
                <HealthStat
                  icon={<AlarmClock size={14} />}
                  label="Em risco"
                  value={kpi.atRisk}
                  tone={kpi.atRisk > 0 ? "warning" : "neutral"}
                />
                <HealthStat
                  icon={<AlertOctagon size={14} />}
                  label="Estourados"
                  value={kpi.breached}
                  tone={kpi.breached > 0 ? "critical" : "neutral"}
                />
                <HealthStat
                  icon={<TimerReset size={14} />}
                  label="Resolução média"
                  text={formatHours(kpi.avgResolutionHours)}
                  tone="neutral"
                />
                <HealthStat
                  icon={<RotateCcw size={14} />}
                  label="Reincidência"
                  text={formatPercent(kpi.reopenRate)}
                  tone={kpi.reopenRate !== null && kpi.reopenRate > 0.1 ? "warning" : "neutral"}
                />
              </dl>
            </div>

            {analytics.unclassified > 0 && (
              <p className="rounded-xl bg-surface-2 px-3 py-2 text-xs text-ink-2">
                <span className="font-semibold text-ink">{analytics.unclassified}</span>{" "}
                {analytics.unclassified === 1 ? "chamado ativo ainda sem" : "chamados ativos ainda sem"}{" "}
                classificação na grade — o SLA só começa a ser medido depois dela.
              </p>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Composição da fila                                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <Card>
          <CardHeader
            icon={<ListChecks size={16} />}
            title="Chamados por status"
            subtitle="Todo o histórico do recorte · clique para filtrar"
          />
          <CardBody>
            <BarList
              data={analytics.statusDistribution.map((item) => ({
                key: item.status,
                label: STATUS_LABEL[item.status],
                value: item.count,
                href: `/tickets?status=${item.status}`,
              }))}
              emptyLabel="Nenhum chamado registrado ainda."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={<ShieldCheck size={16} />}
            title="SLA por severidade"
            subtitle="Marcos dos chamados abertos no período"
          />
          <CardBody>
            <StackedBars
              emptyLabel="Nenhum chamado de C1 com severidade no período."
              rows={analytics.severityTally.map((line) => ({
                key: line.severity,
                label: line.severity,
                sublabel: `${SEVERITY_DEFINITIONS[line.severity].label} · ${line.total} ${line.total === 1 ? "chamado" : "chamados"}`,
                segments: [
                  {
                    key: "met",
                    label: "No prazo",
                    value: line.met,
                    color: STATUS.good,
                    icon: <CheckCircle2 size={11} className="text-good-ink" />,
                  },
                  {
                    key: "running",
                    label: "Em curso",
                    value: line.running,
                    color: STATUS.warning,
                    icon: <Hourglass size={11} className="text-warning-ink" />,
                  },
                  {
                    key: "breached",
                    label: "Estourado",
                    value: line.breached,
                    color: STATUS.critical,
                    icon: <AlertOctagon size={11} className="text-critical-ink" />,
                  },
                ],
              }))}
            />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2 2xl:col-span-1">
          <CardHeader
            icon={<Hourglass size={16} />}
            title="Envelhecimento da fila"
            subtitle="Chamados ativos por severidade e idade"
          />
          <CardBody>
            {kpi.backlog === 0 ? (
              <EmptyState
                icon={<CheckCircle2 size={20} />}
                title="Fila zerada"
                description="Nenhum chamado ativo neste recorte."
              />
            ) : (
              <Heatmap
                matrix={{
                  rows: analytics.aging.rows,
                  columns: AGING_BUCKETS.map((bucket) => ({
                    key: bucket.key,
                    label: bucket.label,
                    hint: bucket.hint,
                  })),
                  values: analytics.aging.values,
                }}
                footnote="Células mais intensas à direita são chamados antigos parados — o primeiro lugar para olhar."
              />
            )}
          </CardBody>
        </Card>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Operação: risco de SLA + teto                                       */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <div id="sla-risco" className="scroll-mt-24" />
          <CardHeader
            icon={<AlarmClock size={16} />}
            title="Chamados em risco de SLA"
            subtitle="Estourados ou com mais de 75% do prazo consumido, do mais urgente ao menos"
            action={
              <ButtonLink href="/tickets?view=active" variant="ghost" size="sm">
                Ver fila <ArrowRight size={13} />
              </ButtonLink>
            }
          />
          {analytics.slaRisk.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck size={20} />}
              title="Nenhum prazo em risco"
              description="Todos os marcos de SLA da fila ativa estão com folga."
            />
          ) : (
            <ul className="divide-y divide-line">
              {analytics.slaRisk.slice(0, 8).map((item) => {
                const consumed = Math.min(
                  1.2,
                  (item.targetHours - item.remainingHours) / item.targetHours
                );
                return (
                  <li key={item.id}>
                    <Link
                      href={`/tickets/${item.id}`}
                      className="grid gap-3 px-4 py-3.5 transition hover:bg-surface-2 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-center sm:px-5"
                    >
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <SeverityBadge severity={item.severity} withLabel={false} />
                          <StatusBadge status={item.status} />
                          <span className="text-xs text-ink-3">{shortId(item.id)}</span>
                        </div>
                        <p className="truncate text-sm font-semibold text-ink">{item.title}</p>
                        <p className="truncate text-xs text-ink-3">
                          {item.milestoneLabel} · {item.requesterName}
                          {item.assigneeName ? ` · com ${item.assigneeName}` : " · sem responsável"}
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            className={cn(
                              "text-sm font-bold tabular-nums",
                              item.breached ? "text-critical-ink" : "text-warning-ink"
                            )}
                          >
                            {item.breached
                              ? `+${formatHours(Math.abs(item.remainingHours))}`
                              : formatHours(item.remainingHours)}
                          </span>
                          <span className="text-[11px] text-ink-3">
                            {item.breached ? "além do prazo" : "restantes"}
                          </span>
                        </div>
                        <Meter
                          ratio={consumed}
                          tone={item.breached ? "critical" : "warning"}
                          ariaLabel={`Prazo consumido de ${item.milestoneLabel}`}
                        />
                        <p className="text-[11px] text-ink-3">
                          Prazo {formatHours(item.targetHours)}
                          {item.dueAt && (
                            <>
                              {" · vence "}
                              <FormattedDate date={item.dueAt} pattern="dd/MM HH:mm" />
                            </>
                          )}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader
            icon={<Target size={16} />}
            title="Consumo do teto"
            subtitle={
              quota
                ? `Competência ${quota.competency}${quota.tier ? ` · faixa ${quota.tier.label}` : ""}`
                : "Contrato de sustentação"
            }
            action={
              quota ? (
                <ButtonLink
                  href={`/reports/consumption${organizationId && isAdmin ? `?org=${organizationId}` : ""}`}
                  variant="ghost"
                  size="sm"
                >
                  Relatório <ArrowRight size={13} />
                </ButtonLink>
              ) : undefined
            }
          />
          {!quota ? (
            <EmptyState
              icon={<Layers size={20} />}
              title={isAdmin ? "Selecione uma organização" : "Sem organização vinculada"}
              description={
                isAdmin
                  ? "O teto é apurado por contrato. Escolha a organização no filtro acima."
                  : "Seu usuário não está vinculado a um contrato de sustentação."
              }
            />
          ) : (
            <CardBody className="space-y-4">
              {quota.capacityHours ? (
                <div className="rounded-xl bg-surface-2 p-3.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-ink-2">Capacidade do mês</span>
                    <span className="text-xs text-ink-3">
                      <span className="text-base font-bold text-ink">
                        {quota.totalConsumedHours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h
                      </span>{" "}
                      de {quota.capacityHours} h
                    </span>
                  </div>
                  <Meter
                    className="mt-2"
                    ratio={capacityRatio}
                    tone={capacityRatio !== null && capacityRatio >= 1 ? "critical" : capacityRatio !== null && capacityRatio >= 0.8 ? "warning" : "brand"}
                    ariaLabel="Capacidade contratada consumida"
                  />
                  {quota.c1ReserveHours !== null && (
                    <p className="mt-2 text-[11px] text-ink-3">
                      Reserva de C1: {quota.c1ConsumedHours.toLocaleString("pt-BR")} h de{" "}
                      {quota.c1ReserveHours} h · P1: {quota.p1ConsumedHours.toLocaleString("pt-BR")} h de{" "}
                      {quota.p1ReserveHours} h
                    </p>
                  )}
                </div>
              ) : (
                <Callout tone="warning" icon={<Scale size={14} />}>
                  Organização sem contrato ativo: consumo exibido sem teto a apurar.
                </Callout>
              )}

              <ul className="space-y-3.5">
                {quotaLines.map((line) => {
                  const tone =
                    line.state === "ESTOURADO" ? "critical" : line.state === "ALERTA" ? "warning" : "brand";
                  return (
                    <li key={line.categoryCode} className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate text-sm text-ink">
                          <span className="font-semibold">{line.categoryCode}</span>{" "}
                          <span className="text-ink-2">{line.definition.label}</span>
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-ink-3">
                          <span className="font-semibold text-ink">{line.consumedUnits}</span>
                          {line.limit !== null && ` / ${line.limit}`}
                        </span>
                      </div>
                      <Meter ratio={line.ratio} tone={tone} ariaLabel={`Teto de ${line.categoryCode}`} />
                      <div className="flex items-center justify-between gap-2">
                        <Badge tone={QUOTA_STATE_TONE[line.state]} dot>
                          {QUOTA_STATE_LABEL[line.state]}
                        </Badge>
                        <span className="text-[11px] text-ink-3">
                          {line.remaining !== null && line.remaining >= 0
                            ? `${line.remaining} ${line.remaining === 1 ? line.definition.unitLabel.one : line.definition.unitLabel.many} livres`
                            : line.remaining !== null
                              ? `${Math.abs(line.remaining)} acima do teto`
                              : ""}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          )}
        </Card>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Decisões pendentes                                                  */}
      {/* ------------------------------------------------------------------ */}
      {analytics.decisions.length > 0 && (
        <Card>
          <div id="decisoes" className="scroll-mt-24" />
          <CardHeader
            icon={<Scale size={16} />}
            title="Aguardando decisão do cliente"
            subtitle="A execução destes chamados depende de uma escolha formal"
          />
          <ul className="grid divide-y divide-line md:grid-cols-2 md:divide-x md:divide-y-0">
            {analytics.decisions.map((decision) => (
              <li key={`${decision.kind}-${decision.id}`}>
                <Link
                  href={`/tickets/${decision.id}`}
                  className="flex items-start gap-3 px-4 py-3.5 transition hover:bg-surface-2 sm:px-5"
                >
                  <span
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                      decision.kind === "EXCEDENTE"
                        ? "bg-critical-soft text-critical-ink"
                        : "bg-warning-soft text-warning-ink"
                    )}
                  >
                    {decision.kind === "EXCEDENTE" ? <Gauge size={16} /> : <Scale size={16} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{decision.title}</p>
                    <p className="mt-0.5 text-xs text-ink-3">
                      {decision.kind === "EXCEDENTE"
                        ? "Teto atingido: escolher excedente ou fila do próximo mês"
                        : "Contestação de categoria em análise"}
                      {decision.deadline && (
                        <>
                          {" · prazo "}
                          <FormattedDate date={decision.deadline} pattern="dd/MM" />
                        </>
                      )}
                    </p>
                  </div>
                  {decision.categoryCode && <CategoryBadge code={decision.categoryCode} withLabel={false} />}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Natureza, causa raiz e atividade                                    */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <Card>
          <CardHeader
            icon={<Layers size={16} />}
            title="Natureza dos chamados"
            subtitle="Abertos no período, por categoria da grade"
          />
          <CardBody>
            <BarList
              data={analytics.categoryMix.map((item) => ({
                key: item.code,
                label: `${item.code} · ${CATEGORY_DEFINITIONS[item.code].label}`,
                value: item.count,
                hint: item.hours > 0 ? `${item.hours.toLocaleString("pt-BR")} h de esforço real` : undefined,
                href: `/tickets?category=${item.code}`,
              }))}
              emptyLabel="Nenhum chamado classificado no período."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={<Target size={16} />}
            title="Causa raiz"
            subtitle="Categorias técnicas com mais chamados · P1 primeiro"
          />
          <CardBody>
            <BarList
              maxRows={6}
              data={analytics.rootCauses.map((line) => ({
                key: line.category,
                label: line.category,
                value: line.total,
                hint: line.p1 > 0 ? `${line.p1} ${line.p1 === 1 ? "incidente crítico" : "incidentes críticos"} (P1)` : undefined,
              }))}
              emptyLabel="Sem chamados no período."
            />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2 2xl:col-span-1">
          <CardHeader
            icon={<BellRing size={16} />}
            title="Atividade recente"
            action={
              <ButtonLink href="/notifications" variant="ghost" size="sm">
                Tudo <ArrowRight size={13} />
              </ButtonLink>
            }
          />
          <div className="divide-y divide-line">
            {activity.recentTickets.length === 0 && activity.recentNotifications.length === 0 ? (
              <EmptyState
                icon={<Activity size={20} />}
                title="Sem movimento recente"
                description="Atualizações de chamados e alertas aparecem aqui."
              />
            ) : (
              <>
                {activity.recentNotifications.slice(0, 3).map((notification) => {
                  const body = (
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                          notification.read ? "bg-line-strong" : "bg-brand"
                        )}
                        aria-label={notification.read ? "Lida" : "Não lida"}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "truncate text-sm",
                            notification.read ? "text-ink-2" : "font-semibold text-ink"
                          )}
                        >
                          {notification.title}
                        </p>
                        <p className="line-clamp-1 text-xs text-ink-3">{notification.message}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-ink-3">
                        <FormattedDate date={notification.createdAt} pattern="dd/MM HH:mm" />
                      </span>
                    </div>
                  );

                  return notification.link ? (
                    <NotificationLink
                      key={notification.id}
                      id={notification.id}
                      href={notification.link}
                      className="block px-4 py-3 transition hover:bg-surface-2 sm:px-5"
                    >
                      {body}
                    </NotificationLink>
                  ) : (
                    <div key={notification.id} className="px-4 py-3 sm:px-5">
                      {body}
                    </div>
                  );
                })}

                {activity.recentTickets.map((ticket) => (
                  <Link
                    key={ticket.id}
                    href={`/tickets/${ticket.id}`}
                    className="flex items-start gap-3 px-4 py-3 transition hover:bg-surface-2 sm:px-5"
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-bold",
                        ticket.severity
                          ? {
                              critical: "bg-critical-soft text-critical-ink",
                              serious: "bg-serious-soft text-serious-ink",
                              warning: "bg-warning-soft text-warning-ink",
                              neutral: "bg-surface-3 text-ink-2",
                              good: "bg-good-soft text-good-ink",
                              brand: "bg-brand-soft text-brand-ink",
                            }[SEVERITY_TONE[ticket.severity]]
                          : "bg-surface-3 text-ink-3"
                      )}
                    >
                      {ticket.severity ?? ticket.categoryCode ?? "—"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{ticket.title}</p>
                      <p className="truncate text-xs text-ink-3">
                        {ticket.requester?.name ?? "Solicitante"} ·{" "}
                        <FormattedDate date={ticket.updatedAt} pattern="dd MMM, HH:mm" />
                      </p>
                    </div>
                    <StatusBadge status={ticket.status} />
                  </Link>
                ))}
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function HealthStat({
  icon,
  label,
  value,
  text,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  text?: string;
  tone: "neutral" | "warning" | "critical";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        tone === "critical"
          ? "border-critical/30 bg-critical-soft"
          : tone === "warning"
            ? "border-warning/40 bg-warning-soft"
            : "border-line bg-surface-2"
      )}
    >
      <dt
        className={cn(
          "flex items-center gap-1.5 text-[11px] font-medium",
          tone === "critical" ? "text-critical-ink" : tone === "warning" ? "text-warning-ink" : "text-ink-3"
        )}
      >
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-lg font-bold leading-none text-ink">
        {text ?? formatNumber(value ?? 0)}
      </dd>
    </div>
  );
}
