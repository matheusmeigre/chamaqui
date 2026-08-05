import { getCurrentUser } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Monitor, ShieldCheck, ShieldX } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RevokeDeviceButton } from "./revoke-device-button";

export const metadata = { title: "Dispositivos | Chamaqui" };

export default async function DevicesPage() {
  const session = await getCurrentUser();

  if (!session || session.role !== "ADMINISTRADOR") {
    redirect("/dashboard");
  }

  const devices = await prisma.device.findMany({
    where: { organizationId: session.organizationId ?? "" },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Monitor className="shrink-0 text-gray-800" size={28} />
        <h2 className="break-words text-2xl font-bold text-gray-800">Dispositivos Confiáveis</h2>
      </div>
      <p className="text-sm text-slate-500 -mt-4">
        Revogue o acesso de dispositivos perdidos ou não reconhecidos. A revogação é imediata.
      </p>

      <div className="space-y-3 md:hidden">
        {devices.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            Nenhum dispositivo cadastrado ainda.
          </div>
        )}
        {devices.map((device) => (
          <div key={device.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words font-semibold text-slate-900">{device.name}</p>
                <p className="text-sm text-slate-500">
                  {device.user.name} • {device.user.email}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {device.platform && `${device.platform}`}
                  {device.browser ? ` • ${device.browser}` : ""}
                </p>
                <p className="text-xs text-slate-400">
                  Último acesso: {device.lastSeenAt ? format(new Date(device.lastSeenAt), "dd MMM yyyy, HH:mm", { locale: ptBR }) : "—"}
                  {device.lastIp ? ` • IP ${device.lastIp}` : ""}
                </p>
              </div>
              {device.status === "REVOGADO" ? (
                <span className="inline-flex shrink-0 items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-red-100 text-red-700">
                  <ShieldX size={12} /> Revogado
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700">
                  <ShieldCheck size={12} /> Ativo
                </span>
              )}
            </div>
            {device.status === "ATIVO" && (
              <RevokeDeviceButton deviceId={device.id} deviceName={device.name} className="mt-3" />
            )}
          </div>
        ))}
      </div>

      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[860px] w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Dispositivo</th>
                <th className="px-6 py-4">Usuário</th>
                <th className="px-6 py-4">Plataforma / Navegador</th>
                <th className="px-6 py-4">Último acesso</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {devices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    Nenhum dispositivo cadastrado ainda.
                  </td>
                </tr>
              )}
              {devices.map((device) => (
                <tr key={device.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 font-medium text-slate-900">{device.name}</td>
                  <td className="px-6 py-4">
                    <p className="text-slate-900">{device.user.name}</p>
                    <p className="text-xs text-slate-400">{device.user.email}</p>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {device.platform && `${device.platform}`}
                    {device.browser ? ` • ${device.browser}` : ""}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {device.lastSeenAt ? format(new Date(device.lastSeenAt), "dd MMM yyyy, HH:mm", { locale: ptBR }) : "—"}
                    {device.lastIp ? ` • ${device.lastIp}` : ""}
                  </td>
                  <td className="px-6 py-4">
                    {device.status === "REVOGADO" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        <ShieldX size={12} /> Revogado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                        <ShieldCheck size={12} /> Ativo
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {device.status === "ATIVO" ? (
                      <RevokeDeviceButton deviceId={device.id} deviceName={device.name} />
                    ) : (
                      <span className="text-xs text-slate-400">
                        Revogado em {device.revokedAt ? format(new Date(device.revokedAt), "dd MMM yyyy, HH:mm", { locale: ptBR }) : "—"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
