import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  // Exemplo de métricas baseadas no Prisma e Role do Usuário
  const totalTickets = await prisma.ticket.count();
  const openTickets = await prisma.ticket.count({ where: { status: "ABERTO" } });
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Bem-vindo, {session?.user?.name}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Total de Chamados</h3>
          <p className="text-3xl font-bold mt-2 text-gray-800">{totalTickets}</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <h3 className="text-gray-500 text-sm font-medium">Chamados Abertos</h3>
          <p className="text-3xl font-bold mt-2 text-amber-600">{openTickets}</p>
        </div>
      </div>
    </div>
  );
}
