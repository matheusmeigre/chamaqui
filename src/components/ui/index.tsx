import Link from "next/link";
import { cn } from "@/lib/ui";

/* ---------------------------------------------------------------------------
   Superfícies
--------------------------------------------------------------------------- */

export function Card({
  className,
  children,
  as: As = "section",
  interactive = false,
}: {
  className?: string;
  children: React.ReactNode;
  as?: "section" | "div" | "article";
  interactive?: boolean;
}) {
  return (
    <As
      className={cn(
        "rounded-2xl border border-line bg-surface shadow-card",
        interactive && "transition hover:border-line-strong hover:shadow-raised",
        className
      )}
    >
      {children}
    </As>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {icon && <span className="mt-0.5 shrink-0 text-ink-3">{icon}</span>}
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("p-4 sm:p-5", className)}>{children}</div>;
}

/* ---------------------------------------------------------------------------
   Cabeçalho de página
--------------------------------------------------------------------------- */

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1">
        {breadcrumb}
        <h2 className="text-balance text-2xl font-bold tracking-tight text-ink sm:text-[1.7rem]">
          {title}
        </h2>
        {description && (
          <p className="max-w-2xl text-sm text-ink-2">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/* ---------------------------------------------------------------------------
   Botões
--------------------------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-55";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-on-brand shadow-card hover:bg-brand-strong active:translate-y-px",
  secondary:
    "bg-surface-3 text-ink hover:bg-line active:translate-y-px",
  outline:
    "border border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-3 hover:text-ink",
  danger: "bg-critical text-white shadow-card hover:brightness-110 active:translate-y-px",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 text-xs",
  md: "min-h-11 px-4 text-sm",
};

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string
) {
  return cn(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: React.ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

/* ---------------------------------------------------------------------------
   Selos
--------------------------------------------------------------------------- */

export type Tone =
  | "neutral"
  | "brand"
  | "good"
  | "warning"
  | "serious"
  | "critical";

const TONE_SOFT: Record<Tone, string> = {
  neutral: "bg-neutral-soft text-neutral-ink",
  brand: "bg-brand-soft text-brand-ink",
  good: "bg-good-soft text-good-ink",
  warning: "bg-warning-soft text-warning-ink",
  serious: "bg-serious-soft text-serious-ink",
  critical: "bg-critical-soft text-critical-ink",
};

const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-ink-3",
  brand: "bg-brand",
  good: "bg-good",
  warning: "bg-warning",
  serious: "bg-serious",
  critical: "bg-critical",
};

export function Badge({
  tone = "neutral",
  children,
  icon,
  dot = false,
  className,
  title,
}: {
  tone?: Tone;
  children: React.ReactNode;
  icon?: React.ReactNode;
  dot?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none",
        TONE_SOFT[tone],
        className
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE_DOT[tone])} />}
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

/* ---------------------------------------------------------------------------
   Vazio, aviso e carregamento
--------------------------------------------------------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      {icon && (
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-surface-3 text-ink-3">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-3">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Callout({
  tone = "brand",
  icon,
  title,
  children,
  className,
}: {
  tone?: Tone;
  icon?: React.ReactNode;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const RING: Record<Tone, string> = {
    neutral: "border-line",
    brand: "border-brand/35",
    good: "border-good/35",
    warning: "border-warning/45",
    serious: "border-serious/45",
    critical: "border-critical/40",
  };

  return (
    <div
      className={cn(
        "rounded-xl border p-3.5 text-sm",
        TONE_SOFT[tone],
        RING[tone],
        className
      )}
    >
      <div className="flex items-start gap-2.5">
        {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
        <div className="min-w-0 space-y-1">
          {title && <p className="font-semibold">{title}</p>}
          {children && <div className="text-[13px] leading-relaxed opacity-90">{children}</div>}
        </div>
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} />;
}

/* ---------------------------------------------------------------------------
   Formulário
--------------------------------------------------------------------------- */

export const FIELD_CLASS =
  "w-full min-w-0 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink-3 focus:border-brand focus:shadow-(--ring-brand) disabled:bg-surface-2 disabled:text-ink-3";

export function Label({
  htmlFor,
  children,
  required,
  hint,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  required?: boolean;
  hint?: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-2">
      <span className="text-sm font-medium text-ink">
        {children}
        {required && <span className="ml-0.5 text-critical">*</span>}
      </span>
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

export function Field({
  label,
  htmlFor,
  required,
  hint,
  help,
  children,
  className,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  hint?: React.ReactNode;
  help?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label htmlFor={htmlFor} required={required} hint={hint}>
        {label}
      </Label>
      {children}
      {help && <p className="text-xs text-ink-3">{help}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Medidor — uma razão contra um limite
--------------------------------------------------------------------------- */

export function Meter({
  ratio,
  tone = "brand",
  className,
  ariaLabel,
}: {
  /** 0..1; acima de 1 a barra satura e o excedente é sinalizado pelo tom. */
  ratio: number | null;
  tone?: Tone;
  className?: string;
  ariaLabel?: string;
}) {
  const clamped = ratio === null ? 0 : Math.max(0, Math.min(1, ratio));
  const FILL: Record<Tone, string> = {
    neutral: "bg-ink-3",
    brand: "bg-brand",
    good: "bg-good",
    warning: "bg-warning",
    serious: "bg-serious",
    critical: "bg-critical",
  };

  return (
    <div
      role="meter"
      aria-label={ariaLabel}
      aria-valuenow={ratio === null ? undefined : Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-3", className)}
    >
      <div
        className={cn("chart-grow h-full rounded-full", FILL[tone])}
        style={{ width: `${clamped > 0 ? Math.max(clamped * 100, 1.5) : 0}%` }}
      />
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Tabela
--------------------------------------------------------------------------- */

export function TableShell({
  children,
  minWidth = 720,
  className,
}: {
  children: React.ReactNode;
  minWidth?: number;
  className?: string;
}) {
  return (
    <div className={cn("scroll-thin overflow-x-auto", className)}>
      <table
        className="w-full text-left text-sm text-ink-2"
        style={{ minWidth: `${minWidth}px` }}
      >
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  className,
  align = "left",
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-line bg-surface-2 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-3",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
  align = "left",
  numeric = false,
}: {
  children?: React.ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  numeric?: boolean;
}) {
  return (
    <td
      className={cn(
        "px-4 py-3 align-middle",
        align === "right" && "text-right",
        align === "center" && "text-center",
        numeric && "tabular-nums",
        className
      )}
    >
      {children}
    </td>
  );
}
