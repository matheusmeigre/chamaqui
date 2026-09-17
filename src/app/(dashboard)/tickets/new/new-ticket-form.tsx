"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2, UploadCloud } from "lucide-react";
import type { TicketCategoryCode } from "@prisma/client";
import { ClassificationFields } from "@/components/grid/ClassificationFields";
import { FIELD_CLASS } from "@/components/ui";
import { cn } from "@/lib/ui";
import { DescriptionField } from "./description-field";
import { SubmitButton } from "./submit-button";

const TITLE_MAX = 120;

function Step({
  number,
  title,
  description,
  children,
}: {
  number: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface shadow-card">
      <header className="flex items-start gap-3 border-b border-line px-4 py-3.5 sm:px-6">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand-ink">
          {number}
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-ink-3">{description}</p>}
        </div>
      </header>
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}

export function NewTicketForm({
  action,
  categories,
  canClassify,
  assistantEnabled,
}: {
  action: (formData: FormData) => Promise<void>;
  categories: Array<{ id: string; name: string; description: string | null }>;
  canClassify: boolean;
  /** Auxílio de escrita com IA — opcional, e ausente se não houver provedor. */
  assistantEnabled: boolean;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<TicketCategoryCode | "">("");
  const [previews, setPreviews] = useState<Array<{ file: File; url: string }>>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const liveUrls = useRef<string[]>([]);

  // Libera as prévias só na desmontagem real: revogar a cada render quebraria
  // as imagens ainda na tela.
  useEffect(() => () => liveUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  // O input de arquivo é a fonte de verdade enviada ao servidor; o estado só
  // espelha o que está nele para desenhar a prévia.
  const commit = (next: File[], writeInput: boolean) => {
    if (writeInput && inputRef.current) {
      const transfer = new DataTransfer();
      next.forEach((file) => transfer.items.add(file));
      inputRef.current.files = transfer.files;
    }
    const reused = new Map(previews.map((preview) => [preview.file, preview.url]));
    const nextPreviews = next.map((file) => ({
      file,
      url: reused.get(file) ?? URL.createObjectURL(file),
    }));
    const keep = new Set(nextPreviews.map((preview) => preview.url));
    previews.forEach((preview) => {
      if (!keep.has(preview.url)) URL.revokeObjectURL(preview.url);
    });
    liveUrls.current = [...keep];
    setPreviews(nextPreviews);
  };

  const files = previews.map((preview) => preview.file);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const images = Array.from(incoming).filter((file) => file.type.startsWith("image/"));
    commit([...files, ...images], true);
  };

  // Com severidade, a prioridade é derivada no servidor — perguntar seria ruído.
  const showPriority = category !== "C1";

  return (
    <form action={action} className="space-y-5">
      <Step
        number={1}
        title="O que está acontecendo?"
        description="Um bom título e passos claros encurtam a triagem."
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <label htmlFor="title" className="text-sm font-medium text-ink">
                Título <span className="text-critical">*</span>
              </label>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  title.length > TITLE_MAX ? "text-critical-ink" : "text-ink-3"
                )}
              >
                {title.length}/{TITLE_MAX}
              </span>
            </div>
            <input
              type="text"
              name="title"
              id="title"
              required
              maxLength={TITLE_MAX}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Captura não valida no atrativo Praça Rui Barbosa"
              className={FIELD_CLASS}
            />
          </div>

          <DescriptionField assistantEnabled={assistantEnabled} />
        </div>
      </Step>

      <Step
        number={2}
        title="Classificação na grade"
        description="Define o SLA e se a demanda consome o teto mensal."
      >
        <ClassificationFields canClassify={canClassify} onCategoryChange={setCategory} />
      </Step>

      <Step number={3} title="Contexto técnico">
        <div className={cn("grid gap-4", showPriority && "md:grid-cols-2")}>
          <div className="min-w-0 space-y-1.5">
            <label htmlFor="categoryId" className="text-sm font-medium text-ink">
              Área afetada <span className="text-critical">*</span>
            </label>
            <select name="categoryId" id="categoryId" required defaultValue="" className={FIELD_CLASS}>
              <option value="" disabled>
                Selecione a área…
              </option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          {showPriority && (
            <div className="min-w-0 space-y-1.5">
              <label htmlFor="priority" className="text-sm font-medium text-ink">
                Urgência para você <span className="text-critical">*</span>
              </label>
              <select name="priority" id="priority" required defaultValue="MEDIA" className={FIELD_CLASS}>
                <option value="BAIXA">Baixa — pode esperar</option>
                <option value="MEDIA">Média — dificulta, mas não impede</option>
                <option value="ALTA">Alta — impede uma pessoa de trabalhar</option>
                <option value="CRITICA">Crítica — equipe ou sistema parado</option>
              </select>
            </div>
          )}
        </div>
      </Step>

      <Step number={4} title="Evidências" description="Opcional — capturas de tela ajudam a reproduzir.">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            addFiles(event.dataTransfer.files);
          }}
          className={cn(
            "relative flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition",
            dragging ? "border-brand bg-brand-soft" : "border-line-strong bg-surface-2 hover:border-ink-3"
          )}
        >
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-surface text-ink-3 shadow-card">
            <UploadCloud size={20} />
          </span>
          <p className="text-sm font-medium text-ink">
            Arraste imagens aqui ou{" "}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="font-semibold text-brand-ink underline-offset-2 hover:underline"
            >
              escolha do dispositivo
            </button>
          </p>
          <p className="text-xs text-ink-3">PNG, JPG ou WEBP</p>
          <input
            ref={inputRef}
            type="file"
            name="attachments"
            id="attachments"
            multiple
            accept="image/*"
            className="sr-only"
            onChange={(event) => commit(Array.from(event.target.files ?? []), false)}
          />
        </div>

        {previews.length > 0 && (
          <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            {previews.map(({ file, url }, index) => (
              <li key={url} className="group relative aspect-square overflow-hidden rounded-xl border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={file.name} className="h-full w-full object-cover" />
                <button
                  type="button"
                  aria-label={`Remover ${file.name}`}
                  onClick={() => commit(files.filter((_, position) => position !== index), true)}
                  className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-lg bg-black/60 text-white opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="grid aspect-square w-full place-items-center rounded-xl border border-dashed border-line-strong text-ink-3 transition hover:border-brand hover:text-brand-ink"
                aria-label="Adicionar mais imagens"
              >
                <ImagePlus size={18} />
              </button>
            </li>
          </ul>
        )}
      </Step>

      <div className="sticky bottom-0 z-10 -mx-3.5 border-t border-line bg-canvas/90 px-3.5 py-3 backdrop-blur-md sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
          <p className="text-center text-xs text-ink-3 sm:mr-auto sm:text-left">
            O prazo de SLA começa a contar no momento do registro.
          </p>
          <SubmitButton />
        </div>
      </div>
    </form>
  );
}
