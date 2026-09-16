"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/ui";
import { useTheme, type ThemePreference } from "./ThemeProvider";

const OPTIONS: Array<{ value: ThemePreference; label: string; Icon: typeof Sun }> = [
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Escuro", Icon: Moon },
  { value: "system", label: "Sistema", Icon: Monitor },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setPreference } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Tema da interface"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-line bg-surface-2 p-0.5",
        className
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setPreference(value)}
            className={cn(
              "grid h-7 w-7 place-items-center rounded-full transition",
              active
                ? "bg-surface text-ink shadow-card"
                : "text-ink-3 hover:text-ink-2"
            )}
          >
            <Icon size={14} strokeWidth={2.2} />
          </button>
        );
      })}
    </div>
  );
}
