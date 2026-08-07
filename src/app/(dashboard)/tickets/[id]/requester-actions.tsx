"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { resolveTicketCustomer, reopenTicketCustomer } from "@/app/actions/tickets";

export function RequesterActions({ ticketId }: { ticketId: string }) {
  const [view, setView] = useState<'WAITING' | 'RESOLVING' | 'REOPENING'>('WAITING');
  const [rating, setRating] = useState(5);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="bg-green-50 rounded-xl shadow-sm border border-green-200 p-4 sm:p-6 mb-6">
        <h3 className="text-lg font-semibold text-green-900 mb-1">
          {view === 'REOPENING' ? 'Chamado reaberto!' : 'Obrigado pela avaliação!'}
        </h3>
        <p className="text-sm text-green-800">
          {view === 'REOPENING'
            ? 'O chamado voltou para atendimento e você pode acompanhar as novidades na área de comentários.'
            : 'O chamado foi finalizado e sua avaliação foi registrada.'}
        </p>
      </div>
    );
  }

  if (view === 'WAITING') {
    return (
      <div className="bg-amber-50 rounded-xl shadow-sm border border-amber-200 p-4 sm:p-6 mb-6">
        <h3 className="text-lg font-semibold text-amber-900 mb-2">Ação Requerida (Sua Avaliação)</h3>
        <p className="text-sm text-amber-800 mb-4">
          O técnico marcou este chamado como resolvido ou pendente de sua validação. A solução aplicada resolveu completamente o seu problema?
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button onClick={() => setView('RESOLVING')} className="min-h-11 w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
            Sim, problema resolvido
          </button>
          <button onClick={() => setView('REOPENING')} className="min-h-11 w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
            Não, o problema persiste
          </button>
        </div>
      </div>
    );
  }

  if (view === 'RESOLVING') {
    return (
      <div className="bg-green-50 rounded-xl shadow-sm border border-green-200 p-4 sm:p-6 mb-6">
        <h3 className="text-lg font-semibold text-green-900 mb-4">Finalizar Chamado</h3>
        <form action={async (data) => {
          setIsLoading(true);
          setError(null);
          try {
            await resolveTicketCustomer(data);
            setDone(true);
          } catch {
            setError("Erro ao finalizar o chamado. Tente novamente.");
          } finally {
            setIsLoading(false);
          }
        }} className="space-y-4">
          <input type="hidden" name="ticketId" value={ticketId} />
          
          <div>
            <label className="block text-sm font-medium text-green-800 mb-1">Avalie o atendimento</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button aria-label={`${star} estrela${star > 1 ? "s" : ""}`} type="button" key={star} onClick={() => setRating(star)} className="grid min-h-11 min-w-11 place-items-center focus:outline-none focus:scale-110 transition-transform">
                  <Star size={28} className={star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'} />
                </button>
              ))}
            </div>
            <input type="hidden" name="rating" value={rating} />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-green-800 mb-1">Deixe um comentário da avaliação (opcional)</label>
            <textarea name="ratingNotes" rows={3} className="w-full bg-white border border-green-200 rounded-lg p-3 text-base text-slate-900 outline-none focus:ring-2 focus:ring-green-500"></textarea>
          </div>
          
          <div className="space-y-3">
            {error && (
              <p className="text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}
            <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end">
            <button type="button" onClick={() => setView('WAITING')} className="min-h-11 w-full sm:w-auto text-sm font-medium text-slate-500 hover:text-slate-700 px-4 py-2">Cancelar</button>
            <button type="submit" disabled={isLoading} className="min-h-11 w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
              {isLoading ? "Salvando..." : "Confirmar Resolução"}
            </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  if (view === 'REOPENING') {
    return (
      <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 p-4 sm:p-6 mb-6 animate-in fade-in zoom-in duration-200">
        <h3 className="text-lg font-semibold text-red-900 mb-4">Reabrir Chamado</h3>
        <form action={async (data) => {
          setIsLoading(true);
          setError(null);
          try {
            await reopenTicketCustomer(data);
            setDone(true);
          } catch {
            setError("Erro ao reabrir o chamado. Tente novamente.");
          } finally {
            setIsLoading(false);
          }
        }} className="space-y-4">
           <input type="hidden" name="ticketId" value={ticketId} />
           
           <div>
             <label className="block text-sm font-medium text-red-800 mb-1">Motivo da recusa / O que deu errado?</label>
             <textarea name="reason" required rows={3} className="w-full bg-white border border-red-200 rounded-lg p-3 text-base text-slate-900 outline-none focus:ring-2 focus:ring-red-500" placeholder="Explique por que a solução não funcionou..."></textarea>
             <p className="text-xs text-red-600 mt-1">Após reabrir você poderá voltar a enviar imagens na área de comentários.</p>
           </div>
           
            <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end mt-4">
              <button type="button" onClick={() => setView('WAITING')} className="min-h-11 w-full sm:w-auto text-sm font-medium text-slate-500 hover:text-slate-700 px-4 py-2">Cancelar</button>
              <button type="submit" disabled={isLoading} className="min-h-11 w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
               {isLoading ? "Processando..." : "Voltar Chamado para Atendimento"}
             </button>
           </div>
        </form>
      </div>
    );
  }
  
  return null;
}
