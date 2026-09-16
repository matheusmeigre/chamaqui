"use client";

import Link from "next/link";
import { TableShell, Td, Th } from "@/components/ui";
import { cn, formatNumber } from "@/lib/ui";
import { SERIES } from "./primitives";

export type BarDatum = {
  key: string;
  label: string;
  value: number;
  /** Exibido no lugar do número cru quando presente. */
  display?: string;
  hint?: string;
  href?: string;
  /** Só para escalas com ordem natural (ciclo de vida). Nominal usa um tom só. */
  color?: string;
};

/**
 * Comparação de magnitude entre categorias nomeadas.
 *
 * Um tom só por padrão: colorir cada barra por tamanho duplicaria o
 * comprimento em matiz e gastaria o único canal livre com informação que a
 * barra já dá. `color` existe para as escalas que têm ordem de verdade.
 */
export function BarList({
  data,
  total,
  emptyLabel = "Sem dados no período.",
  valueLabel = "Chamados",
  className,
  maxRows,
}: {
  data: BarDatum[];
  /** Denominador da barra. Padrão: o maior valor da lista. */
  total?: number;
  emptyLabel?: string;
  valueLabel?: string;
  className?: string;
  maxRows?: number;
}) {
  const rows = maxRows ? data.slice(0, maxRows) : data;
  const max = total ?? Math.max(1, ...rows.map((row) => row.value));

  if (rows.length === 0 || rows.every((row) => row.value === 0)) {
    return <p className="py-6 text-center text-sm text-ink-3">{emptyLabel}</p>;
  }

  return (
    <ul className={cn("space-y-2.5", className)}>
      {rows.map((row) => {
        const ratio = max === 0 ? 0 : row.value / max;
        const content = (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-ink-2" title={row.label}>
                {row.label}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">
                {row.display ?? formatNumber(row.value)}
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-l-[2px] rounded-r bg-surface-3">
              <div
                className="chart-grow h-full rounded-l-[2px] rounded-r transition-[width] duration-500"
                style={{
                  width: `${Math.max(ratio * 100, row.value > 0 ? 2 : 0)}%`,
                  background: row.color ?? SERIES[0],
                }}
              />
            </div>
            {row.hint && <p className="mt-1 text-xs text-ink-3">{row.hint}</p>}
          </>
        );

        return (
          <li key={row.key}>
            {row.href ? (
              <Link
                href={row.href}
                className="block rounded-lg px-1.5 py-1 transition hover:bg-surface-2"
                aria-label={`${row.label}: ${row.display ?? row.value} ${valueLabel}`}
              >
                {content}
              </Link>
            ) : (
              <div className="px-1.5 py-1">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Gêmeo em tabela — nenhum valor fica preso atrás do ponteiro. */
export function BarListTable({
  data,
  labelHeader = "Categoria",
  valueHeader = "Chamados",
}: {
  data: BarDatum[];
  labelHeader?: string;
  valueHeader?: string;
}) {
  return (
    <TableShell minWidth={260}>
      <thead>
        <tr>
          <Th>{labelHeader}</Th>
          <Th align="right">{valueHeader}</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {data.map((row) => (
          <tr key={row.key}>
            <Td className="text-ink">{row.label}</Td>
            <Td align="right" numeric>
              {row.display ?? formatNumber(row.value)}
            </Td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}
