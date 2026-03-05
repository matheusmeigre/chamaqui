import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, Ticket, Users, Settings, LogOut, Bell } from "lucide-react";
import prisma from "@/lib/prisma";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/api/auth/signin");
  }

  const unreadNotificationsCount = await prisma.notification.count({
    where: {
      userId: session.user.id,
      read: false
    }
  });

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-4 text-2xl font-bold border-b border-slate-700">
          Chamaqui
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link href="/dashboard" className="flex items-center gap-2 p-2 rounded hover:bg-slate-800">
            <LayoutDashboard size={20} />
            Dashboard
          </Link>
          <Link href="/tickets" className="flex items-center gap-2 p-2 rounded hover:bg-slate-800">
            <Ticket size={20} />
            Chamados
          </Link>
          <Link href="/notifications" className="flex items-center justify-between p-2 rounded hover:bg-slate-800">
            <div className="flex items-center gap-2">
              <Bell size={20} />
              Notificações
            </div>
            {unreadNotificationsCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadNotificationsCount}
              </span>
            )}
          </Link>
          {session.user.role === "ADMINISTRADOR" && (
            <>
              <Link href="/users" className="flex items-center gap-2 p-2 rounded hover:bg-slate-800">
                <Users size={20} />
                Usuários
              </Link>
              <Link href="/settings" className="flex items-center gap-2 p-2 rounded hover:bg-slate-800">
                <Settings size={20} />
                Configurações
              </Link>
            </>
          )}
        </nav>
        <div className="p-4 border-t border-slate-700 text-sm flex justify-between items-center">
          <div>
            <p className="font-semibold">{session.user.name}</p>
            <p className="text-slate-400 text-xs">{session.user.role}</p>
          </div>
          <Link href="/api/auth/signout" className="text-slate-400 hover:text-white">
            <LogOut size={20} />
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white shadow-sm p-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-800">Painel de Controle</h1>
        </header>
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
