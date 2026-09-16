import { arcPath } from "./primitives";

/**
 * Uma razão contra um limite. O arco vazio é um passo mais claro da mesma
 * rampa do preenchimento, então o estado se lê no medidor inteiro.
 *
 * Componente de servidor: não há interação a acrescentar — o número já está
 * escrito no centro, a dica não teria o que enriquecer.
 */
export function RadialGauge({
  ratio,
  label,
  caption,
  color = "var(--brand)",
  track = "var(--surface-3)",
  size = 132,
  thickness = 10,
}: {
  /** 0..1. Acima de 1 o arco satura e o excedente aparece no texto. */
  ratio: number | null;
  label: string;
  caption?: string;
  color?: string;
  track?: string;
  size?: number;
  thickness?: number;
}) {
  const clamped = ratio === null ? 0 : Math.max(0, Math.min(1, ratio));
  const radius = (size - thickness) / 2;
  const center = size / 2;

  // Arco de 270°, aberto embaixo: a abertura marca o início e o fim da escala.
  const START = Math.PI * 0.75;
  const SWEEP = Math.PI * 1.5;
  const END = START + SWEEP;

  return (
    <figure className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          role="img"
          aria-label={`${label}: ${ratio === null ? "sem dados" : `${Math.round(clamped * 100)}%`}`}
        >
          <path
            d={arcPath(center, center, radius, START, END)}
            fill="none"
            stroke={track}
            strokeWidth={thickness}
            strokeLinecap="round"
          />
          {ratio !== null && clamped > 0 && (
            <path
              d={arcPath(center, center, radius, START, START + SWEEP * clamped)}
              fill="none"
              stroke={color}
              strokeWidth={thickness}
              strokeLinecap="round"
              pathLength={1}
              className="chart-draw"
            />
          )}
        </svg>

        <div className="absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-2xl font-bold leading-none tracking-tight text-ink">
              {ratio === null ? "—" : `${Math.round(ratio * 100)}%`}
            </p>
            {caption && <p className="mt-1 text-[11px] text-ink-3">{caption}</p>}
          </div>
        </div>
      </div>
      <figcaption className="text-xs font-medium text-ink-2">{label}</figcaption>
    </figure>
  );
}
