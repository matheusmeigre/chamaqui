"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Check,
  Copy,
  KeyRound,
  Link2,
  Loader2,
  Plus,
  ShieldCheck,
  Timer,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { Badge, type Tone } from "@/components/ui";
import { cn } from "@/lib/ui";

type Code = {
  id: string;
  role: string;
  used: boolean;
  usedAt: string | null;
  expiresAt: string;
  createdAt: string;
};

type Filter = "all" | "available" | "used" | "expired";

export function ActivationCodesPanel({
  codes: initialCodes,
  isAdminOrganization,
}: {
  codes: Code[];
  isAdminOrganization: boolean;
}) {
  const [codes, setCodes] = useState(initialCodes);
  const [plainCode, setPlainCode] = useState("");
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const qrUrl = plainCode ? `/api/auth/qr?code=${encodeURIComponent(plainCode)}` : "";

  const statusOf = (code: Code): { key: Exclude<Filter, "all">; label: string; tone: Tone; Icon: typeof Timer } => {
    if (code.used) return { key: "used", label: "Usado", tone: "good", Icon: ShieldCheck };
    if (new Date(code.expiresAt) < new Date()) return { key: "expired", label: "Expirado", tone: "neutral", Icon: Timer };
    return { key: "available", label: "Disponível", tone: "brand", Icon: KeyRound };
  };

  const counts = codes.reduce(
    (acc, code) => {
      acc[statusOf(code).key] += 1;
      return acc;
    },
    { available: 0, used: 0, expired: 0 }
  );

  const visible = filter === "all" ? codes : codes.filter((code) => statusOf(code).key === filter);

  const generate = async (role: string, ttlDays: number) => {
    setGenerating(role);
    setError("");
    try {
      const res = await fetch("/api/admin/activation-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, ttlDays }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Não foi possível gerar o código.");
        return;
      }
      const newCode: Code = {
        id: data.code.id,
        role: data.code.role,
        used: false,
        usedAt: null,
        expiresAt: data.code.expiresAt,
        createdAt: new Date().toISOString(),
      };
      setCodes((prev) => [newCode, ...prev]);
      setPlainCode(data.code.plainCode);
    } catch {
      setError("Ocorreu um erro ao gerar o código.");
    } finally {
      setGenerating(null);
    }
  };

  const deleteCode = async (id: string) => {
    setDeletingId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/activation-codes/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCodes((prev) => prev.filter((code) => code.id !== id));
      } else {
        setError("Não foi possível excluir o código.");
      }
    } catch {
      setError("Ocorreu um erro ao excluir o código.");
    } finally {
      setDeletingId(null);
    }
  };

  const copy = async (kind: "code" | "link") => {
    const text = kind === "code" ? plainCode : `${window.location.origin}/activate/${plainCode}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("Não foi possível copiar. Selecione o código manualmente.");
    }
  };

  return (
    <div className="space-y-5">
      {/* Geração */}
      <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h3 className="text-sm font-semibold text-ink">Gerar novo código</h3>
            <p className="mt-0.5 text-xs text-ink-3">
              Exibido uma única vez. Compartilhe o código, o link ou o QR Code.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => generate("SOLICITANTE", 30)}
              disabled={generating !== null}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong disabled:opacity-50"
            >
              {generating === "SOLICITANTE" ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              Solicitante
            </button>
            {isAdminOrganization && (
              <button
                type="button"
                onClick={() => generate("ADMINISTRADOR", 30)}
                disabled={generating !== null}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink transition hover:border-line-strong hover:bg-surface-2 disabled:opacity-50"
              >
                {generating === "ADMINISTRADOR" ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <ShieldCheck size={15} />
                )}
                Administrador
              </button>
            )}
          </div>
        </div>

        {plainCode && (
          <div className="animate-fade-up relative border-t border-line bg-surface-2 p-4 sm:p-5">
            <button
              type="button"
              aria-label="Ocultar código"
              onClick={() => setPlainCode("")}
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-ink-3 transition hover:bg-surface-3 hover:text-ink"
            >
              <X size={15} />
            </button>
            <div className="flex flex-col items-center gap-5 sm:flex-row">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrUrl}
                alt="QR Code de ativação"
                width={128}
                height={128}
                className="rounded-xl border border-line bg-white p-2"
              />
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-3">Código de ativação</p>
                <code className="mt-1 block break-all font-mono text-3xl font-bold tracking-[0.18em] text-ink">
                  {plainCode}
                </code>
                <p className="mt-1 text-xs text-ink-3">Válido por 30 dias ou até o primeiro uso.</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                  <button
                    type="button"
                    onClick={() => copy("code")}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-xs font-medium text-ink transition hover:border-line-strong"
                  >
                    {copied === "code" ? <Check size={13} className="text-good-ink" /> : <Copy size={13} />}
                    {copied === "code" ? "Copiado" : "Copiar código"}
                  </button>
                  <button
                    type="button"
                    onClick={() => copy("link")}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-xs font-medium text-ink transition hover:border-line-strong"
                  >
                    {copied === "link" ? <Check size={13} className="text-good-ink" /> : <Link2 size={13} />}
                    {copied === "link" ? "Copiado" : "Copiar link de ativação"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="border-t border-line bg-critical-soft px-4 py-2.5 text-sm text-critical-ink sm:px-5">
            {error}
          </p>
        )}
      </section>

      {/* Histórico */}
      <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <h3 className="text-sm font-semibold text-ink">Códigos gerados</h3>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["all", "Todos", codes.length],
                ["available", "Disponíveis", counts.available],
                ["used", "Usados", counts.used],
                ["expired", "Expirados", counts.expired],
              ] as Array<[Filter, string, number]>
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                aria-pressed={filter === key}
                onClick={() => setFilter(key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition",
                  filter === key ? "bg-surface-3 text-ink" : "text-ink-3 hover:text-ink-2"
                )}
              >
                {label}
                <span className="tabular-nums opacity-70">{count}</span>
              </button>
            ))}
          </div>
        </header>

        <ul className="divide-y divide-line">
          {visible.length === 0 && (
            <li className="px-6 py-10 text-center text-sm text-ink-3">Nenhum código nesta visão.</li>
          )}
          {visible.map((code) => {
            const status = statusOf(code);
            return (
              <li key={code.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-3 text-ink-2">
                  {code.role === "ADMINISTRADOR" ? <ShieldCheck size={15} /> : <UserRound size={15} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">
                    {code.role === "ADMINISTRADOR" ? "Administrador" : "Solicitante"}
                  </p>
                  <p className="truncate text-xs text-ink-3">
                    Criado {format(new Date(code.createdAt), "dd MMM yyyy, HH:mm", { locale: ptBR })}
                    {code.usedAt
                      ? ` · usado ${format(new Date(code.usedAt), "dd MMM yyyy", { locale: ptBR })}`
                      : ` · expira ${format(new Date(code.expiresAt), "dd MMM yyyy", { locale: ptBR })}`}
                  </p>
                </div>
                <Badge tone={status.tone} icon={<status.Icon size={11} />}>
                  {status.label}
                </Badge>
                <button
                  type="button"
                  onClick={() => deleteCode(code.id)}
                  disabled={deletingId === code.id}
                  aria-label="Excluir código"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-3 transition hover:bg-critical-soft hover:text-critical-ink"
                >
                  {deletingId === code.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
