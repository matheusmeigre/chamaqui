"use client";

import { cn, formatNumber } from "@/lib/ui";

export type StackSegment = {
  key: string;
  label: string;
  value: number;
  color: string;
  icon?: React.ReactNode;
};

export type StackRow = {
  key: string;
  label: string;
  sublabel?: string;
  segments: StackSegment[];
};

/**
 * Parte-do-todo por linha. A separação entre segmentos é um vão de 2px na cor
 * da superfície — nunca um contorno, que acrescentaria tinta sem dado.
 */
export function StackedBars({
  rows,
  className,
  emptyLabel = "Sem dados no período.",
}: {
  rows: StackRow[];
  className?: string;
  emptyLabel?: string;
}) {
  const visible = rows.filter((row) => row.segments.some((segment) => segment.value > 0));

  if (visible.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-3">{emptyLabel}</p>;
  }

  return (
    <ul className={cn("space-y-3.5", className)}>
      {visible.map((row) => {
        const total = row.segments.reduce((acc, segment) => acc + segment.value, 0);

        return (
          <li key={row.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-ink">
                {row.label}
                {row.sublabel && (
                  <span className="ml-1.5 text-xs font-normal text-ink-3">{row.sublabel}</span>
                )}
              </span>
              <span className="text-xs tabular-nums text-ink-3">{formatNumber(total)}</span>
            </div>

            <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-surface-3">
              {row.segments
                .filter((segment) => segment.value > 0)
                .map((segment) => (
                  <div
                    key={segment.key}
                    title={`${segment.label}: ${formatNumber(segment.value)}`}
                    className="h-full min-w-[3px] rounded-[2px] transition-[flex-grow] duration-500 first:rounded-l-full last:rounded-r-full"
                    style={{ flexGrow: segment.value, background: segment.color }}
                  />
                ))}
            </div>

            {/* Rótulo + ícone ao lado de cada tom: a cor de estado nunca carrega
                o significado sozinha. */}
            <ul className="flex flex-wrap items-center gap-x-3.5 gap-y-1">
              {row.segments
                .filter((segment) => segment.value > 0)
                .map((segment) => (
                  <li key={segment.key} className="flex items-center gap-1 text-xs text-ink-3">
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-[2px]"
                      style={{ background: segment.color }}
                    />
                    {segment.icon}
                    <span>{segment.label}</span>
                    <span className="font-semibold tabular-nums text-ink-2">
                      {formatNumber(segment.value)}
                    </span>
                  </li>
                ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
