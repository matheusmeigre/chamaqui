import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertOctagon,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileBarChart,
  Flame,
  Gauge,
  Layers,
  RefreshCcw,
  ShieldCheck,
  Target,
  TicketCheck,
} from "lucide-react";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { FormattedDate } from "@/components/FormattedDate";
import {
  Badge,
  Callout,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  FIELD_CLASS,
  Meter,
  TableShell,
  Td,
  Th,
} from "@/components/ui";
import { StatTile } from "@/components/ui/StatTile";
import { BarList } from "@/components/charts/BarList";
import { RadialGauge } from "@/components/charts/RadialGauge";
import { STATUS } from "@/components/charts/primitives";
import { OUTCOME_LABEL, QUOTA_STATE_LABEL, QUOTA_STATE_TONE } from "@/components/domain/labels";
import { SEVERITY_DEFINITIONS } from "@/server/domain/ticket-grid";
import { buildMonthlyReport, listCompetencies } from "@/server/services/monthly-report";
import { requestAdvance } from "@/app/actions/ticket-grid";
import { expireOverdueContestations } from "@/server/services/quota-alerts";
import { competencyOf } from "@/server/services/ticket-classification";
import { cn, formatCompetency, formatPercent, shortId } from "@/lib/ui";
import { ReportFilters } from "./report-filters";

const MILESTONES = [
  { key: "firstResponse", label: "1ª resposta" },
  { key: "workaround", label: "Contorno" },
  { key: "definitiveFix", label: "Correção definitiva" },
] as const;

export default async function ConsumptionReportPage({
  searchParams,
}: {
  searchParams: Promise<{ competency?: string; org?: string }>;
}) {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  await expireOverdueContestations();

  const params = await searchParams;
  const isAdmin = session.role === "ADMINISTRADOR";

  // Administradores escolhem a organização; solicitantes veem apenas a sua.
  const organizations = isAdmin
    ? await prisma.organization.findMany({
        where: { enabled: true },
        select: { id: true, name: true, slug: true },
        orderBy: { name: "asc" },
      })
    : [];

  const organizationId = isAdmin
    ? (organizations.find((org) => org.id === params.org)?.id ?? organizations[0]?.id ?? null)
    : session.organizationId;

  if (!organizationId) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <EmptyState
            icon={<FileBarChart size={20} />}
            title="Sem organização vinculada"
            description="Seu usuário não está vinculado a uma organização, então não há consumo a apurar."
          />
        </Card>
      </div>
    );
  }

  const competencies = await listCompetencies(organizationId);
  const competency =
    params.competency && /^\d{4}-\d{2}$/.test(params.competency)
      ? params.competency
      : (competencies[0] ?? competencyOf(new Date()));
  const report = await buildMonthlyReport(organizationId, competency);

  const { quota } = report;
  const tier = quota.tier;
  const organizationName = isAdmin ? organizations.find((org) => org.id === organizationId)?.name : null;
  const capacityRatio = quota.capacityHours ? quota.totalConsumedHours / quota.capacityHours : null;
  const c1Ratio = quota.c1ReserveHours ? quota.c1ConsumedHours / quota.c1ReserveHours : null;
  const p1Exceeded = report.p1.ratio !== null && report.p1.ratio > 1;

  // Taxa global de SLA (com desconto da loja), para o indicador do topo.
  const slaTotals = report.sla.reduce(
    (acc, line) => {
      for (const milestone of MILESTONES) {
        acc.applicable += line.milestones[milestone.key].applicable;
        acc.met += line.milestones[milestone.key].metAdjusted;
      }
      return acc;
    },
    { applicable: 0, met: 0 }
  );
  const slaRatio = slaTotals.applicable === 0 ? null : slaTotals.met / slaTotals.applicable;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink-3">Relatório contratual</p>
          <h2 className="mt-0.5 text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]">
            {formatCompetency(competency)}
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            {organizationName && <span className="font-medium text-ink">{organizationName} · </span>}
            {tier ? `Faixa ${tier.label} · ${tier.capacityHours} h/mês` : "Sem contrato ativo"}
          </p>
        </div>

        <ReportFilters
          organizations={isAdmin ? organizations.map(({ id, name }) => ({ id, name })) : null}
          organizationId={organizationId}
          competencies={competencies}
          competency={competency}
        />
      </div>

      {!tier && (
        <Callout tone="warning" icon={<AlertTriangle size={16} />} title="Organização sem contrato ativo">
          O consumo é exibido, mas não há tetos a apurar.
        </Callout>
      )}

      {/* Indicadores */}
      <section className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4 sm:gap-4">
        <StatTile
          label="Chamados na competência"
          value={String(report.totalTickets)}
          icon={<TicketCheck size={16} />}
          caption={report.improperTotal > 0 ? `${report.improperTotal} improcedentes` : undefined}
          tone="brand"
        />
        <StatTile
          label="Horas consumidas"
          value={`${quota.totalConsumedHours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`}
          icon={<Clock3 size={16} />}
          caption={quota.capacityHours ? `de ${quota.capacityHours} h · ${formatPercent(capacityRatio)}` : undefined}
          tone={capacityRatio !== null && capacityRatio >= 1 ? "critical" : capacityRatio !== null && capacityRatio >= 0.8 ? "warning" : "neutral"}
        />
        <StatTile
          label="SLA cumprido"
          value={formatPercent(slaRatio)}
          icon={<ShieldCheck size={16} />}
          caption={slaTotals.applicable > 0 ? `${slaTotals.met} de ${slaTotals.applicable} marcos` : "Sem marcos de C1"}
          tone={slaRatio === null ? "neutral" : slaRatio >= 0.95 ? "good" : slaRatio >= 0.8 ? "warning" : "critical"}
        />
        <StatTile
          label="Incidentes P1"
          value={String(report.p1.count)}
          icon={<Flame size={16} />}
          caption={`${report.p1.hours.toLocaleString("pt-BR")} h em P1`}
          tone={p1Exceeded ? "critical" : report.p1.count > 0 ? "warning" : "neutral"}
        />
      </section>

      {/* Consumo × teto */}
      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader
            icon={<Target size={16} />}
            title="Consumo × teto por categoria"
            subtitle="Unidades consumidas na competência, com ajustes do mês"
          />
          <ul className="divide-y divide-line">
            {quota.lines.map((line) => {
              const tone =
                line.state === "ESTOURADO"
                  ? "critical"
                  : line.state === "ALERTA"
                    ? "warning"
                    : line.state === "OK"
                      ? "brand"
                      : "neutral";
              return (
                <li key={line.categoryCode} className="grid gap-2 px-4 py-3.5 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:items-center sm:gap-5 sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">
                      <span className="font-semibold">{line.categoryCode}</span>{" "}
                      <span className="text-ink-2">{line.definition.label}</span>
                    </p>
                    <div className="mt-1">
                      <Badge tone={QUOTA_STATE_TONE[line.state]} dot>
                        {QUOTA_STATE_LABEL[line.state]}
                      </Badge>
                    </div>
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-ink-3">
                      <span>
                        <span className="text-sm font-semibold tabular-nums text-ink">{line.consumedUnits}</span>
                        {line.limit !== null ? ` de ${line.limit} ` : " "}
                        {line.definition.unitLabel.many}
                        {line.limit !== null && ` · ${formatPercent(line.ratio)}`}
                      </span>
                      <span>
                        {line.consumedHours > 0 && `${line.consumedHours.toLocaleString("pt-BR")} h`}
                        {line.adjustments !== 0 &&
                          ` · ajuste ${line.adjustments > 0 ? "+" : ""}${line.adjustments}`}
                      </span>
                    </div>
                    {line.limit !== null ? (
                      <Meter ratio={line.ratio} tone={tone} ariaLabel={`Teto de ${line.categoryCode}`} />
                    ) : (
                      <p className="text-[11px] text-ink-3">
                        {line.definition.inContract
                          ? "Sem teto: coberto pela garantia"
                          : "Fora do contrato: vai a orçamento"}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="xl:col-span-4">
          <CardHeader
            icon={<Gauge size={16} />}
            title="Reservas da faixa"
            subtitle="C1 não tem teto, mas tem reserva de capacidade"
          />
          <CardBody className="space-y-5">
            <div className="flex flex-wrap items-start justify-center gap-6">
              <RadialGauge
                ratio={c1Ratio}
                label="Reserva de C1"
                caption={quota.c1ReserveHours ? `${quota.c1ConsumedHours} de ${quota.c1ReserveHours} h` : "sem contrato"}
                color={c1Ratio !== null && c1Ratio > 1 ? STATUS.critical : c1Ratio !== null && c1Ratio >= 0.8 ? STATUS.warning : "var(--brand)"}
                size={120}
              />
              <RadialGauge
                ratio={report.p1.ratio}
                label="Reserva de P1"
                caption={report.p1.reserveHours ? `${report.p1.hours} de ${report.p1.reserveHours} h` : "sem contrato"}
                color={p1Exceeded ? STATUS.critical : report.p1.ratio !== null && report.p1.ratio >= 0.8 ? STATUS.warning : "var(--brand)"}
                size={120}
              />
            </div>

            {p1Exceeded && (
              <Callout tone="critical" icon={<AlertOctagon size={15} />} title="Reserva de P1 ultrapassada">
                Acima do teto de mês de crise, a causa raiz é apurada em conjunto antes de qualquer
                repactuação.
              </Callout>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Antecipação de teto */}
      {isAdmin && tier && (
        <Card className="no-print">
          <CardHeader
            icon={<CalendarClock size={16} />}
            title="Antecipar teto do mês seguinte"
            subtitle="Até 20% do teto seguinte, uma vez por trimestre. Saldo não consumido não acumula."
          />
          <CardBody>
            <form action={requestAdvance} className="grid gap-2 md:grid-cols-[1.2fr_0.6fr_1.4fr_auto]">
              <input type="hidden" name="organizationId" value={organizationId} />
              <input type="hidden" name="competency" value={competency} />
              <select name="categoryCode" required defaultValue="" aria-label="Categoria" className={FIELD_CLASS}>
                <option value="" disabled>
                  Categoria…
                </option>
                {quota.lines
                  .filter((line) => line.definition.hasQuota)
                  .map((line) => (
                    <option key={line.categoryCode} value={line.categoryCode}>
                      {line.categoryCode} — {line.definition.label}
                    </option>
                  ))}
              </select>
              <input
                type="number"
                name="amount"
                min={1}
                step={1}
                required
                placeholder="Qtd."
                aria-label="Quantidade"
                className={FIELD_CLASS}
              />
              <input
                type="text"
                name="reason"
                placeholder="Justificativa (opcional)"
                aria-label="Justificativa"
                className={FIELD_CLASS}
              />
              <button
                type="submit"
                className="min-h-11 rounded-xl bg-brand px-5 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong"
              >
                Antecipar
              </button>
            </form>
          </CardBody>
        </Card>
      )}

      {/* SLA por severidade */}
      <Card>
        <CardHeader
          icon={<ShieldCheck size={16} />}
          title="SLA cumprido por severidade"
          subtitle="Correção definitiva com a janela de revisão da Google Play descontada"
        />
        {report.sla.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck size={20} />}
            title="Nenhum chamado com severidade"
            description="Não houve incidentes de C1 nesta competência."
          />
        ) : (
          <>
            <TableShell minWidth={720}>
              <thead>
                <tr>
                  <Th>Severidade</Th>
                  <Th align="right">Chamados</Th>
                  {MILESTONES.map((milestone) => (
                    <Th key={milestone.key}>{milestone.label}</Th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {report.sla.map((line) => (
                  <tr key={line.severity}>
                    <Td>
                      <span className="font-semibold text-ink">{line.severity}</span>{" "}
                      <span className="text-xs text-ink-3">{SEVERITY_DEFINITIONS[line.severity].label}</span>
                    </Td>
                    <Td align="right" numeric className="text-ink">
                      {line.total}
                    </Td>
                    {MILESTONES.map((milestone) => {
                      const bucket = line.milestones[milestone.key];
                      if (bucket.applicable === 0) {
                        return (
                          <Td key={milestone.key} className="text-ink-3">
                            —
                          </Td>
                        );
                      }
                      const ratio = bucket.metAdjusted / bucket.applicable;
                      const tone = ratio >= 0.95 ? "good" : ratio >= 0.8 ? "warning" : "critical";
                      const Icon = tone === "good" ? CheckCircle2 : tone === "warning" ? AlertTriangle : AlertOctagon;
                      return (
                        <Td key={milestone.key}>
                          <div className="min-w-36 space-y-1">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 font-semibold",
                                  tone === "good" ? "text-good-ink" : tone === "warning" ? "text-warning-ink" : "text-critical-ink"
                                )}
                              >
                                <Icon size={12} />
                                {formatPercent(ratio)}
                              </span>
                              <span className="tabular-nums text-ink-3">
                                {bucket.metAdjusted}/{bucket.applicable}
                              </span>
                            </div>
                            <Meter ratio={ratio} tone={tone} ariaLabel={`${milestone.label} ${line.severity}`} />
                            {milestone.key === "definitiveFix" && bucket.metRaw !== bucket.metAdjusted && (
                              <p className="text-[11px] text-ink-3">
                                {bucket.metRaw}/{bucket.applicable} sem desconto da loja
                              </p>
                            )}
                          </div>
                        </Td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </TableShell>
          </>
        )}
      </Card>

      {/* Improcedentes, reincidências e causa raiz */}
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <Card>
          <CardHeader
            icon={<AlertTriangle size={16} />}
            title="Improcedentes"
            subtitle="Não consomem teto; o diagnóstico entra no relatório"
          />
          <CardBody>
            <BarList
              data={report.improper.map((line) => ({
                key: line.outcome,
                label: OUTCOME_LABEL[line.outcome],
                value: line.count,
              }))}
              emptyLabel="Nenhum chamado improcedente na competência."
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            icon={<Layers size={16} />}
            title="Ranking de causa raiz"
            subtitle="Categoria técnica · incidentes P1 primeiro"
          />
          <CardBody>
            <BarList
              data={report.rootCauses.map((line) => ({
                key: line.category,
                label: line.category,
                value: line.total,
                hint: line.p1 > 0 ? `${line.p1} ${line.p1 === 1 ? "incidente P1" : "incidentes P1"}` : undefined,
              }))}
              emptyLabel="Sem dados na competência."
            />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2 2xl:col-span-1">
          <CardHeader
            icon={<RefreshCcw size={16} />}
            title="Reincidências"
            subtitle={`${report.recurrences.length} ${report.recurrences.length === 1 ? "chamado reaberto" : "chamados reabertos"}`}
          />
          {report.recurrences.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 size={20} />}
              title="Nenhuma reincidência"
              description="Nenhum defeito voltou nesta competência."
            />
          ) : (
            <ul className="divide-y divide-line">
              {report.recurrences.map((line) => (
                <li key={line.id}>
                  <Link href={`/tickets/${line.id}`} className="block px-4 py-3 transition hover:bg-surface-2 sm:px-5">
                    <p className="truncate text-sm font-medium text-ink">{line.title}</p>
                    <p className="mt-0.5 text-xs text-ink-3">
                      Reincidência de {shortId(line.parentTicketId)} ·{" "}
                      <FormattedDate date={line.openedAt} pattern="dd/MM/yyyy" /> ·{" "}
                      {line.consumesQuota ? "consome teto" : "não consome teto"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
