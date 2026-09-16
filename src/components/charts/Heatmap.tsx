"use client";

import { useState } from "react";
import { TableShell, Td, Th } from "@/components/ui";
import { formatNumber } from "@/lib/ui";
import { SEQUENTIAL } from "./primitives";
import { ChartFrame } from "./ChartFrame";

export type HeatmapMatrix = {
  rows: Array<{ key: string; label: string }>;
  columns: Array<{ key: string; label: string; hint?: string }>;
  /** valores[linha][coluna] */
  values: number[][];
};

/**
 * Magnitude contínua numa grade: um tom só, claro → escuro. A legenda de escala
 * é obrigatória — sem ela a cor não diz quanto vale.
 */
export function Heatmap({
  matrix,
  valueLabel = "chamados",
  footnote,
}: {
  matrix: HeatmapMatrix;
  valueLabel?: string;
  footnote?: React.ReactNode;
}) {
  const [hover, setHover] = useState<{ row: number; column: number } | null>(null);

  const flat = matrix.values.flat();
  const max = Math.max(1, ...flat);

  const binOf = (value: number) => {
    if (value === 0) return 0;
    const ratio = value / max;
    return Math.min(SEQUENTIAL.length - 1, Math.ceil(ratio * (SEQUENTIAL.length - 1)));
  };

  const table = (
    <TableShell minWidth={420}>
      <thead>
        <tr>
          <Th>Severidade</Th>
          {matrix.columns.map((column) => (
            <Th key={column.key} align="right">
              {column.label}
            </Th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {matrix.rows.map((row, rowIndex) => (
          <tr key={row.key}>
            <Td className="font-medium text-ink">{row.label}</Td>
            {matrix.columns.map((column, columnIndex) => (
              <Td key={column.key} align="right" numeric>
                {matrix.values[rowIndex]?.[columnIndex] ?? 0}
              </Td>
            ))}
          </tr>
        ))}
      </tbody>
    </TableShell>
  );

  const active =
    hover === null ? null : { ...hover, value: matrix.values[hover.row]?.[hover.column] ?? 0 };

  return (
    <ChartFrame table={table} height={0} footnote={footnote}>
      {() => (
        <div className="space-y-3">
          <div className="scroll-thin overflow-x-auto">
            <div style={{ minWidth: 340 }}>
              {/* Cabeçalho das faixas */}
              <div
                className="grid gap-1 pb-1.5"
                style={{
                  gridTemplateColumns: `72px repeat(${matrix.columns.length}, minmax(0, 1fr))`,
                }}
              >
                <span />
                {matrix.columns.map((column) => (
                  <span
                    key={column.key}
                    className="text-center text-[10px] font-medium text-ink-3"
                    title={column.hint}
                  >
                    {column.label}
                  </span>
                ))}
              </div>

              {matrix.rows.map((row, rowIndex) => (
                <div
                  key={row.key}
                  className="grid items-center gap-1 pb-1"
                  style={{
                    gridTemplateColumns: `72px repeat(${matrix.columns.length}, minmax(0, 1fr))`,
                  }}
                >
                  <span className="truncate pr-2 text-xs font-medium text-ink-2">{row.label}</span>
                  {matrix.columns.map((column, columnIndex) => {
                    const value = matrix.values[rowIndex]?.[columnIndex] ?? 0;
                    const isHover = hover?.row === rowIndex && hover?.column === columnIndex;
                    const bin = binOf(value);

                    return (
                      <button
                        key={column.key}
                        type="button"
                        onPointerEnter={() => setHover({ row: rowIndex, column: columnIndex })}
                        onPointerLeave={() => setHover(null)}
                        onFocus={() => setHover({ row: rowIndex, column: columnIndex })}
                        onBlur={() => setHover(null)}
                        aria-label={`${row.label}, ${column.label}: ${value} ${valueLabel}`}
                        className="grid h-9 place-items-center rounded-md text-xs font-semibold tabular-nums transition"
                        style={{
                          background: SEQUENTIAL[bin],
                          // Tinta por passo e por tema (--seq-on-N): a rampa inverte no
                          // escuro, então a escolha não pode ser fixa no componente.
                          color: value === 0 ? "var(--ink-3)" : `var(--seq-on-${bin})`,
                          outline: isHover ? "2px solid var(--brand)" : "none",
                          outlineOffset: isHover ? "-2px" : undefined,
                        }}
                      >
                        {value === 0 ? "·" : value}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Legenda de escala */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-3">
            <span>0</span>
            <span className="flex gap-0.5">
              {SEQUENTIAL.map((color, index) => (
                <span
                  key={color}
                  className="h-2.5 w-5 rounded-[2px] first:rounded-l last:rounded-r"
                  style={{ background: color }}
                  aria-hidden
                  title={`Faixa ${index}`}
                />
              ))}
            </span>
            <span>{formatNumber(max)} {valueLabel}</span>
            {active && active.value > 0 && (
              <span className="ml-auto font-medium text-ink-2">
                {matrix.rows[active.row].label} · {matrix.columns[active.column].label}:{" "}
                <span className="font-semibold text-ink">{active.value}</span>
              </span>
            )}
          </div>
        </div>
      )}
    </ChartFrame>
  );
}
