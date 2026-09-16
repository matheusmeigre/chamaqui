"use client";

import { Loader2, Printer } from "lucide-react";
import { useQueryUpdater } from "@/components/ui/FilterControls";
import { formatCompetency } from "@/lib/ui";

const SELECT_CLASS =
  "h-10 min-w-0 rounded-xl border border-line bg-surface px-3 text-[13px] font-medium text-ink outline-none transition hover:border-line-strong focus:border-brand";

export function ReportFilters({
  organizations,
  organizationId,
  competencies,
  competency,
}: {
  organizations: Array<{ id: string; name: string }> | null;
  organizationId: string;
  competencies: string[];
  competency: string;
}) {
  const { update, pending } = useQueryUpdater();

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      {organizations && (
        <select
          aria-label="Organização"
          value={organizationId}
          // Trocar de organização invalida a competência escolhida para a anterior.
          onChange={(event) => update({ org: event.target.value, competency: null })}
          className={SELECT_CLASS}
        >
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      )}

      <select
        aria-label="Competência"
        value={competency}
        onChange={(event) => update({ competency: event.target.value })}
        className={SELECT_CLASS}
      >
        {competencies.map((item) => (
          <option key={item} value={item}>
            {formatCompetency(item)}
          </option>
        ))}
      </select>

      {pending && <Loader2 size={16} className="animate-spin text-ink-3" aria-label="Atualizando" />}

      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-[13px] font-medium text-ink-2 transition hover:border-line-strong hover:text-ink"
      >
        <Printer size={15} />
        Imprimir / PDF
      </button>
    </div>
  );
}
