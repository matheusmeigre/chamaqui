"use client";

import { useState } from "react";
import {
  ChevronDown,
  ClipboardCheck,
  FileSignature,
  Layers,
  LifeBuoy,
  Scale,
  Store,
} from "lucide-react";
import type { CorrectionClass, Severity, TicketCategoryCode, TicketOutcome } from "@prisma/client";
import {
  C4_MAX_EFFORT_HOURS,
  CATEGORY_DEFINITIONS,
  CATEGORY_ORDER,
  SEVERITY_DEFINITIONS,
  SEVERITY_ORDER,
} from "@/server/domain/ticket-grid";
import {
  decideContestation,
  reclassifyTicket,
  reclassifyToC5,
  registerStoreWindow,
  registerTechnicalClosure,
  registerWorkaround,
} from "@/app/actions/ticket-grid";
import { FIELD_CLASS } from "@/components/ui";
import { cn } from "@/lib/ui";

const label = "mb-1.5 block text-xs font-medium text-ink-2";
const primaryButton =
  "flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-4 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong";
const subtleButton =
  "flex min-h-11 w-full items-center justify-center rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink transition hover:border-line-strong hover:bg-surface-2";

const OUTCOME_LABELS: Record<TicketOutcome, string> = {
  RESOLVIDO: "Resolvido",
  IMPROCEDENTE_NAO_REPRODUZ: "Improcedente — não reproduz",
  IMPROCEDENTE_ERRO_USO: "Improcedente — erro de uso",
  IMPROCEDENTE_TERCEIRO: "Improcedente — indisponibilidade de terceiro",
  DUPLICADO: "Duplicado",
  RECLASSIFICADO: "Reclassificado",
};

type Props = {
  ticketId: string;
  categoryCode: TicketCategoryCode | null;
  severity: Severity | null;
  units: number;
  actualHours: number | null;
  correctionClass: CorrectionClass | null;
  sentToStoreAt: Date | null;
  storeApprovedAt: Date | null;
  workaroundAt: Date | null;
  contestationOpen: boolean;
  contestationReason: string | null;
};

/**
 * Seções recolhíveis: a coluna lateral deixa de ser uma parede de formulários
 * e o técnico abre só a etapa em que está trabalhando.
 */
function Section({
  title,
  icon,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group border-t border-line first:border-t-0">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2.5 px-4 py-3 transition hover:bg-surface-2 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="shrink-0 text-ink-3">{icon}</span>
        <span className="min-w-0 flex-1 text-sm font-medium text-ink">{title}</span>
        {badge}
        <ChevronDown size={15} className="shrink-0 text-ink-3 transition group-open:rotate-180" />
      </summary>
      <div className="space-y-3 px-4 pb-4 sm:px-5">{children}</div>
    </details>
  );
}

function Pill({ tone, children }: { tone: "good" | "warning" | "brand" | "critical"; children: React.ReactNode }) {
  const styles = {
    good: "bg-good-soft text-good-ink",
    warning: "bg-warning-soft text-warning-ink",
    brand: "bg-brand-soft text-brand-ink",
    critical: "bg-critical-soft text-critical-ink",
  };
  return (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", styles[tone])}>
      {children}
    </span>
  );
}

export function GridActions({
  ticketId,
  categoryCode,
  severity,
  units,
  actualHours,
  correctionClass,
  sentToStoreAt,
  storeApprovedAt,
  workaroundAt,
  contestationOpen,
  contestationReason,
}: Props) {
  const [category, setCategory] = useState<TicketCategoryCode | "">(categoryCode ?? "");
  const [newSeverity, setNewSeverity] = useState<Severity | "">(severity ?? "");
  const [outcome, setOutcome] = useState<TicketOutcome>("RESOLVIDO");
  const [hours, setHours] = useState<string>(actualHours?.toString() ?? "");

  const definition = category ? CATEGORY_DEFINITIONS[category] : null;
  const needsSeverity = definition?.requiresSeverity ?? false;
  const countsUnits =
    definition !== null && definition.unit !== "CHAMADO" && definition.unit !== "PROJETO";

  const parsedHours = hours === "" ? null : Number(hours);
  // A fronteira C4/C5 é um número de horas: acima de 8 h o fechamento é barrado
  // no servidor, então a interface oferece a reclassificação antes da tentativa.
  const exceedsC4Limit =
    categoryCode === "C4" && parsedHours !== null && parsedHours > C4_MAX_EFFORT_HOURS;

  const closureNeedsCorrectionClass = categoryCode === "C1" && outcome === "RESOLVIDO";

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <header className="border-b border-line px-4 py-3.5 sm:px-5">
        <h3 className="text-sm font-semibold text-ink">Grade · ações técnicas</h3>
        <p className="mt-0.5 text-xs text-ink-3">Classificação, marcos de SLA e fechamento</p>
      </header>

      {contestationOpen && (
        <Section
          title="Contestação em aberto"
          icon={<Scale size={16} />}
          badge={<Pill tone="warning">Decidir</Pill>}
          defaultOpen
        >
          <p className="rounded-xl bg-brand-soft px-3 py-2 text-xs text-brand-ink">
            Motivo do cliente: {contestationReason || "não informado"}
          </p>

          <form action={decideContestation}>
            <input type="hidden" name="ticketId" value={ticketId} />
            <input type="hidden" name="decision" value="MANTIDA" />
            <button type="submit" className={subtleButton}>
              Manter classificação
            </button>
          </form>

          <form action={decideContestation} className="space-y-2.5 rounded-xl bg-surface-2 p-3">
            <input type="hidden" name="ticketId" value={ticketId} />
            <input type="hidden" name="decision" value="ALTERADA" />
            <div>
              <label className={label} htmlFor="grid-new-category">
                Acatar e alterar para
              </label>
              <select id="grid-new-category" name="newCategoryCode" className={FIELD_CLASS} defaultValue="">
                <option value="">Selecione…</option>
                {CATEGORY_ORDER.map((code) => (
                  <option key={code} value={code}>
                    {code} — {CATEGORY_DEFINITIONS[code].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="grid-new-severity">
                Severidade (somente C1)
              </label>
              <select id="grid-new-severity" name="newSeverity" className={FIELD_CLASS} defaultValue="">
                <option value="">Não se aplica</option>
                {SEVERITY_ORDER.map((code) => (
                  <option key={code} value={code}>
                    {code} — {SEVERITY_DEFINITIONS[code].label}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className={subtleButton}>
              Acatar contestação
            </button>
          </form>
        </Section>
      )}

      <Section
        title="Classificação"
        icon={<Layers size={16} />}
        badge={!categoryCode ? <Pill tone="critical">Pendente</Pill> : undefined}
        defaultOpen={!categoryCode}
      >
        <form action={reclassifyTicket} className="space-y-3">
          <input type="hidden" name="ticketId" value={ticketId} />

          <div>
            <label className={label} htmlFor="grid-category">
              Natureza
            </label>
            <select
              id="grid-category"
              name="categoryCode"
              required
              className={FIELD_CLASS}
              value={category}
              onChange={(event) => {
                const next = event.target.value as TicketCategoryCode | "";
                setCategory(next);
                if (!next || !CATEGORY_DEFINITIONS[next].requiresSeverity) setNewSeverity("");
              }}
            >
              <option value="">Selecione…</option>
              {CATEGORY_ORDER.map((code) => (
                <option key={code} value={code}>
                  {code} — {CATEGORY_DEFINITIONS[code].label}
                </option>
              ))}
            </select>
          </div>

          {needsSeverity && (
            <div>
              <label className={label} htmlFor="grid-severity">
                Severidade
              </label>
              <select
                id="grid-severity"
                name="severity"
                required
                className={FIELD_CLASS}
                value={newSeverity}
                onChange={(event) => setNewSeverity(event.target.value as Severity | "")}
              >
                <option value="">Selecione…</option>
                {SEVERITY_ORDER.map((code) => (
                  <option key={code} value={code}>
                    {code} — {SEVERITY_DEFINITIONS[code].label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {countsUnits && definition && (
            <div>
              <label className={label} htmlFor="grid-units">
                Quantidade de {definition.unitLabel.many}
              </label>
              <input
                id="grid-units"
                type="number"
                name="units"
                min={1}
                step={1}
                defaultValue={units}
                className={FIELD_CLASS}
              />
            </div>
          )}

          <button type="submit" className={subtleButton}>
            Salvar classificação
          </button>
        </form>
      </Section>

      {(categoryCode === "C1" || workaroundAt) && (
        <Section
          title="Contorno"
          icon={<LifeBuoy size={16} />}
          badge={workaroundAt ? <Pill tone="good">Registrado</Pill> : undefined}
        >
          {workaroundAt ? (
            <p className="rounded-xl bg-good-soft px-3 py-2 text-xs text-good-ink">
              Contorno já registrado — o marco foi cumprido.
            </p>
          ) : (
            <form action={registerWorkaround} className="space-y-2">
              <input type="hidden" name="ticketId" value={ticketId} />
              <textarea
                name="note"
                rows={2}
                placeholder="O que foi feito para contornar o problema…"
                className={cn(FIELD_CLASS, "resize-none")}
              />
              <button type="submit" className={subtleButton}>
                Registrar contorno
              </button>
            </form>
          )}
        </Section>
      )}

      <Section
        title="Publicação na Google Play"
        icon={<Store size={16} />}
        badge={
          sentToStoreAt && !storeApprovedAt ? (
            <Pill tone="warning">Em revisão</Pill>
          ) : storeApprovedAt ? (
            <Pill tone="good">Publicado</Pill>
          ) : undefined
        }
        defaultOpen={Boolean(sentToStoreAt && !storeApprovedAt)}
      >
        <p className="text-xs text-ink-3">
          O tempo entre o envio e a aprovação sai do relógio de SLA da correção definitiva.
        </p>
        {!sentToStoreAt ? (
          <form action={registerStoreWindow}>
            <input type="hidden" name="ticketId" value={ticketId} />
            <input type="hidden" name="event" value="ENVIO" />
            <button type="submit" className={subtleButton}>
              Registrar envio à loja
            </button>
          </form>
        ) : !storeApprovedAt ? (
          <form action={registerStoreWindow} className="space-y-2">
            <input type="hidden" name="ticketId" value={ticketId} />
            <input type="hidden" name="event" value="APROVACAO" />
            <p className="rounded-xl bg-warning-soft px-3 py-2 text-xs text-warning-ink">
              Em revisão pela loja — o relógio do fornecedor está congelado.
            </p>
            <button type="submit" className={subtleButton}>
              Registrar aprovação
            </button>
          </form>
        ) : (
          <p className="rounded-xl bg-good-soft px-3 py-2 text-xs text-good-ink">
            Versão publicada. A janela já foi descontada do SLA.
          </p>
        )}
      </Section>

      <Section title="Fechamento técnico" icon={<ClipboardCheck size={16} />}>
        <form action={registerTechnicalClosure} className="space-y-3">
          <input type="hidden" name="ticketId" value={ticketId} />

          <div>
            <label className={label} htmlFor="grid-outcome">
              Desfecho
            </label>
            <select
              id="grid-outcome"
              name="outcome"
              required
              className={FIELD_CLASS}
              value={outcome}
              onChange={(event) => setOutcome(event.target.value as TicketOutcome)}
            >
              {(Object.keys(OUTCOME_LABELS) as TicketOutcome[])
                .filter((key) => key !== "RECLASSIFICADO")
                .map((key) => (
                  <option key={key} value={key}>
                    {OUTCOME_LABELS[key]}
                  </option>
                ))}
            </select>
            {(outcome.startsWith("IMPROCEDENTE") || outcome === "DUPLICADO") && (
              <p className="mt-1.5 text-xs text-ink-3">
                Não consome teto. O diagnóstico entra no relatório mensal.
              </p>
            )}
          </div>

          <div>
            <label className={label} htmlFor="grid-hours">
              Esforço real (h)
            </label>
            <input
              id="grid-hours"
              type="number"
              name="actualHours"
              min={0}
              step={0.25}
              value={hours}
              onChange={(event) => setHours(event.target.value)}
              className={FIELD_CLASS}
            />
          </div>

          {closureNeedsCorrectionClass && (
            <div>
              <label className={label} htmlFor="grid-correction">
                Classe de correção
              </label>
              <select
                id="grid-correction"
                name="correctionClass"
                required
                defaultValue={correctionClass ?? ""}
                className={FIELD_CLASS}
              >
                <option value="">Selecione…</option>
                <option value="SERVIDOR">Servidor — sem publicação, efeito imediato</option>
                <option value="CLIENTE">Cliente — exige publicação na Play</option>
              </select>
            </div>
          )}

          {exceedsC4Limit ? (
            <p className="rounded-xl bg-critical-soft px-3 py-2 text-xs text-critical-ink">
              {parsedHours} h ultrapassa o limite de {C4_MAX_EFFORT_HOURS} h de C4. Reclassifique
              como C5 com aceite formal antes de fechar.
            </p>
          ) : (
            <button type="submit" className={primaryButton}>
              Fechar chamado
            </button>
          )}
        </form>
      </Section>

      {(categoryCode === "C4" || exceedsC4Limit) && (
        <Section
          title="Reclassificar como C5"
          icon={<FileSignature size={16} />}
          badge={exceedsC4Limit ? <Pill tone="critical">Necessário</Pill> : undefined}
          defaultOpen={exceedsC4Limit}
        >
          <p className="text-xs text-ink-3">Fora do contrato de sustentação: exige orçamento e aceite formal.</p>
          <form action={reclassifyToC5} className="space-y-2">
            <input type="hidden" name="ticketId" value={ticketId} />
            <textarea
              name="acceptanceNote"
              rows={2}
              required
              placeholder="Referência do orçamento e aceite formal do cliente…"
              className={cn(FIELD_CLASS, "resize-none")}
            />
            <button type="submit" className={subtleButton}>
              Reclassificar para C5
            </button>
          </form>
        </Section>
      )}
    </section>
  );
}
