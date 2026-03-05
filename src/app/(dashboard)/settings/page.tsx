import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Settings as SettingsIcon, Bell, Shield as ShieldIcon, Globe } from "lucide-react";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  
  if (!session || session.user.role !== "ADMINISTRADOR") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <SettingsIcon className="text-gray-800" size={28} />
        <h2 className="text-2xl font-bold text-gray-800">Configurações do Sistema</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bloco 1 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Globe size={24} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Gerais</h3>
              <p className="text-sm text-slate-500">Configurações globais da plataforma</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Nome da Empresa</label>
              <input type="text" defaultValue="Chamaqui ITSM" className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50" disabled />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Horário Comercial (SLA)</label>
              <input type="text" defaultValue="08:00 - 18:00" className="mt-1 w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-slate-50" disabled />
            </div>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition">
              Salvar Alterações
            </button>
          </div>
        </div>

        {/* Bloco 2 */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Bell size={24} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Notificações</h3>
              <p className="text-sm text-slate-500">Regras de e-mail e alertas</p>
            </div>
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
              <span className="text-sm text-gray-700">Notificar na abertura de chamados</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
              <span className="text-sm text-gray-700">Notificar alteração de status</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" defaultChecked className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" />
              <span className="text-sm text-gray-700">Alerta de prazo de SLA vencendo</span>
            </label>
          </div>
        </div>

      </div>
    </div>
  );
}
