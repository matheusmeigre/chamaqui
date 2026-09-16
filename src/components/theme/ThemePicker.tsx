"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/ui";
import { useTheme, type ThemePreference } from "./ThemeProvider";

const OPTIONS: Array<{ value: ThemePreference; label: string; hint: string; Icon: typeof Sun }> = [
  { value: "light", label: "Claro", hint: "Superfícies claras, ideal para ambientes iluminados", Icon: Sun },
  { value: "dark", label: "Escuro", hint: "Menos brilho em monitores de operação e à noite", Icon: Moon },
  { value: "system", label: "Sistema", hint: "Acompanha a preferência do dispositivo", Icon: Monitor },
];

export function ThemePicker() {
  const { preference, setPreference } = useTheme();

  return (
    <div role="radiogroup" aria-label="Tema da interface" className="grid gap-2 sm:grid-cols-3">
      {OPTIONS.map(({ value, label, hint, Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setPreference(value)}
            className={cn(
              "relative flex flex-col items-start gap-2 rounded-xl border p-3.5 text-left transition",
              active
                ? "border-brand bg-brand-soft shadow-(--ring-brand)"
                : "border-line bg-surface hover:border-line-strong hover:bg-surface-2"
            )}
          >
            {/* Miniatura do tema: a escolha fica visível antes do clique. */}
            <span
              aria-hidden
              className={cn(
                "flex h-14 w-full overflow-hidden rounded-lg border",
                value === "dark"
                  ? "border-[#26314b] bg-[#080c15]"
                  : value === "light"
                    ? "border-[#e3e8f0] bg-[#f3f5f9]"
                    : "border-line bg-[linear-gradient(90deg,#f3f5f9_50%,#080c15_50%)]"
              )}
            >
              <span
                className={cn(
                  "m-1.5 w-1/4 rounded",
                  value === "dark" ? "bg-[#121a2b]" : "bg-white"
                )}
              />
              <span className="my-1.5 mr-1.5 flex flex-1 flex-col gap-1">
                <span className={cn("h-3 rounded", value === "dark" ? "bg-[#121a2b]" : "bg-white")} />
                <span className="h-2 w-1/2 rounded bg-[#2a78d6]" />
              </span>
            </span>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Icon size={14} />
              {label}
            </span>
            <span className="text-xs text-ink-3">{hint}</span>
            {active && (
              <span className="absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full bg-brand text-on-brand">
                <Check size={12} strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
