"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ticket, Building2, KeyRound, AlertCircle, Loader2, ChevronDown } from "lucide-react";

export default function LoginPage() {
  const [organization, setOrganization] = useState("");
  const [accessKey, setAccessKey] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        redirect: false,
        organization,
        accessKey,
      });

      if (res?.error) {
        setError(
          res.error === "LOGIN_BLOCKED"
            ? "Muitas tentativas incorretas. Aguarde 5 minutos antes de tentar novamente."
            : "Organização ou chave de acesso incorreta."
        );
        setIsLoading(false);
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Ocorreu um erro ao tentar entrar.");
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-slate-50 flex items-center justify-center px-3 py-[max(1rem,env(safe-area-inset-top))] sm:p-6">
      <div className="max-w-md w-full">
        {/* Logo/Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-100 rounded-2xl">
              <Ticket className="h-10 w-10 text-blue-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Chamaqui</h1>
          <p className="text-slate-500 mt-2">Selecione sua organização para acessar o portal</p>
        </div>

        {/* Card Form */}
        <div className="bg-white p-5 sm:p-8 rounded-2xl shadow-sm border border-slate-100">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-3 text-sm">
              <AlertCircle size={18} />
              <p className="break-words">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Organização
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 className="h-5 w-5 text-slate-400" />
                </div>
                <select
                  required
                  value={organization}
                  onChange={(e) => {
                    setOrganization(e.target.value);
                    setAccessKey("");
                    setError("");
                  }}
                  className="block w-full appearance-none pl-10 pr-10 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all text-base text-slate-900 bg-white"
                >
                  <option value="" disabled>Selecione...</option>
                  <option value="instituto_energisa">Instituto Energisa</option>
                  <option value="hdl">HDL</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Chave de acesso
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  disabled={!organization}
                  autoComplete="off"
                  maxLength={256}
                  className="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all text-base text-slate-900 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  placeholder={organization ? "Informe a chave da organização" : "Selecione a organização primeiro"}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !organization || !accessKey}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Entrar no Sistema"
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <p className="text-center text-sm text-slate-500 mt-6 sm:mt-8 px-2">
          Não possui a chave? Contate o responsável pela sua organização.
        </p>
      </div>
    </main>
  );
}
