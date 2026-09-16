import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Sparkline } from "@/components/charts/Sparkline";
import { cn } from "@/lib/ui";

export type StatTileProps = {
  label: string;
  /** Já formatado: "128", "92%", "3h20". Figuras proporcionais, sem tabular. */
  value: string;
  caption?: string;
  icon?: React.ReactNode;
  href?: string;
  trend?: number[];
  delta?: {
    /** Variação em pontos percentuais ou unidades, já com sinal. */
    value: number;
    /** "vs. 30 dias anteriores" */
    period: string;
    /** Em backlog e tempo de resposta, subir é ruim. */
    goodWhen?: "up" | "down";
    suffix?: string;
  };
  tone?: "neutral" | "brand" | "good" | "warning" | "critical";
  className?: string;
};

const ACCENT: Record<NonNullable<StatTileProps["tone"]>, string> = {
  neutral: "var(--ink-3)",
  brand: "var(--brand)",
  good: "var(--good)",
  warning: "var(--warning)",
  critical: "var(--critical)",
};

const ICON_WRAP: Record<NonNullable<StatTileProps["tone"]>, string> = {
  neutral: "bg-surface-3 text-ink-3",
  brand: "bg-brand-soft text-brand-ink",
  good: "bg-good-soft text-good-ink",
  warning: "bg-warning-soft text-warning-ink",
  critical: "bg-critical-soft text-critical-ink",
};

export function StatTile({
  label,
  value,
  caption,
  icon,
  href,
  trend,
  delta,
  tone = "brand",
  className: extraClassName,
}: StatTileProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-ink-2">{label}</p>
        {icon && (
          <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", ICON_WRAP[tone])}>
            {icon}
          </span>
        )}
      </div>

      <div className="mt-2.5 flex items-end justify-between gap-3">
        <p className="text-[2rem] font-bold leading-none tracking-tight text-ink">{value}</p>
        {trend && trend.length > 1 && (
          <Sparkline
            values={trend}
            color={ACCENT[tone]}
            ariaLabel={`Tendência de ${label}`}
          />
        )}
      </div>

      {(delta || caption) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
          {delta && <DeltaPill {...delta} />}
          {caption && <span className="text-xs text-ink-3">{caption}</span>}
        </div>
      )}
    </>
  );

  const className = cn(
    "block rounded-2xl border border-line bg-surface p-4 shadow-card transition sm:p-5",
    href && "hover:border-line-strong hover:shadow-raised",
    extraClassName
  );

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

function DeltaPill({
  value,
  period,
  goodWhen = "up",
  suffix = "",
}: NonNullable<StatTileProps["delta"]>) {
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-soft px-2 py-0.5 text-[11px] font-semibold text-neutral-ink">
        <Minus size={11} />
        estável
        <span className="font-normal opacity-75">{period}</span>
      </span>
    );
  }

  const up = value > 0;
  const good = goodWhen === "up" ? up : !up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        good ? "bg-good-soft text-good-ink" : "bg-critical-soft text-critical-ink"
      )}
    >
      <Icon size={11} />
      {up ? "+" : ""}
      {value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
      {suffix}
      <span className="font-normal opacity-75">{period}</span>
    </span>
  );
}
