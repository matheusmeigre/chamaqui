"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LogOut, Menu, PlusCircle, Search, Sparkles, X } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { cn, initialsOf } from "@/lib/ui";
import { CommandPalette } from "./CommandPalette";
import { isActive, titleForPath, visibleSections } from "./nav";

type ShellUser = {
  name?: string | null;
  role?: string | null;
  organizationName?: string | null;
};

export function AppShell({
  children,
  user,
  unreadCount,
}: {
  children: React.ReactNode;
  user: ShellUser;
  unreadCount: number;
}) {
  const pathname = usePathname() ?? "/dashboard";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const sections = visibleSections(user.role);

  // A gaveta não deve sobreviver a uma navegação (inclusive voltar/avançar).
  // Ajuste de estado durante a renderização, sem efeito em cascata.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    setDrawerOpen(false);
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const nav = (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4 scroll-thin">
      {sections.map((section, index) => (
        <div key={section.title ?? `section-${index}`} className="space-y-1">
          {section.title && (
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-3">
              {section.title}
            </p>
          )}
          {section.items.map((item) => {
            const active = isActive(pathname, item);
            const isNotifications = item.href === "/notifications";

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition",
                  active
                    ? "bg-brand-soft text-brand-ink"
                    : "text-ink-2 hover:bg-surface-2 hover:text-ink"
                )}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand"
                  />
                )}
                <item.icon size={17} className="shrink-0" strokeWidth={active ? 2.3 : 2} />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {isNotifications && unreadCount > 0 && (
                  <span className="shrink-0 rounded-full bg-critical px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2.5 px-4 py-4">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand text-on-brand">
        <Sparkles size={16} strokeWidth={2.4} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[15px] font-bold leading-tight tracking-tight text-ink">
          Chamaqui
        </p>
        <p className="truncate text-[11px] leading-tight text-ink-3">
          {user.organizationName ?? "Gestão de chamados"}
        </p>
      </div>
    </div>
  );

  const footer = (
    <div className="border-t border-line p-3">
      <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand-ink">
          {initialsOf(user.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
          <p className="truncate text-[11px] uppercase tracking-wide text-ink-3">
            {user.role === "ADMINISTRADOR" ? "Administrador" : "Solicitante"}
          </p>
        </div>
        <button
          type="button"
          aria-label="Sair da conta"
          title="Sair"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-3 transition hover:bg-surface-3 hover:text-critical"
        >
          <LogOut size={16} />
        </button>
      </div>
      <div className="mt-2 flex justify-center">
        <ThemeToggle />
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      {/* Barra lateral fixa */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface md:flex">
        {brand}
        <div className="px-3 pb-1">
          <QuickActions onSearch={() => setPaletteOpen(true)} />
        </div>
        {nav}
        {footer}
      </aside>

      {/* Gaveta no mobile */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Fechar menu"
            className="absolute inset-0 cursor-default bg-(--overlay) backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="animate-fade-up absolute inset-y-0 left-0 flex w-[min(17.5rem,86vw)] flex-col border-r border-line bg-surface pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            <div className="flex items-center justify-between">
              {brand}
              <button
                type="button"
                aria-label="Fechar menu"
                onClick={() => setDrawerOpen(false)}
                className="mr-3 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-surface-2"
              >
                <X size={18} />
              </button>
            </div>
            <div className="px-3 pb-1">
              <QuickActions
                onSearch={() => {
                  setDrawerOpen(false);
                  setPaletteOpen(true);
                }}
              />
            </div>
            {nav}
            {footer}
          </aside>
        </div>
      )}

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex shrink-0 items-center gap-2 border-b border-line bg-surface/85 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md sm:gap-3 sm:px-5 sm:py-3">
          <button
            type="button"
            aria-label="Abrir menu"
            onClick={() => setDrawerOpen(true)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-ink-2 transition hover:bg-surface-2 md:hidden"
          >
            <Menu size={20} />
          </button>

          <h1 className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-ink sm:text-base">
            {titleForPath(pathname)}
          </h1>

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="hidden items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-ink-3 transition hover:border-line-strong hover:text-ink-2 lg:flex"
          >
            <Search size={14} />
            <span>Buscar chamados…</span>
            <kbd className="ml-2 rounded border border-line bg-surface px-1.5 py-0.5 font-sans text-[10px] font-medium">
              Ctrl K
            </kbd>
          </button>

          <button
            type="button"
            aria-label="Buscar"
            onClick={() => setPaletteOpen(true)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-ink-2 transition hover:bg-surface-2 lg:hidden"
          >
            <Search size={18} />
          </button>

          <Link
            href="/notifications"
            aria-label={`Notificações${unreadCount > 0 ? `, ${unreadCount} não lidas` : ""}`}
            className="relative grid h-10 w-10 shrink-0 place-items-center rounded-lg text-ink-2 transition hover:bg-surface-2"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-critical px-1 text-[9px] font-bold leading-none text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>

          <Link
            href="/tickets/new"
            className="hidden min-h-10 shrink-0 items-center gap-2 rounded-xl bg-brand px-3.5 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong sm:inline-flex"
          >
            <PlusCircle size={16} />
            Novo chamado
          </Link>
        </header>

        <main className="scroll-thin flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-375 px-[max(0.875rem,env(safe-area-inset-left))] py-5 pr-[max(0.875rem,env(safe-area-inset-right))] pb-[max(5.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-6 md:pb-8">
            {children}
          </div>
        </main>

        {/* Ação principal sempre ao alcance no mobile */}
        <Link
          href="/tickets/new"
          aria-label="Abrir novo chamado"
          className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-brand text-on-brand shadow-float transition active:scale-95 sm:hidden"
        >
          <PlusCircle size={24} />
        </Link>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} role={user.role} />
    </div>
  );
}

function QuickActions({ onSearch }: { onSearch: () => void }) {
  return (
    <div className="space-y-1.5">
      <Link
        href="/tickets/new"
        className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand px-3 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong"
      >
        <PlusCircle size={16} />
        Novo chamado
      </Link>
      <button
        type="button"
        onClick={onSearch}
        className="flex min-h-9 w-full items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 text-xs text-ink-3 transition hover:border-line-strong hover:text-ink-2"
      >
        <Search size={13} />
        <span className="flex-1 text-left">Buscar…</span>
        <kbd className="rounded border border-line bg-surface px-1 py-0.5 font-sans text-[10px]">
          ⌘K
        </kbd>
      </button>
    </div>
  );
}
