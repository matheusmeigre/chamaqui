import { redirect } from "next/navigation";
import { Monitor, Shield, ShieldCheck, Ticket, UserPlus, Users } from "lucide-react";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { FormattedDate } from "@/components/FormattedDate";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, TableShell, Td, Th } from "@/components/ui";
import { StatTile } from "@/components/ui/StatTile";
import { initialsOf } from "@/lib/ui";

export default async function UsersPage() {
  const session = await getCurrentUser();

  if (!session || session.role !== "ADMINISTRADOR") {
    redirect("/dashboard");
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      organization: { select: { name: true } },
      _count: {
        select: {
          createdTickets: true,
          assignedTickets: true,
          devices: { where: { status: "ATIVO" } },
        },
      },
    },
  });

  const admins = users.filter((user) => user.role === "ADMINISTRADOR").length;
  const activeDevices = users.reduce((acc, user) => acc + user._count.devices, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Usuários"
        description="Pessoas com acesso ao portal. Novos acessos são concedidos por código de ativação."
        actions={
          <ButtonLink href="/settings/activation-codes">
            <UserPlus size={16} />
            Convidar usuário
          </ButtonLink>
        }
      />

      <section className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4 sm:gap-4">
        <StatTile label="Usuários" value={String(users.length)} icon={<Users size={16} />} tone="brand" />
        <StatTile label="Administradores" value={String(admins)} icon={<ShieldCheck size={16} />} tone="neutral" />
        <StatTile
          label="Solicitantes"
          value={String(users.length - admins)}
          icon={<Shield size={16} />}
          tone="neutral"
        />
        <StatTile
          label="Dispositivos ativos"
          value={String(activeDevices)}
          icon={<Monitor size={16} />}
          href="/settings/devices"
          tone="neutral"
        />
      </section>

      {users.length === 0 ? (
        <Card>
          <EmptyState icon={<Users size={20} />} title="Nenhum usuário cadastrado" />
        </Card>
      ) : (
        <>
          <ul className="space-y-2.5 md:hidden">
            {users.map((user) => (
              <li key={user.id} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand-ink">
                    {initialsOf(user.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{user.name}</p>
                    <p className="truncate text-sm text-ink-3">{user.email}</p>
                  </div>
                  <RoleBadge role={user.role} />
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
                  <MiniStat label="Abertos" value={user._count.createdTickets} />
                  <MiniStat label="Atendidos" value={user._count.assignedTickets} />
                  <MiniStat label="Dispositivos" value={user._count.devices} />
                </dl>
              </li>
            ))}
          </ul>

          <Card className="hidden overflow-hidden md:block">
            <TableShell minWidth={860}>
              <thead>
                <tr>
                  <Th>Pessoa</Th>
                  <Th>Organização</Th>
                  <Th>Perfil</Th>
                  <Th align="right">Chamados abertos</Th>
                  <Th align="right">Atendidos</Th>
                  <Th align="right">Dispositivos</Th>
                  <Th align="right">Desde</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.map((user) => (
                  <tr key={user.id} className="transition hover:bg-surface-2">
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand-ink">
                          {initialsOf(user.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink">
                            {user.name}
                            {user.id === session.id && (
                              <span className="ml-1.5 text-xs font-normal text-ink-3">(você)</span>
                            )}
                          </p>
                          <p className="truncate text-xs text-ink-3">{user.email}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-ink-2">{user.organization?.name ?? "—"}</Td>
                    <Td>
                      <RoleBadge role={user.role} />
                    </Td>
                    <Td align="right" numeric>
                      <span className="inline-flex items-center gap-1.5">
                        <Ticket size={13} className="text-ink-3" />
                        {user._count.createdTickets}
                      </span>
                    </Td>
                    <Td align="right" numeric>
                      {user._count.assignedTickets}
                    </Td>
                    <Td align="right" numeric>
                      {user._count.devices}
                    </Td>
                    <Td align="right" className="whitespace-nowrap text-xs text-ink-3">
                      <FormattedDate date={user.createdAt} pattern="dd MMM yyyy" />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          </Card>
        </>
      )}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  return role === "ADMINISTRADOR" ? (
    <Badge tone="brand" icon={<ShieldCheck size={11} />}>
      Administrador
    </Badge>
  ) : (
    <Badge tone="neutral" icon={<Shield size={11} />}>
      Solicitante
    </Badge>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-[11px] text-ink-3">{label}</dt>
      <dd className="text-sm font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}
