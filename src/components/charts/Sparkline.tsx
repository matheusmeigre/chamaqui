import { linearScale, smoothPath } from "./primitives";

/**
 * Tendência de 12 pontos ao lado de um número. O traço fica no tom de
 * apagamento e só o ponto corrente recebe o destaque — a linha é contexto,
 * o valor é o assunto.
 */
export function Sparkline({
  values,
  width = 96,
  height = 30,
  color = "var(--brand)",
  muted = "var(--chart-axis)",
  ariaLabel,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  muted?: string;
  ariaLabel?: string;
}) {
  if (values.length < 2) return null;

  const PAD = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const y = linearScale([min === max ? min - 1 : min, max], [height - PAD, PAD]);
  const step = (width - PAD * 2) / (values.length - 1);

  const points = values.map((value, index) => ({ x: PAD + index * step, y: y(value) }));
  const last = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={ariaLabel ?? "Tendência do período"}
      className="overflow-visible"
    >
      <path
        d={smoothPath(points)}
        fill="none"
        stroke={muted}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={last.x}
        cy={last.y}
        r={2.75}
        fill={color}
        stroke="var(--chart-surface)"
        strokeWidth={2}
      />
    </svg>
  );
}
