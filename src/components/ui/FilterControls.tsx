"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/ui";

/* ---------------------------------------------------------------------------
   Parâmetros de URL
   O filtro vive na URL: um link compartilhado abre o mesmo recorte, e o
   componente de servidor recalcula tudo abaixo com o mesmo corte.
--------------------------------------------------------------------------- */

export function useQueryUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const update = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  };

  return { update, pending, searchParams };
}

/* ---------------------------------------------------------------------------
   Segmentado
--------------------------------------------------------------------------- */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  size = "md",
}: {
  value: T;
  options: Array<{ value: T; label: string; icon?: React.ReactNode }>;
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 rounded-xl border border-line bg-surface-2 p-0.5"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[10px] font-medium transition",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-3 text-[13px]",
              active ? "bg-surface text-ink shadow-card" : "text-ink-3 hover:text-ink-2"
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Filtro do painel: período + organização
--------------------------------------------------------------------------- */

export function DashboardFilters({
  period,
  periods,
  organizations,
  organizationId,
}: {
  period: number;
  periods: ReadonlyArray<{ value: number; label: string }>;
  organizations: Array<{ id: string; name: string }> | null;
  organizationId: string | null;
}) {
  const { update, pending } = useQueryUpdater();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Segmented
        ariaLabel="Período de análise"
        value={String(period)}
        options={periods.map((option) => ({ value: String(option.value), label: option.label }))}
        onChange={(next) => update({ period: next })}
      />

      {organizations && (
        <select
          aria-label="Organização"
          value={organizationId ?? ""}
          onChange={(event) => update({ org: event.target.value || null })}
          className="h-10 min-w-0 max-w-60 rounded-xl border border-line bg-surface px-3 text-[13px] font-medium text-ink outline-none transition hover:border-line-strong focus:border-brand"
        >
          <option value="">Todas as organizações</option>
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
      )}

      {pending && <Loader2 size={16} className="animate-spin text-ink-3" aria-label="Atualizando" />}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Atualização ao vivo
   Recarrega os dados do servidor em intervalo, só com a aba visível — painel
   aberto num monitor não deve martelar o banco de madrugada.
--------------------------------------------------------------------------- */

export function LiveRefresh({ intervalSeconds = 120 }: { intervalSeconds?: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Nulo até a primeira atualização: o rótulo começa como "Ao vivo" e só passa
  // a contar tempo depois de um refresh real.
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    const refresh = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      startTransition(() => router.refresh());
      const stamp = Date.now();
      setLastUpdate(stamp);
      setNow(stamp);
    }, intervalSeconds * 1000);

    return () => {
      clearInterval(tick);
      clearInterval(refresh);
    };
  }, [intervalSeconds, router]);

  const seconds = lastUpdate && now ? Math.max(0, Math.round((now - lastUpdate) / 1000)) : 0;
  const label =
    seconds < 30 ? "agora" : seconds < 90 ? "há 1 min" : `há ${Math.round(seconds / 60)} min`;

  return (
    <button
      type="button"
      onClick={() => {
        startTransition(() => router.refresh());
        const stamp = Date.now();
        setLastUpdate(stamp);
        setNow(stamp);
      }}
      className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-[13px] text-ink-2 transition hover:border-line-strong hover:text-ink"
      title="Atualizar dados"
    >
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-good" />
      </span>
      <span className="hidden sm:inline">{lastUpdate ? `Atualizado ${label}` : "Ao vivo"}</span>
      <RefreshCw size={14} className={cn(pending && "animate-spin")} />
    </button>
  );
}
