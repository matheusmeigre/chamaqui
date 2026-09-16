"use client";

import { useState } from "react";
import type { Severity, TicketCategoryCode } from "@prisma/client";
import {
  CATEGORY_DEFINITIONS,
  CATEGORY_ORDER,
  SEVERITY_DEFINITIONS,
  SEVERITY_ORDER,
} from "@/server/domain/ticket-grid";

const selectClass =
  "w-full min-w-0 border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white text-slate-900";

const labelClass = "block text-sm font-medium text-slate-700";

type Props = {
  /** Somente administradores classificam severidade e canal de origem. */
  canClassify: boolean;
  defaultCategory?: TicketCategoryCode | null;
  defaultSeverity?: Severity | null;
  defaultUnits?: number;
};

export function ClassificationFields({
  canClassify,
  defaultCategory = null,
  defaultSeverity = null,
  defaultUnits = 1,
}: Props) {
  const [category, setCategory] = useState<TicketCategoryCode | "">(defaultCategory ?? "");
  const [severity, setSeverity] = useState<Severity | "">(defaultSeverity ?? "");

  const definition = category ? CATEGORY_DEFINITIONS[category] : null;
  const needsSeverity = definition?.requiresSeverity ?? false;
  const countsUnits =
    definition !== null && definition.unit !== "CHAMADO" && definition.unit !== "PROJETO";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <label htmlFor="categoryCode" className={labelClass}>
          Natureza da demanda <span className="text-red-500">*</span>
        </label>
        <select
          id="categoryCode"
          name="categoryCode"
          required
          value={category}
          onChange={(e) => {
            const next = e.target.value as TicketCategoryCode | "";
            setCategory(next);
            // Severidade é exclusiva de C1: sair de C1 limpa o campo para não
            // enviar uma combinação que o servidor vai recusar.
            if (!next || !CATEGORY_DEFINITIONS[next].requiresSeverity) setSeverity("");
          }}
          className={selectClass}
        >
          <option value="">Selecione a natureza...</option>
          {CATEGORY_ORDER.map((code) => (
            <option key={code} value={code}>
              {code} — {CATEGORY_DEFINITIONS[code].label}
            </option>
          ))}
        </select>

        {definition && (
          <div className="mt-2 rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 space-y-2">
            <p>{definition.description}</p>
            <p className="font-medium text-slate-700">
              {definition.hasQuota
                ? `Conta no teto mensal por ${definition.unitLabel.one}.`
                : definition.inContract
                  ? "Sem teto — coberto pela garantia, dentro da reserva de capacidade."
                  : "Fora do contrato de sustentação — segue para orçamento com aceite formal."}
            </p>
          </div>
        )}
      </div>

      {needsSeverity && (
        <div className="space-y-1">
          <label htmlFor="severity" className={labelClass}>
            Severidade <span className="text-red-500">*</span>
          </label>
          <select
            id="severity"
            name="severity"
            required
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Severity | "")}
            className={selectClass}
          >
            <option value="">Selecione a severidade...</option>
            {SEVERITY_ORDER.map((code) => (
              <option key={code} value={code}>
                {code} — {SEVERITY_DEFINITIONS[code].label}
              </option>
            ))}
          </select>

          {severity && (
            <div className="mt-2 rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-900 space-y-1">
              <p>{SEVERITY_DEFINITIONS[severity].description}</p>
              <p className="font-medium">
                1ª resposta em {SEVERITY_DEFINITIONS[severity].firstResponseHours} h úteis
                {SEVERITY_DEFINITIONS[severity].workaroundHours !== null &&
                  ` · contorno em ${SEVERITY_DEFINITIONS[severity].workaroundHours} h úteis`}
                {SEVERITY_DEFINITIONS[severity].definitiveFixHours !== null
                  ? ` · correção definitiva em ${SEVERITY_DEFINITIONS[severity].definitiveFixHours} h úteis`
                  : " · correção na próxima release"}
              </p>
              <p className="text-blue-700">
                Quando a correção exigir publicação, o tempo de revisão da Google Play fica fora
                do SLA. O compromisso controlável é o contorno.
              </p>
            </div>
          )}
        </div>
      )}

      {countsUnits && definition && (
        <div className="space-y-1">
          <label htmlFor="units" className={labelClass}>
            Quantidade de {definition.unitLabel.many} <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            id="units"
            name="units"
            min={1}
            step={1}
            defaultValue={defaultUnits}
            required
            className={selectClass}
          />
          <p className="text-xs text-slate-500">
            Uma demanda é atômica e verificável: uma lista com doze estabelecimentos são doze{" "}
            {definition.unitLabel.many}, não um chamado só.
          </p>
        </div>
      )}

      {canClassify && (
        <div className="space-y-1">
          <label htmlFor="channel" className={labelClass}>
            Canal de origem
          </label>
          <select id="channel" name="channel" defaultValue="PORTAL" className={selectClass}>
            <option value="PORTAL">Portal</option>
            <option value="EMAIL">E-mail</option>
            <option value="TELEFONE">Telefone</option>
            <option value="PRESENCIAL">Presencial</option>
            <option value="OUTRO">Outro</option>
          </select>
          <p className="text-xs text-slate-500">
            A contagem de SLA começa no registro no sistema, não na mensagem avulsa.
          </p>
        </div>
      )}
    </div>
  );
}
