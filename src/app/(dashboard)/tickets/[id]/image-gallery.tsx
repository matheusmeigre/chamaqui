"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface ImageGalleryProps {
  urls: string[];
}

export function ImageGallery({ urls }: ImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedImage) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedImage(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedImage]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:gap-4">
        {urls.map((url, i) => (
          <button 
            key={i} 
            type="button"
            onClick={() => setSelectedImage(url)} 
            className="block aspect-square w-full sm:w-32 border border-slate-200 rounded-lg overflow-hidden hover:border-blue-500 transition focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Anexo ${i + 1}`} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>

      {selectedImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm transition-opacity"
          onClick={() => setSelectedImage(null)}
        >
          <div 
            className="relative flex max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-1.5rem)] items-center justify-center pt-14 animate-in"
            onClick={(e) => e.stopPropagation()} // Impede que clicar na imagem em si feche o modal
          >
            <button 
              onClick={() => setSelectedImage(null)}
              aria-label="Fechar imagem"
              className="absolute top-0 right-0 grid min-h-11 min-w-11 place-items-center text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition"
            >
              <X size={28} />
            </button>
            
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={selectedImage} 
              alt="Imagem ampliada" 
              className="max-w-full max-h-[calc(100dvh-5.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))] rounded-lg shadow-2xl object-scale-down"
            />
          </div>
        </div>
      )}
    </>
  );
}
