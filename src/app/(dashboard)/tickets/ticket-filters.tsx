"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowUpDown,
  Check,
  ChevronDown,
  CircleDot,
  Columns3,
  Info,
  List,
  Loader2,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { Severity, TicketCategoryCode, TicketStatus } from "@prisma/client";
import { Segmented, useQueryUpdater } from "@/components/ui/FilterControls";
import { STATUS_DOT, STATUS_LABEL, STATUS_ORDER } from "@/components/domain/labels";
import {
  CATEGORY_DEFINITIONS,
  CATEGORY_ORDER,
  SEVERITY_DEFINITIONS,
  SEVERITY_ORDER,
} from "@/server/domain/ticket-grid";
import { cn } from "@/lib/ui";

export type TicketFilterState = {
  q: string;
  statuses: TicketStatus[];
  severities: Severity[];
  categories: TicketCategoryCode[];
  org: string;
  assignee: "" | "me" | "none";
  opened: "" | "7" | "30" | "90";
  sort: string;
  layout: "list" | "board";
};

type Draft = Pick<TicketFilterState, "statuses" | "severities" | "categories" | "org" | "assignee" | "opened">;

const EMPTY_DRAFT: Draft = { statuses: [], severities: [], categories: [], org: "", assignee: "", opened: "" };

const SEVERITY_ICON: Record<Severity, typeof AlertOctagon> = {
  P1: AlertOctagon,
  P2: AlertTriangle,
  P3: Info,
  P4: CircleDot,
};

const SEVERITY_ICON_TONE: Record<Severity, string> = {
  P1: "text-critical-ink",
  P2: "text-serious-ink",
  P3: "text-warning-ink",
  P4: "text-ink-3",
};

const ASSIGNEE_LABEL = { me: "Atribuídos a mim", none: "Sem responsável" } as const;
const OPENED_LABEL = { "7": "Últimos 7 dias", "30": "Últimos 30 dias", "90": "Últimos 90 dias" } as const;

/** Largura do painel em pixels (26rem). */
const PANEL_WIDTH = 416;

const SORT_OPTIONS = [
  { value: "updated", label: "Última atualização" },
  { value: "opened", label: "Abertura recente" },
  { value: "oldest", label: "Abertura antiga" },
  { value: "severity", label: "Maior severidade" },
];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/** Quantos grupos de filtro estão ativos — é o número que o botão exibe. */
function countActive(draft: Draft): number {
  return [
    draft.statuses.length > 0,
    draft.severities.length > 0,
    draft.categories.length > 0,
    Boolean(draft.org),
    Boolean(draft.assignee),
    Boolean(draft.opened),
  ].filter(Boolean).length;
}

function toQuery(draft: Draft): Record<string, string | null> {
  return {
    status: draft.statuses.join(",") || null,
    severity: draft.severities.join(",") || null,
    category: draft.categories.join(",") || null,
    org: draft.org || null,
    assignee: draft.assignee || null,
    opened: draft.opened || null,
    page: null,
  };
}

export function TicketFilters({
  state,
  organizations,
  isAdmin,
}: {
  state: TicketFilterState;
  organizations: Array<{ value: string; label: string }> | null;
  isAdmin: boolean;
}) {
  const { update, pending } = useQueryUpdater();
  const [term, setTerm] = useState(state.q);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [panelBox, setPanelBox] = useState<{ left: number; width: number } | null>(null);
  const first = useRef(true);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const applied: Draft = {
    statuses: state.statuses,
    severities: state.severities,
    categories: state.categories,
    org: state.org,
    assignee: state.assignee,
    opened: state.opened,
  };
  const activeCount = countActive(applied);

  // Busca com espera curta: cada tecla não precisa virar uma ida ao servidor.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if (term.trim() !== state.q) update({ q: term.trim() || null, page: null });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  };

  // O rascunho nasce do que está aplicado a cada abertura: fechar sem aplicar
  // descarta as mudanças, como o usuário espera de um painel.
  /**
   * Posição do painel no desktop, medida na abertura. O limite é a área de
   * conteúdo (o <main> rola por conta própria e recorta o que passar da borda),
   * não a janela: começa alinhado ao botão e desliza até caber. No mobile o
   * painel é folha inferior e dispensa o cálculo.
   */
  const measurePanel = () => {
    const wrapper = wrapperRef.current;
    if (!wrapper || !window.matchMedia("(min-width: 640px)").matches) return null;
    const anchor = wrapper.getBoundingClientRect();
    const bounds = (wrapper.closest("main") ?? document.body).getBoundingClientRect();
    const GUTTER = 16;
    const width = Math.min(PANEL_WIDTH, bounds.width - GUTTER * 2);
    let left = anchor.left;
    if (left + width > bounds.right - GUTTER) left = bounds.right - GUTTER - width;
    if (left < bounds.left + GUTTER) left = bounds.left + GUTTER;
    return { left: left - anchor.left, width };
  };

  const openPanel = () => {
    setDraft(applied);
    setPanelBox(measurePanel());
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();

    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const apply = () => {
    update(toQuery(draft));
    close();
  };

  const draftCount = countActive(draft);

  /* --- Etiquetas dos filtros aplicados ------------------------------------ */
  const chips: Array<{ key: string; label: string; remove: Record<string, string | null> }> = [];
  if (applied.statuses.length) {
    chips.push({
      key: "status",
      label: `Status: ${applied.statuses.map((item) => STATUS_LABEL[item]).join(", ")}`,
      remove: { status: null, page: null },
    });
  }
  if (applied.severities.length) {
    chips.push({
      key: "severity",
      label: `Severidade: ${applied.severities.join(", ")}`,
      remove: { severity: null, page: null },
    });
  }
  if (applied.categories.length) {
    chips.push({
      key: "category",
      label: `Natureza: ${applied.categories.join(", ")}`,
      remove: { category: null, page: null },
    });
  }
  if (applied.org) {
    chips.push({
      key: "org",
      label: organizations?.find((item) => item.value === applied.org)?.label ?? "Organização",
      remove: { org: null, page: null },
    });
  }
  if (applied.assignee) {
    chips.push({ key: "assignee", label: ASSIGNEE_LABEL[applied.assignee], remove: { assignee: null, page: null } });
  }
  if (applied.opened) {
    chips.push({ key: "opened", label: `Abertos: ${OPENED_LABEL[applied.opened].toLowerCase()}`, remove: { opened: null, page: null } });
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {/* Busca */}
        <label className="relative flex min-w-0 flex-1 basis-56 items-center">
          <Search size={15} className="pointer-events-none absolute left-3 text-ink-3" />
          <input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Buscar por título, descrição ou #ID"
            aria-label="Buscar chamados"
            className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-9 text-sm text-ink outline-none transition placeholder:text-ink-3 hover:border-line-strong focus:border-brand focus:shadow-(--ring-brand)"
          />
          {pending ? (
            <Loader2 size={14} className="absolute right-3 animate-spin text-ink-3" aria-label="Atualizando" />
          ) : term ? (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => setTerm("")}
              className="absolute right-2 grid h-6 w-6 place-items-center rounded-md text-ink-3 hover:bg-surface-3"
            >
              <X size={13} />
            </button>
          ) : null}
        </label>

        {/* Botão e painel de filtros */}
        <div ref={wrapperRef} className="relative">
          <button
            ref={buttonRef}
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            aria-haspopup="dialog"
            onClick={() => (open ? close(false) : openPanel())}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition",
              open || activeCount > 0
                ? "border-brand/40 bg-brand-soft text-brand-ink"
                : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink"
            )}
          >
            <SlidersHorizontal size={15} />
            Filtros
            {activeCount > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-on-brand">
                {activeCount}
              </span>
            )}
            <ChevronDown size={14} className={cn("transition", open && "rotate-180")} />
          </button>

          {open && (
            <>
              {/* Véu só no mobile, onde o painel vira folha inferior. Fica dentro do
                  contêiner, então o clique fora não o alcança: fecha por conta própria. */}
              <button
                type="button"
                tabIndex={-1}
                aria-label="Fechar filtros"
                onClick={() => close(false)}
                className="fixed inset-0 z-40 cursor-default bg-(--overlay) sm:hidden"
              />

              <div
                ref={panelRef}
                id={panelId}
                role="dialog"
                aria-label="Filtros de chamados"
                tabIndex={-1}
                className={cn(
                  "animate-fade-up fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-2xl border border-line bg-surface shadow-float outline-none sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:mt-2 sm:max-h-[min(70dvh,40rem)] sm:rounded-2xl"
                )}
                style={panelBox ?? undefined}
              >
                <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">Filtros</p>
                    <p className="text-xs text-ink-3">
                      {draftCount === 0
                        ? "Nenhum filtro selecionado"
                        : `${draftCount} ${draftCount === 1 ? "grupo selecionado" : "grupos selecionados"}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Fechar filtros"
                    onClick={() => close()}
                    className="grid h-8 w-8 place-items-center rounded-lg text-ink-3 transition hover:bg-surface-3 hover:text-ink"
                  >
                    <X size={16} />
                  </button>
                </header>

                <div className="scroll-thin flex-1 space-y-5 overflow-y-auto px-4 py-4">
                  <FilterGroup
                    title="Status"
                    count={draft.statuses.length}
                    onClear={() => setDraft({ ...draft, statuses: [] })}
                  >
                    {STATUS_ORDER.map((status) => (
                      <Chip
                        key={status}
                        selected={draft.statuses.includes(status)}
                        onClick={() => setDraft({ ...draft, statuses: toggle(draft.statuses, status) })}
                      >
                        <span
                          aria-hidden
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ background: STATUS_DOT[status] }}
                        />
                        {STATUS_LABEL[status]}
                      </Chip>
                    ))}
                  </FilterGroup>

                  <FilterGroup
                    title="Severidade"
                    hint="Só incidentes de C1"
                    count={draft.severities.length}
                    onClear={() => setDraft({ ...draft, severities: [] })}
                  >
                    {SEVERITY_ORDER.map((severity) => {
                      const Icon = SEVERITY_ICON[severity];
                      return (
                        <Chip
                          key={severity}
                          selected={draft.severities.includes(severity)}
                          onClick={() => setDraft({ ...draft, severities: toggle(draft.severities, severity) })}
                        >
                          <Icon size={13} className={SEVERITY_ICON_TONE[severity]} />
                          {severity} · {SEVERITY_DEFINITIONS[severity].label}
                        </Chip>
                      );
                    })}
                  </FilterGroup>

                  <FilterGroup
                    title="Natureza"
                    count={draft.categories.length}
                    onClear={() => setDraft({ ...draft, categories: [] })}
                  >
                    {CATEGORY_ORDER.map((category) => (
                      <Chip
                        key={category}
                        selected={draft.categories.includes(category)}
                        onClick={() => setDraft({ ...draft, categories: toggle(draft.categories, category) })}
                        title={CATEGORY_DEFINITIONS[category].description}
                      >
                        <span className="font-semibold">{category}</span>
                        <span className="text-ink-3">{CATEGORY_DEFINITIONS[category].label}</span>
                      </Chip>
                    ))}
                  </FilterGroup>

                  <FilterGroup
                    title="Aberto em"
                    count={draft.opened ? 1 : 0}
                    onClear={() => setDraft({ ...draft, opened: "" })}
                  >
                    {(["7", "30", "90"] as const).map((days) => (
                      <Chip
                        key={days}
                        selected={draft.opened === days}
                        onClick={() => setDraft({ ...draft, opened: draft.opened === days ? "" : days })}
                      >
                        {OPENED_LABEL[days]}
                      </Chip>
                    ))}
                  </FilterGroup>

                  {isAdmin && (
                    <FilterGroup
                      title="Responsável"
                      count={draft.assignee ? 1 : 0}
                      onClear={() => setDraft({ ...draft, assignee: "" })}
                    >
                      {(["me", "none"] as const).map((value) => (
                        <Chip
                          key={value}
                          selected={draft.assignee === value}
                          onClick={() => setDraft({ ...draft, assignee: draft.assignee === value ? "" : value })}
                        >
                          {ASSIGNEE_LABEL[value]}
                        </Chip>
                      ))}
                    </FilterGroup>
                  )}

                  {organizations && organizations.length > 0 && (
                    <FilterGroup
                      title="Organização"
                      count={draft.org ? 1 : 0}
                      onClear={() => setDraft({ ...draft, org: "" })}
                    >
                      <select
                        aria-label="Organização"
                        value={draft.org}
                        onChange={(event) => setDraft({ ...draft, org: event.target.value })}
                        className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none transition hover:border-line-strong focus:border-brand"
                      >
                        <option value="">Todas as organizações</option>
                        {organizations.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </FilterGroup>
                  )}
                </div>

                <footer className="flex items-center justify-between gap-2 border-t border-line bg-surface-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:rounded-b-2xl">
                  <button
                    type="button"
                    onClick={() => setDraft(EMPTY_DRAFT)}
                    disabled={draftCount === 0}
                    className="min-h-10 rounded-xl px-3 text-sm font-medium text-ink-2 transition hover:text-ink disabled:opacity-40"
                  >
                    Limpar tudo
                  </button>
                  <button
                    type="button"
                    onClick={apply}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-semibold text-on-brand shadow-card transition hover:bg-brand-strong"
                  >
                    <Check size={15} />
                    Aplicar filtros
                  </button>
                </footer>
              </div>
            </>
          )}
        </div>

        {/* Ordenação */}
        <label className="relative flex items-center">
          <span className="sr-only">Ordenar por</span>
          <ArrowUpDown size={14} className="pointer-events-none absolute left-3 text-ink-3" />
          <select
            value={state.sort}
            onChange={(event) => update({ sort: event.target.value === "updated" ? null : event.target.value })}
            className="h-10 appearance-none rounded-xl border border-line bg-surface pl-8 pr-8 text-sm text-ink-2 outline-none transition hover:border-line-strong hover:text-ink focus:border-brand"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-2.5 text-ink-3" />
        </label>

        {/* Modo de exibição */}
        <Segmented
          ariaLabel="Modo de exibição"
          value={state.layout}
          onChange={(next) => update({ layout: next === "list" ? null : next, page: null })}
          options={[
            { value: "list", label: "Lista", icon: <List size={14} /> },
            { value: "board", label: "Quadro", icon: <Columns3 size={14} /> },
          ]}
        />
      </div>

      {/* Filtros aplicados: visíveis e removíveis sem abrir o painel */}
      {chips.length > 0 && (
        <div className="animate-fade flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-brand/30 bg-brand-soft py-1 pl-3 pr-1 text-xs font-medium text-brand-ink"
            >
              <span className="truncate">{chip.label}</span>
              <button
                type="button"
                aria-label={`Remover filtro ${chip.label}`}
                onClick={() => update(chip.remove)}
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full transition hover:bg-brand/15"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => update(toQuery(EMPTY_DRAFT))}
            className="ml-1 text-xs font-medium text-ink-3 underline-offset-2 transition hover:text-ink hover:underline"
          >
            Limpar filtros
          </button>
        </div>
      )}
    </div>
  );
}

function FilterGroup({
  title,
  hint,
  count,
  onClear,
  children,
}: {
  title: string;
  hint?: string;
  count: number;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <legend className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-3">
          {title}
          {hint && <span className="ml-1.5 font-normal normal-case tracking-normal">· {hint}</span>}
        </legend>
        {count > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs font-medium text-brand-ink transition hover:underline"
          >
            Limpar
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  );
}

function Chip({
  selected,
  onClick,
  title,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition",
        selected
          ? "border-brand bg-brand-soft text-ink"
          : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink"
      )}
    >
      {selected && <Check size={12} className="shrink-0 text-brand-ink" strokeWidth={3} />}
      {children}
    </button>
  );
}
