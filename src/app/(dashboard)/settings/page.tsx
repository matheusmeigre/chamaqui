import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Bot,
  Building2,
  CalendarDays,
  Clock,
  Layers,
  Monitor,
  Palette,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { FormattedDate } from "@/components/FormattedDate";
import { Badge, Callout, Card, CardBody, CardHeader, PageHeader, TableShell, Td, Th } from "@/components/ui";
import { ThemePicker } from "@/components/theme/ThemePicker";
import {
  BUSINESS_DAY_END_HOUR,
  BUSINESS_DAY_START_HOUR,
  CATEGORY_DEFINITIONS,
  CATEGORY_ORDER,
  CONTESTATION_WINDOW_BUSINESS_DAYS,
  P1_BURST_CRITICAL_THRESHOLD,
  QUOTA_ADVANCE_MAX_RATIO,
  QUOTA_WARNING_THRESHOLD,
  REOPEN_WINDOW_DAYS,
  SEVERITY_DEFINITIONS,
  SEVERITY_ORDER,
  TIER_DEFINITIONS,
  TIER_ORDER,
} from "@/server/domain/ticket-grid";
import { formatHours } from "@/lib/ui";

const HOLIDAY_SCOPE = { NACIONAL: "Nacional", ESTADUAL: "Estadual", MUNICIPAL: "Municipal" } as const;

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export default async function SettingsPage() {
  const session = await getCurrentUser();

  if (!session || session.role !== "ADMINISTRADOR") {
    redirect("/dashboard");
  }

  const today = new Date();
  const [organizations, upcomingHolidays, holidayCounts] = await Promise.all([
    prisma.organization.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        enabled: true,
        contract: { select: { tier: true, capacityHours: true, active: true, startsAt: true } },
        _count: { select: { users: true } },
      },
    }),
    prisma.holiday.findMany({
      where: { date: { gte: today } },
      orderBy: { date: "asc" },
      take: 6,
    }),
    prisma.holiday.groupBy({ by: ["scope"], _count: { _all: true } }),
  ]);

  const municipalCount = holidayCounts.find((row) => row.scope === "MUNICIPAL")?._count._all ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Configurações"
        description="Preferências da interface e as regras contratuais em vigor na grade de chamados."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader icon={<Palette size={16} />} title="Aparência" subtitle="Salvo neste navegador" />
          <CardBody>
            <ThemePicker />
          </CardBody>
        </Card>

        <Card>
          <CardHeader icon={<ShieldCheck size={16} />} title="Acesso" />
          <ul className="divide-y divide-line">
            {[
              { href: "/users", icon: Building2, label: "Usuários", hint: "Pessoas e perfis" },
              { href: "/settings/devices", icon: Monitor, label: "Dispositivos", hint: "Sessões e revogação" },
              { href: "/settings/activation-codes", icon: QrCode, label: "Códigos de ativação", hint: "Convites de acesso" },
            ].map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2 sm:px-5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-3 text-ink-2">
                    <item.icon size={15} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{item.label}</span>
                    <span className="block text-xs text-ink-3">{item.hint}</span>
                  </span>
                  <ArrowRight size={14} className="text-ink-3" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHeader
          icon={<Clock size={16} />}
          title="Expediente e SLA por severidade"
          subtitle={`Relógio em horas úteis: dias úteis, das ${BUSINESS_DAY_START_HOUR}h às ${BUSINESS_DAY_END_HOUR}h (America/Sao_Paulo)`}
        />
        <TableShell minWidth={640}>
          <thead>
            <tr>
              <Th>Severidade</Th>
              <Th align="right">1ª resposta</Th>
              <Th align="right">Contorno</Th>
              <Th align="right">Correção definitiva</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {SEVERITY_ORDER.map((code) => {
              const item = SEVERITY_DEFINITIONS[code];
              return (
                <tr key={code}>
                  <Td>
                    <span className="font-semibold text-ink">{code}</span>{" "}
                    <span className="text-ink-2">{item.label}</span>
                    <p className="mt-0.5 max-w-md text-xs text-ink-3">{item.description}</p>
                  </Td>
                  <Td align="right" numeric className="text-ink">
                    {formatHours(item.firstResponseHours)}
                  </Td>
                  <Td align="right" numeric className="text-ink">
                    {item.workaroundHours === null ? "—" : formatHours(item.workaroundHours)}
                  </Td>
                  <Td align="right" numeric className="text-ink">
                    {item.definitiveFixHours === null ? "Próxima release" : formatHours(item.definitiveFixHours)}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableShell>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader icon={<Layers size={16} />} title="Faixas de contratação" subtitle="Tetos mensais por categoria" />
          <TableShell minWidth={520}>
            <thead>
              <tr>
                <Th>Categoria</Th>
                {TIER_ORDER.map((tier) => (
                  <Th key={tier} align="right">
                    {TIER_DEFINITIONS[tier].label}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <tr>
                <Td className="font-medium text-ink">Capacidade</Td>
                {TIER_ORDER.map((tier) => (
                  <Td key={tier} align="right" numeric className="font-semibold text-ink">
                    {TIER_DEFINITIONS[tier].capacityHours} h
                  </Td>
                ))}
              </tr>
              {CATEGORY_ORDER.map((code) => (
                <tr key={code}>
                  <Td>
                    <span className="font-semibold text-ink">{code}</span>{" "}
                    <span className="text-xs text-ink-3">{CATEGORY_DEFINITIONS[code].label}</span>
                  </Td>
                  {TIER_ORDER.map((tier) => {
                    const limit = TIER_DEFINITIONS[tier].quotas[code];
                    return (
                      <Td key={tier} align="right" numeric>
                        {limit === null ? <span className="text-ink-3">sem teto</span> : limit}
                      </Td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Card>

        <Card>
          <CardHeader icon={<Bot size={16} />} title="Automações da grade" subtitle="Executadas a cada abertura e fechamento" />
          <CardBody>
            <ul className="space-y-3 text-sm">
              {[
                ["Aviso de teto", `${Math.round(QUOTA_WARNING_THRESHOLD * 100)}% do teto notifica gestor e cliente.`],
                ["Bloqueio no estouro", "100% do teto suspende a execução até o cliente escolher excedente ou fila."],
                ["Rajada de P1", `O ${P1_BURST_CRITICAL_THRESHOLD}º P1 na mesma semana zera os tetos de C2, C3 e C4 do mês.`],
                ["Contestação", `Expira sozinha em ${CONTESTATION_WINDOW_BUSINESS_DAYS} dias úteis, mantendo a classificação.`],
                ["Reabertura", `Em até ${REOPEN_WINDOW_DAYS} dias corridos não consome teto novo.`],
                ["Antecipação", `Até ${Math.round(QUOTA_ADVANCE_MAX_RATIO * 100)}% do teto do mês seguinte, uma vez por trimestre.`],
              ].map(([title, text]) => (
                <li key={title} className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                  <span>
                    <span className="font-medium text-ink">{title}.</span>{" "}
                    <span className="text-ink-2">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            icon={<Building2 size={16} />}
            title="Contratos por organização"
            subtitle={`${organizations.length} ${organizations.length === 1 ? "organização" : "organizações"}`}
          />
          <ul className="divide-y divide-line">
            {organizations.map((organization) => (
              <li key={organization.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{organization.name}</p>
                  <p className="text-xs text-ink-3">
                    {organization._count.users} {organization._count.users === 1 ? "usuário" : "usuários"}
                    {organization.contract && (
                      <>
                        {" · desde "}
                        <FormattedDate date={organization.contract.startsAt} pattern="MMM yyyy" />
                      </>
                    )}
                  </p>
                </div>
                {organization.contract?.active ? (
                  <Badge tone="brand">
                    {TIER_DEFINITIONS[organization.contract.tier].label} · {organization.contract.capacityHours} h
                  </Badge>
                ) : (
                  <Badge tone="warning">Sem contrato ativo</Badge>
                )}
                {!organization.enabled && <Badge tone="neutral">Desabilitada</Badge>}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader
            icon={<CalendarDays size={16} />}
            title="Calendário de feriados"
            subtitle={holidayCounts
              .map((row) => `${row._count._all} ${HOLIDAY_SCOPE[row.scope].toLowerCase()}`)
              .join(" · ") || "Nenhum feriado cadastrado"}
          />
          <CardBody className="space-y-3">
            {municipalCount === 0 && (
              <Callout tone="warning" icon={<CalendarDays size={14} />} title="Feriados municipais ausentes">
                Sem eles, o relógio de SLA conta como útil um dia que não é. Cadastre-os na tabela
                Holiday antes da apuração.
              </Callout>
            )}
            {upcomingHolidays.length === 0 ? (
              <p className="text-sm text-ink-3">Nenhum feriado futuro cadastrado.</p>
            ) : (
              <ul className="space-y-2">
                {upcomingHolidays.map((holiday) => (
                  <li key={holiday.id} className="flex items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-3 text-center leading-none">
                      {/* @db.Date chega como meia-noite UTC: formatar no fuso local
                          mostraria o dia anterior. */}
                      <span>
                        <span className="block text-sm font-bold text-ink">
                          {String(holiday.date.getUTCDate()).padStart(2, "0")}
                        </span>
                        <span className="block text-[9px] uppercase text-ink-3">
                          {MONTHS[holiday.date.getUTCMonth()]}
                        </span>
                      </span>
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">{holiday.name}</span>
                    <Badge tone="neutral">
                      {HOLIDAY_SCOPE[holiday.scope]}
                      {holiday.municipality ? ` · ${holiday.municipality}` : ""}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
