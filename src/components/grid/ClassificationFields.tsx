"use client";

import { useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  Bug,
  CircleDot,
  Cloud,
  FileText,
  Headset,
  Info,
  Rocket,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import type { Severity, TicketCategoryCode } from "@prisma/client";
import {
  CATEGORY_DEFINITIONS,
  CATEGORY_ORDER,
  SEVERITY_DEFINITIONS,
  SEVERITY_ORDER,
} from "@/server/domain/ticket-grid";
import { FIELD_CLASS } from "@/components/ui";
import { cn, formatHours } from "@/lib/ui";

const CATEGORY_ICON: Record<TicketCategoryCode, LucideIcon> = {
  C1: Bug,
  C2: FileText,
  C3: Headset,
  C4: SlidersHorizontal,
  C5: Rocket,
  C6: Cloud,
};

const SEVERITY_ICON: Record<Severity, LucideIcon> = {
  P1: AlertOctagon,
  P2: AlertTriangle,
  P3: Info,
  P4: CircleDot,
};

const SEVERITY_ACTIVE: Record<Severity, string> = {
  P1: "border-critical bg-critical-soft",
  P2: "border-serious bg-serious-soft",
  P3: "border-warning bg-warning-soft",
  P4: "border-line-strong bg-surface-3",
};

const SEVERITY_ICON_TONE: Record<Severity, string> = {
  P1: "text-critical-ink",
  P2: "text-serious-ink",
  P3: "text-warning-ink",
  P4: "text-ink-2",
};

/** Resumo curto do escopo de cada natureza, para caber num cartão. */
const CATEGORY_SHORT: Record<TicketCategoryCode, string> = {
  C1: "O app não faz o que deveria: erro, falha, travamento.",
  C2: "Cadastro ou atualização de conteúdo: atrativos, eventos, cupons.",
  C3: "Dúvida de uso, senha, exclusão de conta, orientação.",
  C4: "Ajuste pequeno: texto, cor, ícone, filtro — até 8 h.",
  C5: "Nova funcionalidade ou integração — vai a orçamento.",
  C6: "Publicação, migração, chaves e cotas de plataforma.",
};

type Props = {
  /** Somente administradores classificam severidade e canal de origem. */
  canClassify: boolean;
  defaultCategory?: TicketCategoryCode | null;
  defaultSeverity?: Severity | null;
  defaultUnits?: number;
  onCategoryChange?: (category: TicketCategoryCode | "") => void;
};

export function ClassificationFields({
  canClassify,
  defaultCategory = null,
  defaultSeverity = null,
  defaultUnits = 1,
  onCategoryChange,
}: Props) {
  const [category, setCategory] = useState<TicketCategoryCode | "">(defaultCategory ?? "");
  const [severity, setSeverity] = useState<Severity | "">(defaultSeverity ?? "");

  const definition = category ? CATEGORY_DEFINITIONS[category] : null;
  const needsSeverity = definition?.requiresSeverity ?? false;
  const countsUnits =
    definition !== null && definition.unit !== "CHAMADO" && definition.unit !== "PROJETO";

  const selectCategory = (next: TicketCategoryCode) => {
    setCategory(next);
    onCategoryChange?.(next);
    // Severidade é exclusiva de C1: sair de C1 limpa o campo para não
    // enviar uma combinação que o servidor vai recusar.
    if (!CATEGORY_DEFINITIONS[next].requiresSeverity) setSeverity("");
  };

  return (
    <div className="space-y-6">
      <fieldset className="space-y-2.5">
        <legend className="text-sm font-medium text-ink">
          Que tipo de demanda é esta? <span className="text-critical">*</span>
        </legend>

        <div className="grid grid-cols-1 gap-2 min-[520px]:grid-cols-2 lg:grid-cols-3">
          {CATEGORY_ORDER.map((code) => {
            const Icon = CATEGORY_ICON[code];
            const active = category === code;
            const item = CATEGORY_DEFINITIONS[code];

            return (
              <label
                key={code}
                className={cn(
                  "group relative flex cursor-pointer flex-col gap-1.5 rounded-xl border p-3 transition",
                  active
                    ? "border-brand bg-brand-soft shadow-(--ring-brand)"
                    : "border-line bg-surface hover:border-line-strong hover:bg-surface-2"
                )}
              >
                <input
                  type="radio"
                  name="categoryCode"
                  value={code}
                  required
                  checked={active}
                  onChange={() => selectCategory(code)}
                  className="sr-only"
                />
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "grid h-7 w-7 shrink-0 place-items-center rounded-lg transition",
                      active ? "bg-brand text-on-brand" : "bg-surface-3 text-ink-3 group-hover:text-ink-2"
                    )}
                  >
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0 text-sm font-semibold text-ink">
                    <span className="text-ink-3">{code}</span> {item.label}
                  </span>
                </span>
                <span className="text-xs leading-snug text-ink-3">{CATEGORY_SHORT[code]}</span>
                {!item.inContract && (
                  <span className="w-fit rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-semibold text-warning-ink">
                    Fora do contrato
                  </span>
                )}
              </label>
            );
          })}
        </div>

        {definition && (
          <div className="animate-fade rounded-xl border border-line bg-surface-2 p-3 text-xs leading-relaxed text-ink-2">
            <p>{definition.description}</p>
            <p className="mt-1.5 font-semibold text-ink">
              {definition.hasQuota
                ? `Conta no teto mensal por ${definition.unitLabel.one}.`
                : definition.inContract
                  ? "Sem teto — coberto pela garantia, dentro da reserva de capacidade."
                  : "Fora do contrato de sustentação — segue para orçamento com aceite formal."}
            </p>
          </div>
        )}
      </fieldset>

      {needsSeverity && (
        <fieldset className="animate-fade-up space-y-2.5">
          <legend className="text-sm font-medium text-ink">
            Qual o impacto? <span className="text-critical">*</span>
          </legend>

          <div className="grid grid-cols-1 gap-2 min-[520px]:grid-cols-2">
            {SEVERITY_ORDER.map((code) => {
              const Icon = SEVERITY_ICON[code];
              const active = severity === code;
              const item = SEVERITY_DEFINITIONS[code];

              return (
                <label
                  key={code}
                  className={cn(
                    "flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition",
                    active ? SEVERITY_ACTIVE[code] : "border-line bg-surface hover:border-line-strong hover:bg-surface-2"
                  )}
                >
                  <input
                    type="radio"
                    name="severity"
                    value={code}
                    required
                    checked={active}
                    onChange={() => setSeverity(code)}
                    className="sr-only"
                  />
                  <Icon size={17} className={cn("mt-0.5 shrink-0", SEVERITY_ICON_TONE[code])} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-ink">
                      {code} · {item.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-ink-3">{item.description}</span>
                    <span className="mt-1.5 block text-[11px] font-medium text-ink-2">
                      1ª resposta em {formatHours(item.firstResponseHours)} úteis
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          {severity && (
            <div className="animate-fade rounded-xl border border-brand/30 bg-brand-soft p-3 text-xs text-brand-ink">
              <p className="font-semibold">
                Compromisso: 1ª resposta em {formatHours(SEVERITY_DEFINITIONS[severity].firstResponseHours)}
                {SEVERITY_DEFINITIONS[severity].workaroundHours !== null &&
                  ` · contorno em ${formatHours(SEVERITY_DEFINITIONS[severity].workaroundHours!)}`}
                {SEVERITY_DEFINITIONS[severity].definitiveFixHours !== null
                  ? ` · correção em ${formatHours(SEVERITY_DEFINITIONS[severity].definitiveFixHours!)}`
                  : " · correção na próxima release"}
                {" "}(horas úteis)
              </p>
              <p className="mt-1 opacity-85">
                Quando a correção exigir publicação, o tempo de revisão da Google Play fica fora do
                SLA. O compromisso controlável é o contorno.
              </p>
            </div>
          )}
        </fieldset>
      )}

      {(countsUnits || canClassify) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {countsUnits && definition && (
            <div className="space-y-1.5">
              <label htmlFor="units" className="text-sm font-medium text-ink">
                Quantidade de {definition.unitLabel.many} <span className="text-critical">*</span>
              </label>
              <input
                type="number"
                id="units"
                name="units"
                min={1}
                step={1}
                defaultValue={defaultUnits}
                required
                className={FIELD_CLASS}
              />
              <p className="text-xs text-ink-3">
                Uma demanda é atômica: doze estabelecimentos são doze {definition.unitLabel.many}.
              </p>
            </div>
          )}

          {canClassify && (
            <div className="space-y-1.5">
              <label htmlFor="channel" className="text-sm font-medium text-ink">
                Canal de origem
              </label>
              <select id="channel" name="channel" defaultValue="PORTAL" className={FIELD_CLASS}>
                <option value="PORTAL">Portal</option>
                <option value="EMAIL">E-mail</option>
                <option value="TELEFONE">Telefone</option>
                <option value="PRESENCIAL">Presencial</option>
                <option value="OUTRO">Outro</option>
              </select>
              <p className="text-xs text-ink-3">
                O SLA começa no registro no sistema, não na mensagem avulsa.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
