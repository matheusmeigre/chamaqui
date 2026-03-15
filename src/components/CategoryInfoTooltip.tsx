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
        className="text-slate-400 hover:text-blue-500 transition ml-1.5 align-middle"
        aria-label="Informações sobre categorias"
      >
        <HelpCircle size={16} />
      </button>

      {open && (
        <div className="absolute left-0 top-6 z-50 w-80 rounded-xl border border-slate-200 bg-white shadow-lg p-4 text-sm">
          <p className="font-semibold text-slate-700 mb-3">Guia de Categorias</p>
          <ul className="space-y-2">
            {Object.entries(CATEGORY_INFO).map(([cat, desc]) => (
              <li key={cat}>
                <span className="font-medium text-slate-800">{cat}:</span>{" "}
                <span className="text-slate-500">{desc}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
