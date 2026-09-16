import { redirect } from "next/navigation";
import { Globe, Laptop, Monitor, ShieldCheck, ShieldX, Smartphone } from "lucide-react";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { FormattedDate } from "@/components/FormattedDate";
import { Badge, Card, EmptyState, PageHeader, TableShell, Td, Th } from "@/components/ui";
import { StatTile } from "@/components/ui/StatTile";
import { formatAge } from "@/lib/ui";
import { RevokeDeviceButton } from "./revoke-device-button";

export const metadata = { title: "Dispositivos | Chamaqui" };

function DeviceIcon({ platform }: { platform: string | null }) {
  const text = (platform ?? "").toLowerCase();
  if (/android|ios|iphone|ipad/.test(text)) return <Smartphone size={16} />;
  if (/windows|mac|linux/.test(text)) return <Laptop size={16} />;
  return <Monitor size={16} />;
}

/** Dispositivos vistos nos últimos N dias — o relógio fica fora da renderização. */
function countSeenWithin(devices: Array<{ lastSeenAt: Date | null }>, days: number): number {
  const since = Date.now() - days * 86_400_000;
  return devices.filter((device) => device.lastSeenAt && device.lastSeenAt.getTime() >= since).length;
}

export default async function DevicesPage() {
  const session = await getCurrentUser();

  if (!session || session.role !== "ADMINISTRADOR") {
    redirect("/dashboard");
  }

  const devices = await prisma.device.findMany({
    where: { organizationId: session.organizationId ?? "" },
    include: { user: { select: { name: true, email: true } } },
    orderBy: [{ status: "asc" }, { lastSeenAt: { sort: "desc", nulls: "last" } }],
  });

  const active = devices.filter((device) => device.status === "ATIVO");
  const seenThisWeek = countSeenWithin(active, 7);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dispositivos"
        description="Revogue o acesso de dispositivos perdidos ou não reconhecidos. A revogação é imediata."
      />

      <section className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-3 sm:gap-4">
        <StatTile label="Ativos" value={String(active.length)} icon={<ShieldCheck size={16} />} tone="good" />
        <StatTile
          label="Acessaram nos últimos 7 dias"
          value={String(seenThisWeek)}
          icon={<Globe size={16} />}
          tone="brand"
        />
        <StatTile
          label="Revogados"
          value={String(devices.length - active.length)}
          icon={<ShieldX size={16} />}
          tone="neutral"
        />
      </section>

      {devices.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Monitor size={20} />}
            title="Nenhum dispositivo cadastrado"
            description="Dispositivos aparecem aqui depois de ativados por código ou QR Code."
          />
        </Card>
      ) : (
        <>
          <ul className="space-y-2.5 md:hidden">
            {devices.map((device) => (
              <li key={device.id} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-3 text-ink-2">
                    <DeviceIcon platform={device.platform} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{device.name}</p>
                    <p className="truncate text-sm text-ink-3">{device.user.name}</p>
                    <p className="mt-1 text-xs text-ink-3">
                      {[device.platform, device.browser].filter(Boolean).join(" · ") || "Plataforma desconhecida"}
                    </p>
                  </div>
                  <StatusBadge status={device.status} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
                  <span className="text-xs text-ink-3">
                    {device.lastSeenAt ? `Visto ${formatAge(device.lastSeenAt)}` : "Nunca acessou"}
                  </span>
                  {device.status === "ATIVO" && (
                    <RevokeDeviceButton deviceId={device.id} deviceName={device.name} />
                  )}
                </div>
              </li>
            ))}
          </ul>

          <Card className="hidden overflow-hidden md:block">
            <TableShell minWidth={900}>
              <thead>
                <tr>
                  <Th>Dispositivo</Th>
                  <Th>Usuário</Th>
                  <Th>Último acesso</Th>
                  <Th>Status</Th>
                  <Th align="right">Ação</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {devices.map((device) => (
                  <tr key={device.id} className="transition hover:bg-surface-2">
                    <Td>
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-3 text-ink-2">
                          <DeviceIcon platform={device.platform} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-ink">{device.name}</p>
                          <p className="truncate text-xs text-ink-3">
                            {[device.platform, device.browser].filter(Boolean).join(" · ") || "—"}
                          </p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <p className="text-ink">{device.user.name}</p>
                      <p className="text-xs text-ink-3">{device.user.email}</p>
                    </Td>
                    <Td className="text-xs">
                      {device.lastSeenAt ? (
                        <>
                          <p className="text-ink-2">
                            <FormattedDate date={device.lastSeenAt} pattern="dd MMM yyyy, HH:mm" />
                          </p>
                          {device.lastIp && <p className="font-mono text-ink-3">{device.lastIp}</p>}
                        </>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </Td>
                    <Td>
                      <StatusBadge status={device.status} />
                    </Td>
                    <Td align="right">
                      {device.status === "ATIVO" ? (
                        <RevokeDeviceButton deviceId={device.id} deviceName={device.name} />
                      ) : (
                        <span className="text-xs text-ink-3">
                          {device.revokedAt ? (
                            <>
                              Revogado em <FormattedDate date={device.revokedAt} pattern="dd/MM/yyyy" />
                            </>
                          ) : (
                            "—"
                          )}
                        </span>
                      )}
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

function StatusBadge({ status }: { status: string }) {
  return status === "REVOGADO" ? (
    <Badge tone="critical" icon={<ShieldX size={11} />}>
      Revogado
    </Badge>
  ) : (
    <Badge tone="good" icon={<ShieldCheck size={11} />}>
      Ativo
    </Badge>
  );
}
