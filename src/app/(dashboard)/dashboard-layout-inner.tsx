"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Ticket, Users, Settings, LogOut, Bell, Menu, X } from "lucide-react";

interface User {
  name?: string | null;
  role?: string | null;
}

interface DashboardLayoutInnerProps {
  children: React.ReactNode;
  user: User;
  unreadCount: number;
}

export function DashboardLayoutInner({ children, user, unreadCount }: DashboardLayoutInnerProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex h-[100dvh] bg-gray-100 overflow-hidden">
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50
        w-[min(18rem,calc(100vw-env(safe-area-inset-right)))] bg-slate-900 text-white flex flex-col
        pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        <div className="p-4 text-2xl font-bold border-b border-slate-700 flex justify-between items-center">
          Chamaqui
           <button aria-label="Fechar menu" className="md:hidden grid min-h-11 min-w-11 place-items-center text-slate-300 hover:text-white" onClick={closeSidebar}>
            <X size={24} />
          </button>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <Link href="/dashboard" onClick={closeSidebar} className={`flex min-h-11 items-center gap-2 px-3 py-2 rounded transition ${pathname === '/dashboard' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
            <LayoutDashboard size={20} />
            Dashboard
          </Link>
          <Link href="/tickets" onClick={closeSidebar} className={`flex min-h-11 items-center gap-2 px-3 py-2 rounded transition ${pathname?.startsWith('/tickets') ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
            <Ticket size={20} />
            Chamados
          </Link>
          <Link href="/notifications" onClick={closeSidebar} className={`flex min-h-11 items-center justify-between px-3 py-2 rounded transition ${pathname === '/notifications' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
            <div className="flex items-center gap-2">
              <Bell size={20} />
              Notificações
            </div>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </Link>
          {user.role === "ADMINISTRADOR" && (
            <>
              <Link href="/users" onClick={closeSidebar} className={`flex min-h-11 items-center gap-2 px-3 py-2 rounded transition ${pathname?.startsWith('/users') ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
                <Users size={20} />
                Usuários
              </Link>
              <Link href="/settings" onClick={closeSidebar} className={`flex min-h-11 items-center gap-2 px-3 py-2 rounded transition ${pathname === '/settings' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}>
                <Settings size={20} />
                Configurações
              </Link>
            </>
          )}
        </nav>
        <div className="p-4 border-t border-slate-700 text-sm flex justify-between items-center">
          <div className="truncate pr-2">
            <p className="font-semibold truncate">{user.name}</p>
            <p className="text-slate-400 text-xs truncate">{user.role}</p>
          </div>
          <Link aria-label="Sair" href="/api/auth/signout" className="grid min-h-11 min-w-11 place-items-center text-slate-400 hover:text-white shrink-0">
            <LogOut size={20} />
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="bg-white shadow-sm px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-4 flex items-center gap-2 sm:gap-4 sticky top-0 z-10 shrink-0">
          <button 
            aria-label="Abrir menu"
            className="md:hidden grid min-h-11 min-w-11 place-items-center text-slate-700 hover:text-blue-600 focus:outline-none"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>
          <h1 className="text-xl font-semibold text-gray-800 truncate">Painel de Controle</h1>
        </header>
        <div className="px-[max(0.75rem,env(safe-area-inset-left))] py-4 pr-[max(0.75rem,env(safe-area-inset-right))] pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4 md:p-6 overflow-y-auto flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
