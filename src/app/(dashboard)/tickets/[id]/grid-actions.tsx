"use client";

import { useState } from "react";
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

const field =
  "w-full min-w-0 border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 text-slate-900";
const label = "block text-xs font-medium text-slate-600 mb-1";
const primaryButton =
  "w-full min-h-11 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 transition";
const subtleButton =
  "w-full min-h-11 border border-slate-300 bg-white text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition";

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-t border-slate-200 pt-4 first:border-0 first:pt-0">
      <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
      {children}
    </section>
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
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 space-y-5">
      <h3 className="text-lg font-semibold text-gray-800">Grade — Ações técnicas</h3>

      {/* ------------------------------------------------------------------ */}
      {contestationOpen && (
        <Section title="Contestação de categoria em aberto">
          <p className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs text-blue-900">
            Motivo do cliente: {contestationReason || "não informado"}
          </p>

          <form action={decideContestation} className="space-y-2">
            <input type="hidden" name="ticketId" value={ticketId} />
            <input type="hidden" name="decision" value="MANTIDA" />
            <button type="submit" className={subtleButton}>Manter classificação</button>
          </form>

          <form action={decideContestation} className="space-y-2">
            <input type="hidden" name="ticketId" value={ticketId} />
            <input type="hidden" name="decision" value="ALTERADA" />
            <div>
              <label className={label} htmlFor="grid-new-category">Acatar e alterar para</label>
              <select id="grid-new-category" name="newCategoryCode" className={field} defaultValue="">
                <option value="">Selecione...</option>
                {CATEGORY_ORDER.map((code) => (
                  <option key={code} value={code}>
                    {code} — {CATEGORY_DEFINITIONS[code].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="grid-new-severity">
                Severidade (somente para C1)
              </label>
              <select id="grid-new-severity" name="newSeverity" className={field} defaultValue="">
                <option value="">Não se aplica</option>
                {SEVERITY_ORDER.map((code) => (
                  <option key={code} value={code}>
                    {code} — {SEVERITY_DEFINITIONS[code].label}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className={subtleButton}>Acatar contestação</button>
          </form>
        </Section>
      )}

      {/* ------------------------------------------------------------------ */}
      <Section title="Classificação">
        <form action={reclassifyTicket} className="space-y-3">
          <input type="hidden" name="ticketId" value={ticketId} />

          <div>
            <label className={label} htmlFor="grid-category">Natureza</label>
            <select
              id="grid-category"
              name="categoryCode"
              required
              className={field}
              value={category}
              onChange={(e) => {
                const next = e.target.value as TicketCategoryCode | "";
                setCategory(next);
                if (!next || !CATEGORY_DEFINITIONS[next].requiresSeverity) setNewSeverity("");
              }}
            >
              <option value="">Selecione...</option>
              {CATEGORY_ORDER.map((code) => (
                <option key={code} value={code}>
                  {code} — {CATEGORY_DEFINITIONS[code].label}
                </option>
              ))}
            </select>
          </div>

          {needsSeverity && (
            <div>
              <label className={label} htmlFor="grid-severity">Severidade</label>
              <select
                id="grid-severity"
                name="severity"
                required
                className={field}
                value={newSeverity}
                onChange={(e) => setNewSeverity(e.target.value as Severity | "")}
              >
                <option value="">Selecione...</option>
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
                className={field}
              />
            </div>
          )}

          <button type="submit" className={subtleButton}>Salvar classificação</button>
        </form>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {(categoryCode === "C1" || workaroundAt) && (
        <Section title="Contorno">
          {workaroundAt ? (
            <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg p-2">
              Contorno já registrado.
            </p>
          ) : (
            <form action={registerWorkaround} className="space-y-2">
              <input type="hidden" name="ticketId" value={ticketId} />
              <textarea
                name="note"
                rows={2}
                placeholder="O que foi feito para contornar o problema..."
                className={`${field} resize-none`}
              />
              <button type="submit" className={subtleButton}>Registrar contorno</button>
            </form>
          )}
        </Section>
      )}

      {/* ------------------------------------------------------------------ */}
      <Section title="Publicação na Google Play">
        <p className="text-xs text-slate-500">
          O tempo entre o envio e a aprovação sai do relógio de SLA da correção definitiva.
        </p>
        {!sentToStoreAt ? (
          <form action={registerStoreWindow}>
            <input type="hidden" name="ticketId" value={ticketId} />
            <input type="hidden" name="event" value="ENVIO" />
            <button type="submit" className={subtleButton}>Registrar envio à loja</button>
          </form>
        ) : !storeApprovedAt ? (
          <form action={registerStoreWindow} className="space-y-2">
            <input type="hidden" name="ticketId" value={ticketId} />
            <input type="hidden" name="event" value="APROVACAO" />
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
              Em revisão pela loja — o relógio do fornecedor está congelado.
            </p>
            <button type="submit" className={subtleButton}>Registrar aprovação</button>
          </form>
        ) : (
          <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg p-2">
            Versão publicada. A janela já foi descontada do SLA.
          </p>
        )}
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section title="Fechamento técnico">
        <form action={registerTechnicalClosure} className="space-y-3">
          <input type="hidden" name="ticketId" value={ticketId} />

          <div>
            <label className={label} htmlFor="grid-outcome">Desfecho</label>
            <select
              id="grid-outcome"
              name="outcome"
              required
              className={field}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as TicketOutcome)}
            >
              {(Object.keys(OUTCOME_LABELS) as TicketOutcome[])
                .filter((key) => key !== "RECLASSIFICADO")
                .map((key) => (
                  <option key={key} value={key}>{OUTCOME_LABELS[key]}</option>
                ))}
            </select>
            {outcome.startsWith("IMPROCEDENTE") || outcome === "DUPLICADO" ? (
              <p className="mt-1 text-xs text-slate-500">
                Não consome teto. O diagnóstico entra no relatório mensal.
              </p>
            ) : null}
          </div>

          <div>
            <label className={label} htmlFor="grid-hours">Esforço real (h)</label>
            <input
              id="grid-hours"
              type="number"
              name="actualHours"
              min={0}
              step={0.25}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className={field}
            />
          </div>

          {closureNeedsCorrectionClass && (
            <div>
              <label className={label} htmlFor="grid-correction">Classe de correção</label>
              <select
                id="grid-correction"
                name="correctionClass"
                required
                defaultValue={correctionClass ?? ""}
                className={field}
              >
                <option value="">Selecione...</option>
                <option value="SERVIDOR">Servidor — sem publicação, efeito imediato</option>
                <option value="CLIENTE">Cliente — exige publicação na Play</option>
              </select>
            </div>
          )}

          {exceedsC4Limit ? (
            <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800">
              {parsedHours} h ultrapassa o limite de {C4_MAX_EFFORT_HOURS} h de C4. Reclassifique
              como C5 com aceite formal antes de fechar.
            </p>
          ) : (
            <button type="submit" className={primaryButton}>Fechar chamado</button>
          )}
        </form>
      </Section>

      {/* ------------------------------------------------------------------ */}
      {(categoryCode === "C4" || exceedsC4Limit) && (
        <Section title="Reclassificar como C5 (fora do contrato)">
          <form action={reclassifyToC5} className="space-y-2">
            <input type="hidden" name="ticketId" value={ticketId} />
            <textarea
              name="acceptanceNote"
              rows={2}
              required
              placeholder="Referência do orçamento e aceite formal do cliente..."
              className={`${field} resize-none`}
            />
            <button type="submit" className={subtleButton}>Reclassificar para C5</button>
          </form>
        </Section>
      )}
    </div>
  );
}
