"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface SearchItem {
  title: string;
  category: "Servicios" | "Vestuario" | "Productos" | "Blog" | "Páginas" | "Ubicación";
  href: string;
  desc: string;
}

const SEARCH_ITEMS: SearchItem[] = [
  { title: "Corte de Cabello Premium", category: "Servicios", href: "/servicios", desc: "Asesoría y corte personalizado con lavado y peinado" },
  { title: "Perfilado y Afeitado de Barba", category: "Servicios", href: "/servicios", desc: "Ritual clásico con toallas calientes y aceites esenciales" },
  { title: "Tratamiento Facial y Spa", category: "Servicios", href: "/servicios", desc: "Limpieza profunda, exfoliación e hidratación" },
  { title: "Masajes Relajantes", category: "Servicios", href: "/servicios", desc: "Terapia descontracturante y relajación muscular" },
  { title: "Trajes y Ternas Exclusivos", category: "Vestuario", href: "/vestuario", desc: "Alquiler y venta de trajes de alta costura para eventos" },
  { title: "Camisas y Accesorios", category: "Vestuario", href: "/vestuario", desc: "Complementos de vestir masculinos y calzado elegante" },
  { title: "Pomadas y Ceras para Barba", category: "Productos", href: "/tienda", desc: "Fijación y brillo natural de calidad profesional" },
  { title: "Shampoo y Tónicos Capilares", category: "Productos", href: "/tienda", desc: "Cuidado capilar anticaída y fortalecedor" },
  { title: "Blog y Consejos de Estilo", category: "Blog", href: "/blog", desc: "Guías de cuidado masculino, tendencias y estilo" },
  { title: "Nuestra Ubicación y Horarios", category: "Ubicación", href: "/ubicacion", desc: "Visítanos en nuestra sede principal" },
  { title: "Reservar Cita Online", category: "Páginas", href: "/reservar", desc: "Agenda tu turno con tu especialista favorito" },
];

export function NavSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      document.body.style.overflow = "";
      setQuery("");
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Keyboard shortcut Ctrl+K or Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const filteredItems = query.trim()
    ? SEARCH_ITEMS.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.category.toLowerCase().includes(query.toLowerCase()) ||
          item.desc.toLowerCase().includes(query.toLowerCase())
      )
    : SEARCH_ITEMS.slice(0, 6);

  return (
    <>
      {/* Search Icon Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-lg text-gray-300 hover:text-[#C8A45C] hover:bg-[#C8A45C]/10 transition-all duration-200 cursor-pointer flex items-center justify-center"
        title="Buscar servicios, productos o páginas (Ctrl+K)"
        aria-label="Buscar"
      >
        <svg
          className="w-5 h-5 text-gray-300 hover:text-[#C8A45C] transition-colors"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </button>

      {/* Search Modal Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-start justify-center pt-20 px-4 animate-fadeIn"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-[#111111] border border-[#C8A45C]/40 rounded-2xl shadow-[0_15px_50px_rgba(0,0,0,0.9)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input Header */}
            <div className="flex items-center px-4 py-3.5 border-b border-[#C8A45C]/25 bg-black/50">
              <svg
                className="w-5 h-5 text-[#C8A45C] mr-3 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar servicios, trajes, productos, blog..."
                className="w-full bg-transparent text-gray-100 placeholder-gray-500 focus:outline-none text-base"
              />
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-xs px-2 py-1 bg-zinc-800 text-gray-400 rounded-md hover:bg-zinc-700 hover:text-white transition-colors ml-2"
              >
                ESC
              </button>
            </div>

            {/* Results List */}
            <div className="max-h-80 overflow-y-auto p-2 divide-y divide-zinc-900/50">
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <Link
                    key={item.title}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-[#C8A45C]/10 transition-colors group"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-200 group-hover:text-[#C8A45C] transition-colors">
                        {item.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                        {item.desc}
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold text-[#C8A45C] bg-[#C8A45C]/10 border border-[#C8A45C]/20 px-2 py-0.5 rounded-full shrink-0 ml-3">
                      {item.category}
                    </span>
                  </Link>
                ))
              ) : (
                <div className="p-8 text-center text-gray-400">
                  <p className="text-sm">No encontramos resultados para &quot;{query}&quot;</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Prueba buscando por corte, barba, trajes, reserva o tienda.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 bg-black/40 border-t border-[#C8A45C]/15 text-center flex justify-between items-center text-xs text-gray-400">
              <span>Acicalados Spa &amp; Barber Shop</span>
              <span className="text-[#C8A45C]">Diseño &amp; Calidad</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
