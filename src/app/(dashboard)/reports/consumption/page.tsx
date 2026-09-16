import { getCurrentUser } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CalendarClock, Gauge, RefreshCcw, ShieldCheck, Target } from "lucide-react";
import { FormattedDate } from "@/components/FormattedDate";
import { buildMonthlyReport, listCompetencies } from "@/server/services/monthly-report";
import { requestAdvance } from "@/app/actions/ticket-grid";
import { expireOverdueContestations } from "@/server/services/quota-alerts";
import { competencyOf } from "@/server/services/ticket-classification";
import type { QuotaState } from "@/server/services/quota-service";
import type { TicketOutcome } from "@prisma/client";

const STATE_BAR: Record<QuotaState, string> = {
  OK: "bg-green-500",
  ALERTA: "bg-amber-500",
  ESTOURADO: "bg-red-500",
  SEM_TETO: "bg-blue-500",
  FORA_DO_CONTRATO: "bg-slate-400",
};

const STATE_LABEL: Record<QuotaState, string> = {
  OK: "Dentro do teto",
  ALERTA: "80% do teto",
  ESTOURADO: "Teto atingido",
  SEM_TETO: "Sem teto (garantia)",
  FORA_DO_CONTRATO: "Fora do contrato",
};

const OUTCOME_LABEL: Record<TicketOutcome, string> = {
  RESOLVIDO: "Resolvido",
  IMPROCEDENTE_NAO_REPRODUZ: "Não reproduz",
  IMPROCEDENTE_ERRO_USO: "Erro de uso",
  IMPROCEDENTE_TERCEIRO: "Indisponibilidade de terceiro",
  DUPLICADO: "Duplicado",
  RECLASSIFICADO: "Reclassificado",
};

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-4">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-800 border-b pb-2">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function percent(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value * 100)}%`;
}

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
    ? (params.org ?? organizations[0]?.id ?? null)
    : session.organizationId;

  if (!organizationId) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          Seu usuário não está vinculado a uma organização, então não há consumo a apurar.
        </div>
      </div>
    );
  }

  const competencies = await listCompetencies(organizationId);
  const competency = params.competency ?? competencies[0] ?? competencyOf(new Date());
  const report = await buildMonthlyReport(organizationId, competency);

  const tier = report.quota.tier;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-gray-800">Relatório mensal</h2>
          <p className="text-sm text-slate-500">
            Competência {competency}
            {tier ? ` · faixa ${tier.label} · ${tier.capacityHours} h/mês` : " · sem contrato ativo"}
          </p>
        </div>

        <form className="flex flex-wrap gap-2" action="/reports/consumption" method="get">
          {isAdmin && (
            <select
              name="org"
              defaultValue={organizationId}
              className="min-h-11 min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>
          )}
          <select
            name="competency"
            defaultValue={competency}
            className="min-h-11 min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          >
            {competencies.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button
            type="submit"
            className="min-h-11 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Aplicar
          </button>
        </form>
      </div>

      {!tier && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Esta organização não tem contrato de sustentação ativo. O consumo é exibido, mas não há
          tetos a apurar.
        </div>
      )}

      {/* --- Consumo por categoria --------------------------------------- */}
      <Card title="Consumo por categoria" icon={<Target size={20} />}>
        <div className="space-y-4">
          {report.quota.lines.map((line) => (
            <div key={line.categoryCode} className="space-y-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-slate-800">
                  {line.categoryCode} — {line.definition.label}
                </span>
                <span className="text-sm text-slate-600">
                  {line.consumedUnits}
                  {line.limit !== null ? ` de ${line.limit}` : ""}{" "}
                  {line.definition.unitLabel.many}
                  {line.limit !== null && ` · ${percent(line.ratio)}`}
                </span>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${STATE_BAR[line.state]}`}
                  style={{
                    width:
                      line.limit === null
                        ? "100%"
                        : `${Math.min(100, Math.round((line.ratio ?? 0) * 100))}%`,
                  }}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>{STATE_LABEL[line.state]}</span>
                <span>
                  {line.consumedHours > 0 && `${line.consumedHours.toFixed(2)} h`}
                  {line.adjustments !== 0 &&
                    ` · ajuste de ${line.adjustments > 0 ? "+" : ""}${line.adjustments} no mês`}
                </span>
              </div>
            </div>
          ))}
        </div>

        <dl className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-400">Chamados na competência</dt>
            <dd className="font-semibold text-slate-800">{report.totalTickets}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Horas consumidas</dt>
            <dd className="font-semibold text-slate-800">
              {report.quota.totalConsumedHours.toFixed(2)} h
              {report.quota.capacityHours ? ` / ${report.quota.capacityHours} h` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Reserva de C1</dt>
            <dd className="font-semibold text-slate-800">
              {report.quota.c1ConsumedHours.toFixed(2)} h
              {report.quota.c1ReserveHours ? ` / ${report.quota.c1ReserveHours} h` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-400">Improcedentes</dt>
            <dd className="font-semibold text-slate-800">{report.improperTotal}</dd>
          </div>
        </dl>
      </Card>

      {/* --- Antecipação de teto ------------------------------------------ */}
      {isAdmin && tier && (
        <Card title="Antecipar teto do mês seguinte" icon={<CalendarClock size={20} />}>
          <p className="text-sm text-slate-600">
            Saldo não consumido não acumula. É permitida a antecipação de até 20% do teto do mês
            seguinte, uma vez por trimestre — banco de horas destrói a previsibilidade que
            justifica a mensalidade.
          </p>
          <form action={requestAdvance} className="grid gap-3 sm:grid-cols-4">
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="competency" value={competency} />
            <select
              name="categoryCode"
              required
              defaultValue=""
              className="min-h-11 min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              <option value="">Categoria...</option>
              {report.quota.lines
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
              placeholder="Quantidade"
              className="min-h-11 min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
            <input
              type="text"
              name="reason"
              placeholder="Justificativa (opcional)"
              className="min-h-11 min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            />
            <button
              type="submit"
              className="min-h-11 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Antecipar
            </button>
          </form>
        </Card>
      )}

      {/* --- Taxa de P1 --------------------------------------------------- */}
      <Card title="Incidentes críticos (P1)" icon={<Gauge size={20} />}>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">P1 no mês</p>
            <p className="text-2xl font-bold text-slate-800">{report.p1.count}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Horas em P1</p>
            <p className="text-2xl font-bold text-slate-800">{report.p1.hours.toFixed(1)} h</p>
          </div>
          <div
            className={`rounded-lg border p-3 ${
              report.p1.ratio !== null && report.p1.ratio > 1
                ? "border-red-200 bg-red-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <p className="text-xs text-slate-500">Reserva de P1 consumida</p>
            <p className="text-2xl font-bold text-slate-800">
              {percent(report.p1.ratio)}
              {report.p1.reserveHours !== null && (
                <span className="ml-1 text-sm font-normal text-slate-500">
                  de {report.p1.reserveHours} h
                </span>
              )}
            </p>
          </div>
        </div>
        {report.p1.ratio !== null && report.p1.ratio > 1 && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            A reserva de P1 da faixa foi ultrapassada. Acima do teto de mês de crise, a causa raiz
            é apurada em conjunto antes de qualquer repactuação.
          </p>
        )}
      </Card>

      {/* --- SLA por severidade ------------------------------------------- */}
      <Card title="SLA cumprido por severidade" icon={<ShieldCheck size={20} />}>
        {report.sla.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum chamado com severidade na competência.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50 font-medium text-slate-700">
                <tr>
                  <th className="px-4 py-3">Severidade</th>
                  <th className="px-4 py-3">Chamados</th>
                  <th className="px-4 py-3">1ª resposta</th>
                  <th className="px-4 py-3">Contorno</th>
                  <th className="px-4 py-3">Correção definitiva</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.sla.map((line) => (
                  <tr key={line.severity}>
                    <td className="px-4 py-3 font-medium text-slate-900">{line.severity}</td>
                    <td className="px-4 py-3">{line.total}</td>
                    {(["firstResponse", "workaround", "definitiveFix"] as const).map((key) => {
                      const bucket = line.milestones[key];
                      return (
                        <td key={key} className="px-4 py-3">
                          {bucket.applicable === 0 ? (
                            "—"
                          ) : (
                            <span>
                              {bucket.metAdjusted}/{bucket.applicable}
                              {key === "definitiveFix" &&
                                bucket.metRaw !== bucket.metAdjusted && (
                                  <span className="ml-1 text-xs text-slate-400">
                                    ({bucket.metRaw}/{bucket.applicable} sem desconto)
                                  </span>
                                )}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-slate-500">
          A coluna de correção definitiva considera a janela de revisão da Google Play descontada.
          O número sem desconto aparece ao lado quando difere.
        </p>
      </Card>

      {/* --- Improcedentes e reincidências -------------------------------- */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Improcedentes" icon={<AlertTriangle size={20} />}>
          {report.improper.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum chamado improcedente na competência.</p>
          ) : (
            <ul className="space-y-2">
              {report.improper.map((line) => (
                <li
                  key={line.outcome}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="text-slate-700">{OUTCOME_LABEL[line.outcome]}</span>
                  <span className="font-semibold text-slate-900">{line.count}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-slate-500">
            Chamado improcedente não consome teto. O diagnóstico entra no relatório.
          </p>
        </Card>

        <Card title="Reincidências" icon={<RefreshCcw size={20} />}>
          {report.recurrences.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma reincidência na competência.</p>
          ) : (
            <ul className="space-y-2">
              {report.recurrences.map((line) => (
                <li
                  key={line.id}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <Link
                    href={`/tickets/${line.id}`}
                    className="font-medium text-blue-600 hover:text-blue-800"
                  >
                    {line.title}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">
                    Reincidência de #{line.parentTicketId.split("-")[0].toUpperCase()} ·{" "}
                    <FormattedDate date={line.openedAt} pattern="dd/MM/yyyy" /> ·{" "}
                    {line.consumesQuota ? "consome teto" : "não consome teto"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* --- Causa raiz --------------------------------------------------- */}
      <Card title="Ranking de causa raiz" icon={<Target size={20} />}>
        {report.rootCauses.length === 0 ? (
          <p className="text-sm text-slate-500">Sem dados na competência.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[420px] w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 bg-slate-50 font-medium text-slate-700">
                <tr>
                  <th className="px-4 py-3">Categoria técnica</th>
                  <th className="px-4 py-3">Chamados</th>
                  <th className="px-4 py-3">Dos quais P1</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.rootCauses.map((line) => (
                  <tr key={line.category}>
                    <td className="px-4 py-3 text-slate-900">{line.category}</td>
                    <td className="px-4 py-3">{line.total}</td>
                    <td className="px-4 py-3 font-medium">{line.p1}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
