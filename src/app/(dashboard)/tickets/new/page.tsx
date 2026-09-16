import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, ChevronRight, ClipboardList, Lightbulb, MessagesSquare, Search, Wrench } from "lucide-react";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { createTicket } from "@/app/actions/tickets";
import { Card, CardBody, CardHeader } from "@/components/ui";
import { NewTicketForm } from "./new-ticket-form";

const JOURNEY = [
  { icon: ClipboardList, title: "Registro", text: "O chamado entra na fila e o relógio de SLA começa." },
  { icon: Search, title: "Triagem", text: "O suporte confirma a natureza e a severidade." },
  { icon: Wrench, title: "Atendimento", text: "Execução, contorno e correção, com atualizações na conversa." },
  { icon: CheckCircle2, title: "Validação", text: "Você confirma a solução e avalia o atendimento." },
];

export default async function NewTicketPage() {
  const session = await getCurrentUser();
  if (!session) redirect("/login");

  const allCategories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, description: true },
  });
  // Deduplicar por nome (defensivo caso existam registros duplicados no banco)
  const seen = new Set<string>();
  const categories = allCategories.filter((category) => {
    if (seen.has(category.name)) return false;
    seen.add(category.name);
    return true;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <nav aria-label="Trilha" className="flex items-center gap-1 text-sm text-ink-3">
        <Link href="/tickets" className="rounded-md px-1 hover:text-ink">
          Chamados
        </Link>
        <ChevronRight size={14} />
        <span className="font-medium text-ink-2">Novo</span>
      </nav>

      <header>
        <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-[1.75rem]">Abrir chamado</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-2">
          Descreva a demanda e classifique-a na grade. Em poucos passos o suporte recebe tudo o que
          precisa para começar.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <NewTicketForm
          categories={categories}
          canClassify={session.role === "ADMINISTRADOR"}
          action={async (formData) => {
            "use server";
            await createTicket(formData);
            redirect("/tickets");
          }}
        />

        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader icon={<MessagesSquare size={16} />} title="Como seu chamado anda" />
            <CardBody>
              <ol className="relative space-y-4 before:absolute before:bottom-3 before:left-3.75 before:top-3 before:w-px before:bg-line">
                {JOURNEY.map((step) => (
                  <li key={step.title} className="relative flex gap-3">
                    <span className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-3 text-ink-2 ring-4 ring-surface">
                      <step.icon size={14} />
                    </span>
                    <div className="min-w-0 pt-1">
                      <p className="text-sm font-semibold text-ink">{step.title}</p>
                      <p className="text-xs leading-relaxed text-ink-3">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={<Lightbulb size={16} />} title="Dicas para agilizar" />
            <CardBody>
              <ul className="space-y-2 text-xs leading-relaxed text-ink-2">
                <li>• Uma demanda por chamado — pedidos agrupados atrasam a entrega.</li>
                <li>• Diga onde aconteceu: atrativo, tela, aparelho e versão do app.</li>
                <li>• Anexe a captura da tela com a mensagem de erro.</li>
                <li>• Em dúvida sobre a natureza, escolha a mais próxima: a triagem ajusta.</li>
              </ul>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}
