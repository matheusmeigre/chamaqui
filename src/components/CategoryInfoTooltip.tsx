"use client";

import { useState, useRef, useEffect } from "react";
import { HelpCircle } from "lucide-react";

const CATEGORY_INFO: Record<string, string> = {
  "Acesso":
    "Dificuldades com senhas, permissões, login ou controle de acesso a sistemas e ferramentas.",
  "Aplicação":
    "Erros ou falhas em aplicações web (frontend e/ou backend), APIs, formulários ou funcionalidades de sistemas internos.",
  "Hardware":
    "Problemas com equipamentos físicos como computadores, impressoras, monitores, teclados, mouses etc.",
  "Infraestrutura":
    "Falhas em servidores, data centers, fornecimento de energia ou estrutura física de TI.",
  "Outros":
    "Demandas que não se enquadram nas categorias listadas acima.",
  "Rede":
    "Problemas de conectividade, internet, Wi-Fi, VPN ou acesso à rede corporativa.",
  "Software":
    "Erros, falhas ou dúvidas em programas instalados, licenças ou configurações de software.",
};

export function CategoryInfoTooltip() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ml-1.5 align-middle text-ink-3 transition hover:text-brand"
        aria-label="Informações sobre categorias"
      >
        <HelpCircle size={16} />
      </button>

      {open && (
        <div className="animate-fade absolute left-0 top-6 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface p-4 text-sm shadow-float">
          <p className="mb-3 font-semibold text-ink">Guia de Categorias</p>
          <ul className="space-y-2">
            {Object.entries(CATEGORY_INFO).map(([cat, desc]) => (
              <li key={cat}>
                <span className="font-medium text-ink">{cat}:</span>{" "}
                <span className="text-ink-3">{desc}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
