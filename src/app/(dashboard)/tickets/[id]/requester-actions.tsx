"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { resolveTicketCustomer, reopenTicketCustomer } from "@/app/actions/tickets";

export function RequesterActions({ ticketId }: { ticketId: string }) {
  const [view, setView] = useState<'WAITING' | 'RESOLVING' | 'REOPENING'>('WAITING');
  const [rating, setRating] = useState(5);
  const [isLoading, setIsLoading] = useState(false);

  if (view === 'WAITING') {
    return (
      <div className="bg-amber-50 rounded-xl shadow-sm border border-amber-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-amber-900 mb-2">Ação Requerida (Sua Avaliação)</h3>
        <p className="text-sm text-amber-800 mb-4">
          O técnico marcou este chamado como resolvido ou pendente de sua validação. A solução aplicada resolveu completamente o seu problema?
        </p>
        <div className="flex gap-4">
          <button onClick={() => setView('RESOLVING')} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
            Sim, problema resolvido
          </button>
          <button onClick={() => setView('REOPENING')} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
            Não, o problema persiste
          </button>
        </div>
      </div>
    );
  }

  if (view === 'RESOLVING') {
    return (
      <div className="bg-green-50 rounded-xl shadow-sm border border-green-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-green-900 mb-4">Finalizar Chamado</h3>
        <form action={async (data) => {
          setIsLoading(true);
          await resolveTicketCustomer(data);
          setIsLoading(false);
          setView('WAITING');
        }} className="space-y-4">
          <input type="hidden" name="ticketId" value={ticketId} />
          
          <div>
            <label className="block text-sm font-medium text-green-800 mb-1">Avalie o atendimento</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button type="button" key={star} onClick={() => setRating(star)} className="focus:outline-none focus:scale-110 transition-transform">
                  <Star size={28} className={star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'} />
                </button>
              ))}
            </div>
            <input type="hidden" name="rating" value={rating} />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-green-800 mb-1">Deixe um comentário da avaliação (opcional)</label>
            <textarea name="ratingNotes" rows={3} className="w-full bg-white border border-green-200 rounded-lg p-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-green-500"></textarea>
          </div>
          
          <div className="flex gap-3 justify-end mt-4">
            <button type="button" onClick={() => setView('WAITING')} className="text-sm font-medium text-slate-500 hover:text-slate-700 px-4 py-2">Cancelar</button>
            <button type="submit" disabled={isLoading} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
              {isLoading ? "Salvando..." : "Confirmar Resolução"}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (view === 'REOPENING') {
    return (
      <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 p-6 mb-6 animate-in fade-in zoom-in duration-200">
        <h3 className="text-lg font-semibold text-red-900 mb-4">Reabrir Chamado</h3>
        <form action={async (data) => {
          setIsLoading(true);
          await reopenTicketCustomer(data);
          setIsLoading(false);
          setView('WAITING');
        }} className="space-y-4">
           <input type="hidden" name="ticketId" value={ticketId} />
           
           <div>
             <label className="block text-sm font-medium text-red-800 mb-1">Motivo da recusa / O que deu errado?</label>
             <textarea name="reason" required rows={3} className="w-full bg-white border border-red-200 rounded-lg p-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-red-500" placeholder="Explique por que a solução não funcionou..."></textarea>
             <p className="text-xs text-red-600 mt-1">Após reabrir você poderá voltar a enviar imagens na área de comentários.</p>
           </div>
           
           <div className="flex gap-3 justify-end mt-4">
             <button type="button" onClick={() => setView('WAITING')} className="text-sm font-medium text-slate-500 hover:text-slate-700 px-4 py-2">Cancelar</button>
             <button type="submit" disabled={isLoading} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
               {isLoading ? "Processando..." : "Voltar Chamado para Atendimento"}
             </button>
           </div>
        </form>
      </div>
    );
  }
  
  return null;
}