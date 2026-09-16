/** Concatena classes ignorando falsos — o `clsx` mínimo de que a UI precisa. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** 1.284 → "1.284"; 12.900 → "12,9 mil". Valores de destaque ficam curtos. */
export function compactNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) < 1000) return String(value);
  if (Math.abs(value) < 1_000_000) {
    const k = value / 1000;
    return `${k.toFixed(k >= 10 ? 0 : 1).replace(".", ",")} mil`;
  }
  const m = value / 1_000_000;
  return `${m.toFixed(m >= 10 ? 0 : 1).replace(".", ",")} mi`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

/** Percentual a partir de uma fração (0..1). */
export function formatPercent(ratio: number | null, digits = 0): string {
  if (ratio === null || !Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits).replace(".", ",")}%`;
}

/** Horas úteis em formato curto: 2 h, 2h30, 18 h. */
export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return "—";
  const rounded = Math.round(hours * 100) / 100;
  const whole = Math.floor(rounded);
  const minutes = Math.round((rounded - whole) * 60);
  if (minutes === 0) return `${whole} h`;
  return `${whole}h${String(minutes).padStart(2, "0")}`;
}

/** Duração relativa curta para listas: "há 3 h", "há 2 d". */
export function formatAge(from: Date | string, now: Date = new Date()): string {
  const start = typeof from === "string" ? new Date(from) : from;
  const minutes = Math.floor((now.getTime() - start.getTime()) / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `há ${days} d`;
  const months = Math.floor(days / 30);
  return `há ${months} ${months === 1 ? "mês" : "meses"}`;
}

/** Iniciais para avatares: "Instituto Energisa" → "IE". */
export function initialsOf(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Identificador curto e legível de um chamado: "#A1B2C3D4". */
export function shortId(id: string): string {
  return `#${id.split("-")[0].toUpperCase()}`;
}

/** "2026-09" → "Setembro de 2026". */
export function formatCompetency(value: string): string {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return value;
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}
