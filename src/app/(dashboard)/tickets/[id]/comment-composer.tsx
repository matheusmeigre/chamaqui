"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ImagePlus, Loader2, Send, X } from "lucide-react";
import { addComment } from "@/app/actions/tickets";
import { cn } from "@/lib/ui";

function SendButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-on-brand shadow-card transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
      {pending ? "Enviando…" : "Enviar"}
    </button>
  );
}

export function CommentComposer({ ticketId }: { ticketId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const clearFiles = () => {
    setFiles([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await addComment(formData);
        setContent("");
        clearFiles();
      }}
      className="rounded-2xl border border-line bg-surface-2 p-2 transition focus-within:border-brand focus-within:shadow-(--ring-brand)"
    >
      <input type="hidden" name="ticketId" value={ticketId} />
      <textarea
        name="content"
        required
        rows={3}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        onKeyDown={(event) => {
          // Ctrl/⌘+Enter envia sem tirar a mão do teclado.
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && content.trim()) {
            event.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
        placeholder="Escreva uma atualização ou resposta…"
        aria-label="Mensagem"
        className="w-full resize-none bg-transparent px-2.5 py-2 text-sm text-ink outline-none placeholder:text-ink-3"
      />

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 px-2 pb-2">
          {files.map((file) => (
            <li
              key={`${file.name}-${file.size}`}
              className="inline-flex max-w-[14rem] items-center gap-1.5 rounded-lg bg-surface px-2 py-1 text-xs text-ink-2 ring-1 ring-line"
            >
              <ImagePlus size={12} className="shrink-0 text-ink-3" />
              <span className="truncate">{file.name}</span>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={clearFiles}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-ink-3 hover:text-critical-ink"
            >
              <X size={12} />
              Remover
            </button>
          </li>
        </ul>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-line px-1 pt-2">
        <label
          className={cn(
            "inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm text-ink-2 transition hover:bg-surface-3 hover:text-ink"
          )}
        >
          <ImagePlus size={16} />
          <span className="hidden sm:inline">Anexar imagens</span>
          <input
            ref={fileRef}
            type="file"
            name="attachments"
            multiple
            accept="image/*"
            className="sr-only"
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
          />
        </label>

        <div className="flex items-center gap-3">
          <span className="hidden text-[11px] text-ink-3 md:inline">Ctrl + Enter para enviar</span>
          <SendButton disabled={!content.trim()} />
        </div>
      </div>
    </form>
  );
}
