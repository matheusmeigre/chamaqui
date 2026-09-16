"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";

interface ImageGalleryProps {
  urls: string[];
}

export function ImageGallery({ urls }: ImageGalleryProps) {
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    if (selected === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
      if (event.key === "ArrowRight") setSelected((index) => (index === null ? null : (index + 1) % urls.length));
      if (event.key === "ArrowLeft")
        setSelected((index) => (index === null ? null : (index - 1 + urls.length) % urls.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, urls.length]);

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
        {urls.map((url, index) => (
          <button
            key={url}
            type="button"
            onClick={() => setSelected(index)}
            className="group relative block aspect-square w-full overflow-hidden rounded-xl border border-line bg-surface-2 transition hover:border-brand"
            aria-label={`Ampliar anexo ${index + 1}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Anexo ${index + 1}`}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {selected !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Anexo ${selected + 1} de ${urls.length}`}
          className="animate-fade fixed inset-0 z-100 flex items-center justify-center bg-black/85 p-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm"
          onClick={() => setSelected(null)}
        >
          <div className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] flex items-center gap-1">
            <span className="mr-2 text-sm tabular-nums text-white/70">
              {selected + 1} / {urls.length}
            </span>
            <a
              href={urls[selected]}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              aria-label="Abrir original em nova aba"
              className="grid h-11 w-11 place-items-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              <ExternalLink size={20} />
            </a>
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Fechar imagem"
              className="grid h-11 w-11 place-items-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              <X size={24} />
            </button>
          </div>

          {urls.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Imagem anterior"
                onClick={(event) => {
                  event.stopPropagation();
                  setSelected((selected - 1 + urls.length) % urls.length);
                }}
                className="absolute left-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                type="button"
                aria-label="Próxima imagem"
                onClick={(event) => {
                  event.stopPropagation();
                  setSelected((selected + 1) % urls.length);
                }}
                className="absolute right-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={urls[selected]}
            alt={`Anexo ${selected + 1} ampliado`}
            onClick={(event) => event.stopPropagation()}
            className="max-h-[calc(100dvh-7rem)] max-w-[calc(100vw-7rem)] rounded-xl object-scale-down shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
