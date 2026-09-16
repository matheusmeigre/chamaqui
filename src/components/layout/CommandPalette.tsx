"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Loader2, PlusCircle, Search, Ticket } from "lucide-react";
import type { Severity, TicketCategoryCode, TicketStatus } from "@prisma/client";
import { StatusBadge } from "@/components/domain/labels";
import { cn, shortId } from "@/lib/ui";
import { visibleSections, type NavItem } from "./nav";

type TicketHit = {
  id: string;
  title: string;
  status: TicketStatus;
  severity: Severity | null;
  categoryCode: TicketCategoryCode | null;
};

type Row =
  | { kind: "nav"; item: NavItem }
  | { kind: "action"; href: string; label: string; hint: string }
  | { kind: "ticket"; ticket: TicketHit };

export function CommandPalette({
  open,
  onClose,
  role,
}: {
  open: boolean;
  onClose: () => void;
  role: string | null | undefined;
}) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<TicketHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const navItems = useMemo(
    () => visibleSections(role).flatMap((section) => section.items),
    [role]
  );

  useEffect(() => {
    if (!open) {
      setTerm("");
      setHits([]);
      setCursor(0);
      return;
    }
    // O foco só existe depois que o diálogo entra no DOM.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("falha na busca");
        const data = (await response.json()) as { tickets: TicketHit[] };
        setHits(data.tickets ?? []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setHits([]);
      } finally {
        setLoading(false);
      }
    }, 220);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [term]);

  const rows = useMemo<Row[]>(() => {
    const needle = term.trim().toLowerCase();
    const matchedNav = navItems.filter(
      (item) =>
        needle.length === 0 ||
        item.label.toLowerCase().includes(needle) ||
        item.hint?.toLowerCase().includes(needle)
    );

    const actions: Row[] =
      needle.length === 0 || "novo chamado abrir".includes(needle)
        ? [
            {
              kind: "action",
              href: "/tickets/new",
              label: "Abrir novo chamado",
              hint: "Registrar incidente ou solicitação",
            },
          ]
        : [];

    return [
      ...actions,
      ...matchedNav.map((item) => ({ kind: "nav" as const, item })),
      ...hits.map((ticket) => ({ kind: "ticket" as const, ticket })),
    ];
  }, [term, navItems, hits]);

  useEffect(() => {
    setCursor((current) => Math.min(current, Math.max(0, rows.length - 1)));
  }, [rows.length]);

  const go = useCallback(
    (row: Row) => {
      const href =
        row.kind === "ticket" ? `/tickets/${row.ticket.id}` : row.kind === "nav" ? row.item.href : row.href;
      onClose();
      router.push(href);
    },
    [onClose, router]
  );

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((current) => (rows.length === 0 ? 0 : (current + 1) % rows.length));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((current) => (rows.length === 0 ? 0 : (current - 1 + rows.length) % rows.length));
      return;
    }
    if (event.key === "Enter" && rows[cursor]) {
      event.preventDefault();
      go(rows[cursor]);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-60 flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Buscar e navegar"
    >
      <button
        type="button"
        aria-label="Fechar busca"
        className="absolute inset-0 cursor-default bg-(--overlay) backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="animate-fade-up relative w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-float"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search size={16} className="shrink-0 text-ink-3" />
          <input
            ref={inputRef}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Buscar chamados ou ir para uma página..."
            className="w-full bg-transparent py-3.5 text-sm text-ink outline-none placeholder:text-ink-3"
            aria-label="Termo de busca"
          />
          {loading && <Loader2 size={15} className="shrink-0 animate-spin text-ink-3" />}
        </div>

        <div className="scroll-thin max-h-[52vh] overflow-y-auto p-1.5">
          {rows.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-ink-3">
              {term.trim().length < 2
                ? "Digite ao menos dois caracteres."
                : "Nada encontrado para essa busca."}
            </p>
          ) : (
            <ul>
              {rows.map((row, index) => {
                const selected = index === cursor;
                const key =
                  row.kind === "ticket" ? row.ticket.id : row.kind === "nav" ? row.item.href : row.href;

                return (
                  <li key={`${row.kind}-${key}`}>
                    <button
                      type="button"
                      onMouseEnter={() => setCursor(index)}
                      onClick={() => go(row)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                        selected ? "bg-surface-3" : "hover:bg-surface-2"
                      )}
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink-3">
                        {row.kind === "nav" ? (
                          <row.item.icon size={14} />
                        ) : row.kind === "action" ? (
                          <PlusCircle size={14} />
                        ) : (
                          <Ticket size={14} />
                        )}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">
                          {row.kind === "ticket" ? row.ticket.title : row.kind === "nav" ? row.item.label : row.label}
                        </span>
                        <span className="block truncate text-xs text-ink-3">
                          {row.kind === "ticket"
                            ? shortId(row.ticket.id)
                            : row.kind === "nav"
                              ? (row.item.hint ?? row.item.href)
                              : row.hint}
                        </span>
                      </span>

                      {row.kind === "ticket" && <StatusBadge status={row.ticket.status} />}
                      {selected && <CornerDownLeft size={13} className="shrink-0 text-ink-3" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line bg-surface-2 px-4 py-2 text-[11px] text-ink-3">
          <span className="flex items-center gap-2">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
            navegar
          </span>
          <span className="flex items-center gap-2">
            <Kbd>Enter</Kbd>
            abrir
            <Kbd>Esc</Kbd>
            fechar
          </span>
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-sans text-[10px] font-medium text-ink-2">
      {children}
    </kbd>
  );
}
