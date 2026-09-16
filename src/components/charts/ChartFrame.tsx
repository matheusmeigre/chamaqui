"use client";

import { useEffect, useRef, useState } from "react";
import { Table2, ChartColumnBig } from "lucide-react";
import { cn } from "@/lib/ui";

/* ---------------------------------------------------------------------------
   Medida do contêiner
   Um SVG esticado por preserveAspectRatio deforma o texto. Medimos a largura
   real e desenhamos em pixels — rótulos ficam legíveis em qualquer viewport.
--------------------------------------------------------------------------- */

export function useMeasuredWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      setWidth((current) => (Math.abs(current - next) > 0.5 ? next : current));
    });

    observer.observe(node);
    setWidth(node.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

/* ---------------------------------------------------------------------------
   Legenda
--------------------------------------------------------------------------- */

export type LegendItem = {
  label: string;
  color: string;
  /** Linha para séries de linha; retângulo para barras e áreas. */
  shape?: "line" | "rect";
  icon?: React.ReactNode;
  value?: string;
};

export function Legend({ items, className }: { items: LegendItem[]; className?: string }) {
  if (items.length === 0) return null;

  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs text-ink-2">
          {item.icon ?? (
            <span
              aria-hidden
              className={cn(
                "shrink-0",
                item.shape === "line" ? "h-0.5 w-3.5 rounded-full" : "h-2.5 w-2.5 rounded-[3px]"
              )}
              style={{ background: item.color }}
            />
          )}
          <span>{item.label}</span>
          {item.value && <span className="font-semibold tabular-nums text-ink">{item.value}</span>}
        </li>
      ))}
    </ul>
  );
}

/* ---------------------------------------------------------------------------
   Moldura
   Toda visualização vem com um gêmeo em tabela: a dica de ferramenta enriquece,
   nunca é a única via para o número.
--------------------------------------------------------------------------- */

export function ChartFrame({
  legend,
  table,
  height,
  children,
  footnote,
  className,
  dimmed = false,
}: {
  legend?: LegendItem[];
  table?: React.ReactNode;
  height: number;
  children: (width: number) => React.ReactNode;
  footnote?: React.ReactNode;
  className?: string;
  /** Mantém o desenho anterior esmaecido durante uma recarga. */
  dimmed?: boolean;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const { ref, width } = useMeasuredWidth<HTMLDivElement>();

  return (
    <div className={cn("space-y-3", className)}>
      {(legend?.length || table) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Legend items={legend ?? []} />
          {table && (
            <div className="no-print ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-line bg-surface-2 p-0.5">
              <button
                type="button"
                aria-pressed={view === "chart"}
                onClick={() => setView("chart")}
                title="Ver como gráfico"
                className={cn(
                  "grid h-6 w-7 place-items-center rounded-md transition",
                  view === "chart" ? "bg-surface text-ink shadow-card" : "text-ink-3 hover:text-ink-2"
                )}
              >
                <ChartColumnBig size={13} />
              </button>
              <button
                type="button"
                aria-pressed={view === "table"}
                onClick={() => setView("table")}
                title="Ver como tabela"
                className={cn(
                  "grid h-6 w-7 place-items-center rounded-md transition",
                  view === "table" ? "bg-surface text-ink shadow-card" : "text-ink-3 hover:text-ink-2"
                )}
              >
                <Table2 size={13} />
              </button>
            </div>
          )}
        </div>
      )}

      {view === "table" && table ? (
        <div className="animate-fade">{table}</div>
      ) : (
        <div
          ref={ref}
          className={cn("w-full transition-opacity", dimmed && "opacity-50")}
          style={{ minHeight: height }}
        >
          {width > 0 ? children(width) : null}
        </div>
      )}

      {footnote && <p className="text-xs leading-relaxed text-ink-3">{footnote}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Dica de ferramenta
   Valor em destaque, nome da série em segundo plano: aqui o leitor já sabe qual
   série é e quer o número.
--------------------------------------------------------------------------- */

export function Tooltip({
  x,
  y,
  containerWidth,
  title,
  rows,
}: {
  x: number;
  y: number;
  containerWidth: number;
  title: string;
  rows: Array<{ label: string; value: string; color?: string }>;
}) {
  const WIDTH = 168;
  const left = Math.max(4, Math.min(x - WIDTH / 2, containerWidth - WIDTH - 4));

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute z-20 rounded-xl border border-line bg-surface px-3 py-2 shadow-float"
      style={{ left, top: Math.max(4, y), width: WIDTH }}
    >
      <p className="mb-1.5 text-[11px] font-medium text-ink-3">{title}</p>
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              {row.color && (
                <span
                  aria-hidden
                  className="h-0.5 w-3 shrink-0 rounded-full"
                  style={{ background: row.color }}
                />
              )}
              <span className="truncate text-[11px] text-ink-2">{row.label}</span>
            </span>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-ink">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
