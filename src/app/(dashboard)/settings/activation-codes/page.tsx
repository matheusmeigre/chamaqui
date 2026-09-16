import { getCurrentUser } from "@/lib/auth/session";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { QrCode } from "lucide-react";
import { ActivationCodesPanel } from "./activation-codes-panel";
import { FormattedDate } from "@/components/FormattedDate";

export const metadata = { title: "Códigos de Ativação | Chamaqui" };

export default async function ActivationCodesPage() {
  const session = await getCurrentUser();

  if (!session || session.role !== "ADMINISTRADOR") {
    redirect("/dashboard");
  }

  const codes = await prisma.activationCode.findMany({
    where: { organizationId: session.organizationId ?? "" },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const organization = session.organizationId
    ? await prisma.organization.findUnique({
        where: { id: session.organizationId },
        select: { slug: true },
      })
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <QrCode className="shrink-0 text-gray-800" size={28} />
        <h2 className="break-words text-2xl font-bold text-gray-800">Códigos de Ativação</h2>
      </div>
      <p className="text-sm text-slate-500 -mt-4">
        Gere códigos de uso único para ativar dispositivos. Cada código expira em 30 dias e é exibido apenas uma vez.
      </p>

      <ActivationCodesPanel
        isAdminOrganization={organization?.slug === "hdl"}
        codes={codes.map((c) => ({
          id: c.id,
          role: c.role,
          used: Boolean(c.usedAt),
          usedAt: c.usedAt?.toISOString() ?? null,
          expiresAt: c.expiresAt.toISOString(),
          createdAt: c.createdAt.toISOString(),
        }))}
      />

      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Criado em</th>
                <th className="px-6 py-4">Permissão</th>
                <th className="px-6 py-4">Expira em</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {codes.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                    Nenhum código gerado ainda.
                  </td>
                </tr>
              )}
              {codes.map((code) => (
                <tr key={code.id} className="hover:bg-slate-50 transition">
                  <td className="px-6 py-4 text-slate-500">
                    <FormattedDate date={code.createdAt} pattern="dd MMM yyyy, HH:mm" />
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                      {code.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    <FormattedDate date={code.expiresAt} pattern="dd MMM yyyy, HH:mm" />
                  </td>
                  <td className="px-6 py-4">
                    {code.usedAt ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                        Usado
                      </span>
                    ) : code.expiresAt < new Date() ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
                        Expirado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        Ativo
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
