/* ---------------------------------------------------------------------------
   Base dos gráficos
   As cores saem como var(--...) e não como hex: assim o gráfico troca de tema
   junto com o resto da interface, sem ramificação em JavaScript.
   A paleta e a ordem dos tons foram validadas em ambos os modos — a ordem é o
   mecanismo de segurança para daltonismo, não enfeite. Não cicle os slots.
--------------------------------------------------------------------------- */

/** Ordem fixa das séries categóricas. Nunca gere um nono tom. */
export const SERIES = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
] as const;

/** Rampa sequencial de um tom, para magnitude contínua (heatmap). */
export const SEQUENTIAL = [
  "var(--seq-0)",
  "var(--seq-1)",
  "var(--seq-2)",
  "var(--seq-3)",
  "var(--seq-4)",
  "var(--seq-5)",
  "var(--seq-6)",
] as const;

/** Rampa ordinal de 5 passos, para categorias com ordem natural (ciclo de vida). */
export const ORDINAL = [
  "var(--ord-1)",
  "var(--ord-2)",
  "var(--ord-3)",
  "var(--ord-4)",
  "var(--ord-5)",
] as const;

/** Estado — reservado. Nunca vira "série 4". */
export const STATUS = {
  good: "var(--good)",
  warning: "var(--warning)",
  serious: "var(--serious)",
  critical: "var(--critical)",
  neutral: "var(--chart-muted)",
} as const;

export const CHROME = {
  surface: "var(--chart-surface)",
  grid: "var(--chart-grid)",
  axis: "var(--chart-axis)",
  muted: "var(--chart-muted)",
  ink: "var(--ink)",
  ink2: "var(--ink-2)",
} as const;

export type Padding = { top: number; right: number; bottom: number; left: number };

/* ---------------------------------------------------------------------------
   Escalas
--------------------------------------------------------------------------- */

export function linearScale(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (value: number) => r0 + ((value - d0) / span) * (r1 - r0);
}

/**
 * Arredonda o topo do eixo para um número limpo (10, 25, 500...). Um eixo que
 * termina em 37 obriga o leitor a fazer conta para estimar os valores do meio.
 */
export function niceMax(value: number, ticks = 4, integer = false): number {
  if (value <= 0) return ticks;
  const rough = value / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  let step =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  step *= magnitude;
  // Contagem não tem meio chamado: o passo do eixo vira inteiro, sem 2,5.
  if (integer && !Number.isInteger(step)) step = Math.max(1, Math.ceil(step));
  return step * ticks;
}

export function tickValues(max: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, index) => (max / count) * index);
}

/* ---------------------------------------------------------------------------
   Traçados
--------------------------------------------------------------------------- */

type Point = { x: number; y: number };

/**
 * Curva de Catmull-Rom convertida em Bézier cúbica. Os pontos de controle são
 * presos à faixa vertical entre os dois pontos do segmento: a curva nunca
 * passa do valor real — sem pico inventado nem mergulho abaixo de zero.
 */
export function smoothPath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length < 3) {
    return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  }

  const clamp = (value: number, a: number, b: number) =>
    Math.max(Math.min(a, b), Math.min(Math.max(a, b), value));

  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = clamp(p1.y + (p2.y - p0.y) / 6, p1.y, p2.y);
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = clamp(p2.y - (p3.y - p1.y) / 6, p1.y, p2.y);

    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

export function areaPath(points: Point[], baseline: number): string {
  if (points.length === 0) return "";
  const line = smoothPath(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${line} L${last.x},${baseline} L${first.x},${baseline} Z`;
}

/** Retângulo com cantos arredondados só na ponta do dado (barra horizontal). */
export function barPathH(x: number, y: number, width: number, height: number, radius = 4): string {
  const r = Math.max(0, Math.min(radius, width, height / 2));
  if (r === 0 || width <= 0) return `M${x},${y} h${Math.max(width, 0)} v${height} h${-Math.max(width, 0)} Z`;
  return [
    `M${x},${y}`,
    `h${width - r}`,
    `a${r},${r} 0 0 1 ${r},${r}`,
    `v${height - 2 * r}`,
    `a${r},${r} 0 0 1 ${-r},${r}`,
    `h${-(width - r)}`,
    "Z",
  ].join(" ");
}

/** Idem, para coluna vertical: cantos só no topo. */
export function barPathV(x: number, y: number, width: number, height: number, radius = 4): string {
  const r = Math.max(0, Math.min(radius, width / 2, height));
  if (r === 0 || height <= 0) return `M${x},${y} v${Math.max(height, 0)} h${width} v${-Math.max(height, 0)} Z`;
  return [
    `M${x},${y + height}`,
    `v${-(height - r)}`,
    `a${r},${r} 0 0 1 ${r},${-r}`,
    `h${width - 2 * r}`,
    `a${r},${r} 0 0 1 ${r},${r}`,
    `v${height - r}`,
    "Z",
  ].join(" ");
}

/** Arco para o medidor radial. */
export function arcPath(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polar(cx, cy, radius, startAngle);
  const end = polar(cx, cy, radius, endAngle);
  const largeArc = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
  return `M${start.x},${start.y} A${radius},${radius} 0 ${largeArc} 1 ${end.x},${end.y}`;
}

function polar(cx: number, cy: number, radius: number, angle: number): Point {
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) };
}

/* ---------------------------------------------------------------------------
   Formatação de eixo
--------------------------------------------------------------------------- */

export function axisNumber(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}k`;
  }
  return value.toLocaleString("pt-BR", { maximumFractionDigits: value % 1 === 0 ? 0 : 1 });
}
