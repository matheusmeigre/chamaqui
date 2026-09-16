import { AlertOctagon, CheckCircle2, Hourglass, Minus } from "lucide-react";
import type { SlaSummary } from "@/server/services/sla-summary";
import { cn, formatHours } from "@/lib/ui";

/**
 * O estado de SLA de um chamado numa linha. Ícone + texto sempre: a cor de
 * estado nunca carrega o significado sozinha.
 */
export function SlaChip({ summary, compact = false }: { summary: SlaSummary; compact?: boolean }) {
  if (summary.state === "NA") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-ink-3" title="SLA por severidade só se aplica a C1">
        <Minus size={12} />
        {!compact && "Sem SLA"}
      </span>
    );
  }

  if (summary.state === "MET") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-good-ink">
        <CheckCircle2 size={13} />
        Cumprido
      </span>
    );
  }

  if (summary.state === "BREACHED") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-critical-soft px-2 py-0.5 text-xs font-semibold text-critical-ink"
        title={`${summary.label} estourado`}
      >
        <AlertOctagon size={12} />
        +{formatHours(summary.overHours)}
        {!compact && <span className="font-normal opacity-80">{summary.label.toLowerCase()}</span>}
      </span>
    );
  }

  const risk = summary.state === "RISK";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        risk
          ? "rounded-full bg-warning-soft px-2 py-0.5 font-semibold text-warning-ink"
          : "font-medium text-ink-2"
      )}
      title={`${summary.label}: ${Math.round(summary.ratio * 100)}% do prazo consumido`}
    >
      <Hourglass size={12} />
      {formatHours(summary.remainingHours)}
      {!compact && <span className="font-normal opacity-80">{summary.label.toLowerCase()}</span>}
    </span>
  );
}
