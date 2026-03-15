import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { createTicket } from "@/app/actions/tickets";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { SubmitButton } from "./submit-button";
import { CategoryInfoTooltip } from "@/components/CategoryInfoTooltip";

export default async function NewTicketPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const allCategories = await prisma.category.findMany({
    orderBy: { name: 'asc' }
  });
  // Deduplicar por nome (defensivo caso existam registros duplicados no banco)
  const seen = new Set<string>();
  const categories = allCategories.filter(c => {
    if (seen.has(c.name)) return false;
    seen.add(c.name);
    return true;
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/tickets" className="p-2 hover:bg-slate-200 rounded-full transition text-slate-500">
          <ArrowLeft size={20} />
        </Link>
        <h2 className="text-2xl font-bold text-gray-800">Abrir Novo Chamado</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8">
        <form action={async (formData) => {
          "use server"
          await createTicket(formData);
          redirect("/tickets");
        }} className="space-y-6">
          
          <div className="space-y-1">
            <label htmlFor="title" className="block text-sm font-medium text-slate-700">Título do Incidente / Solicitação <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              name="title" 
              id="title" 
              required
              placeholder="Ex: Teclado não está funcionando"
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-slate-900 bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-1">
              <label htmlFor="categoryId" className="flex items-center text-sm font-medium text-slate-700">Categoria <span className="text-red-500 ml-0.5">*</span><CategoryInfoTooltip /></label>
              <select 
                name="categoryId" 
                id="categoryId" 
                required
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white text-slate-900"
              >
                <option value="">Selecione a categoria...</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="priority" className="block text-sm font-medium text-slate-700">Impacto/Prioridade <span className="text-red-500">*</span></label>
              <select 
                name="priority" 
                id="priority" 
                required
                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white text-slate-900"
              >
                <option value="BAIXA">Baixa - Baixo impacto no trabalho</option>
                <option value="MEDIA">Média - Dificulta mas não impede</option>
                <option value="ALTA">Alta - Impede uma pessoa de trabalhar</option>
                <option value="CRITICA">Crítica - Impede equipe inteira ou sistema fora</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="description" className="block text-sm font-medium text-slate-700">Descrição Detalhada <span className="text-red-500">*</span></label>
            <textarea 
              name="description" 
              id="description" 
              required
              rows={5}
              placeholder="Descreva o problema passo a passo ou a necessidade..."
              className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition resize-none text-slate-900 bg-white"
            ></textarea>
          </div>

          <div className="space-y-1">
            <label htmlFor="attachments" className="block text-sm font-medium text-slate-700">Anexos (Opcional)</label>
            <input 
              type="file" 
              name="attachments" 
              id="attachments" 
              multiple 
              accept="image/*"
              className="w-full border border-slate-300 rounded-lg px-4 py-2 text-sm text-slate-900 bg-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition"
            />
            <p className="text-xs text-slate-500 mt-1">Você pode anexar imagens como capturas de tela para auxiliar o suporte.</p>
          </div>

          <div className="pt-4 flex justify-end">
            <SubmitButton />
          </div>
        </form>
      </div>
    </div>
  );
}
