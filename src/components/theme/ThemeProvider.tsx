"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "./ThemeScript";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (next: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/* ---------------------------------------------------------------------------
   Loja externa
   A preferência mora no localStorage e o tema resolvido no atributo do <html>
   (gravado pelo ThemeScript antes da pintura). useSyncExternalStore lê os dois
   sem descasar a hidratação: no servidor vale o snapshot neutro, no cliente o
   real, e o React troca um pelo outro sem aviso.
--------------------------------------------------------------------------- */

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function readPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
  } catch {
    return "system";
  }
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readResolved(): ResolvedTheme {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function apply(theme: ResolvedTheme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme;
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  // Outra aba mudou a preferência: acompanha.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    const preference = readPreference();
    apply(preference === "system" ? systemTheme() : preference);
    notify();
  };

  // O sistema operacional trocou de modo: só importa se a preferência é "system".
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onMedia = () => {
    if (readPreference() !== "system") return;
    apply(systemTheme());
    notify();
  };

  window.addEventListener("storage", onStorage);
  media.addEventListener("change", onMedia);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
    media.removeEventListener("change", onMedia);
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preference = useSyncExternalStore(subscribe, readPreference, () => "system" as const);
  const resolved = useSyncExternalStore(subscribe, readResolved, () => "light" as const);

  // Mantém o atributo coerente caso o script inicial não tenha rodado (ex.: CSP).
  useEffect(() => {
    const expected = preference === "system" ? systemTheme() : preference;
    if (readResolved() !== expected) {
      apply(expected);
      notify();
    }
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Armazenamento bloqueado: o tema ainda muda nesta sessão.
    }
    apply(next === "system" ? systemTheme() : next);
    notify();
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme precisa estar dentro de ThemeProvider.");
  return context;
}
