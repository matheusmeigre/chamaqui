import Link from 'next/link';
import { ArrowRight, Ticket, Clock, ShieldCheck } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="w-full bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ticket className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-slate-900">Chamaqui</span>
          </div>
          <nav>
            <Link 
              href="/api/auth/signin" 
              className="inline-flex items-center justify-center px-6 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              Entrar
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 tracking-tight mb-6">
          Sua Gestão de TI,<br />
          <span className="text-blue-600">Simplificada.</span>
        </h1>
        <p className="max-w-2xl text-lg sm:text-xl text-slate-600 mb-10">
          A plataforma Chamaqui conecta solicitantes e desenvolvedores de forma ágil. Acompanhe tickets, cumpra SLAs e revolucione o suporte da sua empresa.
        </p>
        <Link 
          href="/api/auth/signin"
          className="inline-flex items-center gap-2 px-8 py-4 text-lg font-medium rounded-full text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl"
        >
          Acessar a Plataforma
          <ArrowRight className="h-5 w-5" />
        </Link>

        {/* Features Preview */}
        <div className="mt-24 grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-5xl w-full">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-full mb-4">
              <Ticket className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Abertura Rápida</h3>
            <p className="text-slate-600 text-sm">Crie chamados com facilidade e anexe evidências.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
            <div className="p-3 bg-green-50 text-green-600 rounded-full mb-4">
              <Clock className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">SLA Inteligente</h3>
            <p className="text-slate-600 text-sm">Sem atrasos. Acompanhe os prazos de resolução em tempo real.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-full mb-4">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Resolução Eficaz</h3>
            <p className="text-slate-600 text-sm">Histórico completo, aprovação e pesquisa de satisfação.</p>
          </div>
        </div>
      </main>

      <footer className="w-full text-center p-6 text-slate-500 text-sm">
        &copy; {new Date().getFullYear()} Plataforma Chamaqui. Todos os direitos reservados.
      </footer>
    </div>
  );
}
