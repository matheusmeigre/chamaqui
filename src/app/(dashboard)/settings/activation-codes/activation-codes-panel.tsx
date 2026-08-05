"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Copy, Loader2, RefreshCw, ShieldCheck, Timer, Trash2 } from "lucide-react";

type Code = {
  id: string;
  role: string;
  used: boolean;
  usedAt: string | null;
  expiresAt: string;
  createdAt: string;
};

export function ActivationCodesPanel({ codes: initialCodes }: { codes: Code[] }) {
  const [codes, setCodes] = useState(initialCodes);
  const [showCode, setShowCode] = useState<string | null>(null);
  const [plainCode, setPlainCode] = useState("");
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const qrUrl = plainCode ? `/api/auth/qr?code=${encodeURIComponent(plainCode)}` : "";

  const generate = async (role: string, ttlDays: number) => {
    setGenerating(true);
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
      setShowCode(newCode.id);
    } catch {
      setError("Ocorreu um erro ao gerar o código.");
    } finally {
      setGenerating(false);
    }
  };

  const deleteCode = async (id: string) => {
    setDeletingId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/activation-codes/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCodes((prev) => prev.filter((c) => c.id !== id));
        if (showCode === id) setShowCode(null);
      } else {
        setError("Não foi possível excluir o código.");
      }
    } catch {
      setError("Ocorreu um erro ao excluir o código.");
    } finally {
      setDeletingId(null);
    }
  };

  const status = (code: Code) => {
    if (code.used) return { label: "Usado", cls: "bg-emerald-100 text-emerald-700", Icon: ShieldCheck };
    if (new Date(code.expiresAt) < new Date()) return { label: "Expirado", cls: "bg-slate-100 text-slate-500", Icon: Timer };
    return { label: "Ativo", cls: "bg-blue-100 text-blue-700", Icon: ShieldCheck };
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 sm:p-6 border-b border-slate-100">
        <h3 className="font-semibold text-slate-900 mb-1">Gerar novo código</h3>
        <p className="text-sm text-slate-500 mb-4">
          O código é exibido uma única vez. Você pode mostrá-lo ou compartilhar o QR Code.
        </p>

        {showCode && plainCode && (
          <div className="mb-4 rounded-lg bg-slate-50 p-4 flex flex-col sm:flex-row items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrUrl}
              alt="QR Code de ativação"
              width={96}
              height={96}
              className="rounded-lg bg-white border border-slate-200 p-1"
            />
            <div className="min-w-0 flex-1 text-center sm:text-left">
              <p className="text-sm font-medium text-slate-700 mb-1">Código de ativação</p>
              <code className="block text-2xl font-mono font-bold tracking-[0.2em] text-slate-900 break-all">
                {plainCode}
              </code>
              <div className="mt-2 flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/activate/${plainCode}`;
                    navigator.clipboard.writeText(url).catch(() => {});
                  }}
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 min-h-11 px-2"
                >
                  <Copy size={15} /> Copiar link
                </button>
                <span className="text-xs text-slate-400">
                  Válido por 30 dias ou até ser usado.
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            onClick={() => generate("SOLICITANTE", 30)}
            disabled={generating}
            className="min-h-11 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 px-4 py-2 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Gerar (Solicitante)
          </button>
          <button
            onClick={() => generate("ATENDENTE", 30)}
            disabled={generating}
            className="min-h-11 rounded-lg bg-slate-700 text-white text-sm font-medium hover:bg-slate-800 px-4 py-2 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Gerar (Atendente)
          </button>
          <button
            onClick={() => generate("ADMINISTRADOR", 30)}
            disabled={generating}
            className="min-h-11 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-black px-4 py-2 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Gerar (Admin)
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>

      <ul className="divide-y divide-slate-100">
        {codes.length === 0 && (
          <li className="px-6 py-10 text-center text-slate-500">Nenhum código gerado ainda.</li>
        )}
        {codes.map((code) => {
          const s = status(code);
          return (
            <li key={code.id} className="flex items-center gap-3 px-4 sm:px-6 py-3">
              <span className={`inline-flex shrink-0 items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${s.cls}`}>
                <s.Icon size={12} />
                {s.label}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-700">
                  {code.used
                    ? "Usado"
                    : new Date(code.expiresAt) < new Date()
                      ? "Expirado"
                      : "Disponível"}
                  {" "}• {code.role}
                </p>
                <p className="text-xs text-slate-400">
                  Criado em {format(new Date(code.createdAt), "dd MMM yyyy, HH:mm", { locale: ptBR })}
                  {" • "}expira em {format(new Date(code.expiresAt), "dd MMM yyyy, HH:mm", { locale: ptBR })}
                </p>
              </div>
              <button
                onClick={() => deleteCode(code.id)}
                disabled={deletingId === code.id}
                aria-label="Excluir código"
                className="min-h-11 min-w-11 grid place-items-center text-slate-400 hover:text-red-600 transition shrink-0"
              >
                {deletingId === code.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
