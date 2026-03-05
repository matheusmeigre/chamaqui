import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import { markNotificationAsRead, markAllNotificationsAsRead } from "@/app/actions/notifications";

export default async function NotificationsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Bell className="text-blue-500" /> Minhas Notificações
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Você tem {unreadCount} notificaç{unreadCount === 1 ? "ão" : "ões"} não lida{unreadCount === 1 ? "" : "s"}.
          </p>
        </div>

        {unreadCount > 0 && (
          <form action={async () => {
            "use server"
            await markAllNotificationsAsRead();
          }}>
            <button type="submit" className="flex items-center gap-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg transition font-medium">
              <Check size={16} /> Marcar todas como lidas
            </button>
          </form>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Bell className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <p>Nenhuma notificação encontrada.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((notif) => (
              <div 
                key={notif.id} 
                className={`p-4 hover:bg-slate-50 transition flex items-start gap-4 ${notif.read ? 'opacity-70' : 'bg-blue-50/50'}`}
              >
                <div className="mt-1">
                  {!notif.read ? (
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  ) : (
                    <div className="w-2 h-2 bg-transparent" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-start">
                    <h4 className={`text-sm ${notif.read ? 'font-medium text-slate-700' : 'font-semibold text-slate-900'}`}>
                      {notif.title}
                    </h4>
                    <span className="text-xs text-slate-400 whitespace-nowrap ml-4">
                      {format(new Date(notif.createdAt), "dd/MM/yyyy HH:mm")}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">
                    {notif.message}
                  </p>
                  
                  <div className="flex items-center gap-4 mt-3 pt-2">
                    {notif.link && (
                      <Link 
                        href={notif.link}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                      >
                        Acessar link <ExternalLink size={12} />
                      </Link>
                    )}
                    
                    {!notif.read && (
                      <form action={async () => {
                        "use server"
                        await markNotificationAsRead(notif.id);
                      }}>
                        <button type="submit" className="text-xs text-slate-500 hover:text-slate-700 font-medium">
                          Marcar como lida
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}