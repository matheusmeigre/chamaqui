"use client";

import { useCallback, useMemo, useState } from "react";
import { TableShell, Td, Th } from "@/components/ui";
import {
  areaPath,
  axisNumber,
  CHROME,
  linearScale,
  niceMax,
  smoothPath,
  tickValues,
} from "./primitives";
import { ChartFrame, Tooltip, type LegendItem } from "./ChartFrame";

export type TimeSeriesDefinition = {
  key: string;
  label: string;
  color: string;
  /** A área só faz sentido embaixo de uma série; com duas vira sopa. */
  area?: boolean;
};

export type TimeSeriesPoint = {
  /** Rótulo curto do eixo x: "12/09". */
  label: string;
  /** Rótulo longo da dica: "12 de setembro". */
  fullLabel?: string;
  values: Record<string, number>;
};

const PADDING = { top: 14, right: 16, bottom: 26, left: 38 };

export function TimeSeriesChart({
  points,
  series,
  height = 240,
  valueSuffix = "",
  footnote,
  integer = true,
}: {
  points: TimeSeriesPoint[];
  series: TimeSeriesDefinition[];
  height?: number;
  valueSuffix?: string;
  footnote?: React.ReactNode;
  /** Eixo em passos inteiros — contagens não têm meio chamado. */
  integer?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);

  const max = useMemo(() => {
    const peak = points.reduce((acc, point) => {
      const localMax = series.reduce((m, s) => Math.max(m, point.values[s.key] ?? 0), 0);
      return Math.max(acc, localMax);
    }, 0);
    return niceMax(peak, 4, integer);
  }, [points, series, integer]);

  const legend: LegendItem[] =
    series.length > 1
      ? series.map((s) => ({ label: s.label, color: s.color, shape: "line" as const }))
      : [];

  const table = (
    <TableShell minWidth={280}>
      <thead>
        <tr>
          <Th>Período</Th>
          {series.map((s) => (
            <Th key={s.key} align="right">
              {s.label}
            </Th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {points.map((point) => (
          <tr key={point.label}>
            <Td className="font-medium text-ink">{point.fullLabel ?? point.label}</Td>
            {series.map((s) => (
              <Td key={s.key} align="right" numeric>
                {point.values[s.key] ?? 0}
                {valueSuffix}
              </Td>
            ))}
          </tr>
        ))}
      </tbody>
    </TableShell>
  );

  return (
    <ChartFrame legend={legend} table={table} height={height} footnote={footnote}>
      {(width) => (
        <Plot
          width={width}
          height={height}
          points={points}
          series={series}
          max={max}
          active={active}
          setActive={setActive}
          valueSuffix={valueSuffix}
        />
      )}
    </ChartFrame>
  );
}

function Plot({
  width,
  height,
  points,
  series,
  max,
  active,
  setActive,
  valueSuffix,
}: {
  width: number;
  height: number;
  points: TimeSeriesPoint[];
  series: TimeSeriesDefinition[];
  max: number;
  active: number | null;
  setActive: (index: number | null) => void;
  valueSuffix: string;
}) {
  const plotWidth = Math.max(10, width - PADDING.left - PADDING.right);
  const plotHeight = Math.max(10, height - PADDING.top - PADDING.bottom);

  const x = useCallback(
    (index: number) =>
      PADDING.left +
      (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth),
    [plotWidth, points.length]
  );

  const y = useMemo(
    () => linearScale([0, max], [PADDING.top + plotHeight, PADDING.top]),
    [max, plotHeight]
  );

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - bounds.left;
    const ratio = (localX - PADDING.left) / plotWidth;
    const index = Math.round(ratio * (points.length - 1));
    setActive(Math.max(0, Math.min(points.length - 1, index)));
  };

  const onKeyDown = (event: React.KeyboardEvent<SVGSVGElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const step = event.key === "ArrowLeft" ? -1 : 1;
    const base = active ?? (step > 0 ? -1 : points.length);
    setActive(Math.max(0, Math.min(points.length - 1, base + step)));
  };

  // Um rótulo a cada N posições evita colisão em janelas estreitas.
  const labelStride = Math.max(1, Math.ceil(points.length / Math.floor(plotWidth / 56)));
  const activePoint = active === null ? null : points[active];

  return (
    <div className="relative">
      <svg
        width={width}
        height={height}
        role="img"
        tabIndex={0}
        aria-label={`Evolução de ${series.map((s) => s.label).join(" e ")} ao longo do período`}
        className="touch-pan-y outline-none"
        onPointerMove={onPointerMove}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive(points.length - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={onKeyDown}
      >
        {/* Grade: hairline sólida, um passo fora da superfície */}
        {tickValues(max, 4).map((tick) => (
          <g key={tick}>
            <line
              x1={PADDING.left}
              x2={PADDING.left + plotWidth}
              y1={y(tick)}
              y2={y(tick)}
              stroke={CHROME.grid}
              strokeWidth={1}
            />
            <text
              x={PADDING.left - 8}
              y={y(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              fill={CHROME.muted}
              fontSize={10}
              className="tabular-nums"
            >
              {axisNumber(tick)}
            </text>
          </g>
        ))}

        {points.map((point, index) =>
          index % labelStride === 0 ? (
            <text
              key={`${point.label}-${index}`}
              x={x(index)}
              y={height - 8}
              textAnchor="middle"
              fill={CHROME.muted}
              fontSize={10}
            >
              {point.label}
            </text>
          ) : null
        )}

        {series.map((definition) => {
          const coords = points.map((point, index) => ({
            x: x(index),
            y: y(point.values[definition.key] ?? 0),
          }));

          const showArea = definition.area ?? series.length === 1;

          return (
            <g key={definition.key}>
              {showArea && (
                <path
                  d={areaPath(coords, PADDING.top + plotHeight)}
                  fill={definition.color}
                  opacity={0.1}
                />
              )}
              <path
                d={smoothPath(coords)}
                fill="none"
                stroke={definition.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                pathLength={1}
                className="chart-draw"
              />
              {/* Marcador final com anel da superfície: legível sobre qualquer traço */}
              {coords.length > 0 && (
                <circle
                  cx={coords[coords.length - 1].x}
                  cy={coords[coords.length - 1].y}
                  r={4}
                  fill={definition.color}
                  stroke={CHROME.surface}
                  strokeWidth={2}
                />
              )}
            </g>
          );
        })}

        {/* Fio de prumo: o leitor mira numa data, nunca num traço de 2px */}
        {active !== null && (
          <g pointerEvents="none">
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PADDING.top}
              y2={PADDING.top + plotHeight}
              stroke={CHROME.axis}
              strokeWidth={1}
            />
            {series.map((definition) => (
              <circle
                key={definition.key}
                cx={x(active)}
                cy={y(points[active].values[definition.key] ?? 0)}
                r={4.5}
                fill={definition.color}
                stroke={CHROME.surface}
                strokeWidth={2}
              />
            ))}
          </g>
        )}
      </svg>

      {activePoint && (
        <Tooltip
          x={x(active!)}
          y={8}
          containerWidth={width}
          title={activePoint.fullLabel ?? activePoint.label}
          rows={series.map((definition) => ({
            label: definition.label,
            color: definition.color,
            value: `${activePoint.values[definition.key] ?? 0}${valueSuffix}`,
          }))}
        />
      )}
    </div>
  );
}
