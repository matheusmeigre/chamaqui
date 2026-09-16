import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui";
import { ActivationCodesPanel } from "./activation-codes-panel";

export const metadata = { title: "Códigos de Ativação | Chamaqui" };

export default async function ActivationCodesPage() {
  const session = await getCurrentUser();

  if (!session || session.role !== "ADMINISTRADOR") {
    redirect("/dashboard");
  }

  const [codes, organization] = await Promise.all([
    prisma.activationCode.findMany({
      where: { organizationId: session.organizationId ?? "" },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    session.organizationId
      ? prisma.organization.findUnique({
          where: { id: session.organizationId },
          select: { slug: true },
        })
      : Promise.resolve(null),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title="Códigos de ativação"
        description="Gere códigos de uso único para ativar dispositivos. Cada código expira em 30 dias e é exibido apenas uma vez."
      />

      <ActivationCodesPanel
        isAdminOrganization={organization?.slug === "hdl"}
        codes={codes.map((code) => ({
          id: code.id,
          role: code.role,
          used: Boolean(code.usedAt),
          usedAt: code.usedAt?.toISOString() ?? null,
          expiresAt: code.expiresAt.toISOString(),
          createdAt: code.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
