"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface ImageGalleryProps {
  urls: string[];
}

export function ImageGallery({ urls }: ImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Fecha a imagem ao apertar Esc
  if (selectedImage) {
    window.onkeydown = (e) => {
      if (e.key === 'Escape') setSelectedImage(null);
    };
  }

  return (
    <>
      <div className="flex flex-wrap gap-4">
        {urls.map((url, i) => (
          <button 
            key={i} 
            type="button"
            onClick={() => setSelectedImage(url)} 
            className="block border border-slate-200 rounded-lg overflow-hidden hover:border-blue-500 transition focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Anexo ${i + 1}`} className="w-32 h-32 object-cover" />
          </button>
        ))}
      </div>

      {selectedImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm transition-opacity" 
          onClick={() => setSelectedImage(null)}
        >
          <div 
            className="relative max-w-[90vw] max-h-[90vh] flex items-center justify-center animate-in mb-8" 
            onClick={(e) => e.stopPropagation()} // Impede que clicar na imagem em si feche o modal
          >
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 right-0 p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-full transition"
            >
              <X size={28} />
            </button>
            
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={selectedImage} 
              alt="Imagem ampliada" 
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-scale-down" 
            />
          </div>
        </div>
      )}
    </>
  );
}
