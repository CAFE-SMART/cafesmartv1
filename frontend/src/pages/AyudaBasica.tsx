import React, { useState } from 'react';
import { ArrowLeft, ChevronDown, HelpCircle, ScanSearch } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppBottomNav } from '../components/AppBottomNav';
import { COFFEE_CODE_GLOSSARY } from '../utils/coffeeCodes';

const helpItems = [
  {
    title: 'No puedo guardar una compra',
    description:
      'Revisa conexión, campos obligatorios y espacio en bodega. Luego toca Reintentar.',
  },
  {
    title: 'Los datos no se actualizan',
    description:
      'Vuelve al inicio y toca Recargar. Tus registros guardados permanecen seguros.',
  },
  {
    title: 'No veo una opción',
    description:
      'Cierra y vuelve a abrir la pantalla. Si sigue igual, reporta el problema desde Soporte.',
  },
  {
    title: 'No encuentro un sublote',
    description:
      'Verifica el tipo de café, la calidad y si el sublote ya fue usado en venta o secado.',
  },
] as const;

export default function AyudaBasica() {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="min-h-screen bg-[#f4f6fb] px-4 pb-[150px] pt-5 text-slate-950">
      <main className="mx-auto w-full max-w-[430px]">
        <header className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/soporte')}
            aria-label="Volver a soporte"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d9e1f0] bg-white text-[#2448bd]"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5570a8]">
              Soporte
            </p>
            <h1 className="truncate text-[1.35rem] font-black text-slate-950">
              Ayuda básica
            </h1>
          </div>
          <span className="h-11 w-11" aria-hidden="true" />
        </header>

        <section className="mt-4 rounded-[18px] border border-[#dbe5ff] bg-white px-4 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-[13px] bg-[#eaf2ff] text-[#102d92]">
              <HelpCircle size={18} />
            </span>
            <div>
              <h2 className="text-base font-black text-slate-950">
                Guía rápida
              </h2>
              <p className="text-xs font-semibold leading-5 text-slate-500">
                Resuelve dudas comunes sin salir del flujo de Ajustes.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-4 space-y-2">
          {helpItems.map((item, index) => {
            const open = openIndex === index;
            return (
              <article
                key={item.title}
                className="overflow-hidden rounded-[16px] border border-[#dfe6f4] bg-white shadow-sm transition"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(open ? null : index)}
                  className="flex min-h-[54px] w-full items-center justify-between gap-3 px-4 py-3 text-left"
                  aria-expanded={open}
                >
                  <span className="text-sm font-black text-slate-950">
                    {item.title}
                  </span>
                  <ChevronDown
                    size={17}
                    className={`shrink-0 text-[#2448bd] transition-transform duration-200 ${
                      open ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <div
                  className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                    open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="border-t border-[#eef2fb] px-4 py-3 text-sm font-semibold leading-6 text-slate-600">
                      {item.description}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </section>

        <section className="mt-4 rounded-[18px] border border-[#dbe5ff] bg-white px-4 py-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#5570a8]">
                Términos cafeteros
              </p>
              <h2 className="mt-1 text-base font-black text-slate-950">
                Códigos de café
              </h2>
            </div>
            <span className="inline-flex rounded-[12px] bg-[#eaf2ff] p-2 text-[#102d92]">
              <ScanSearch size={15} />
            </span>
          </div>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
            Estos códigos ayudan a identificar rápidamente el tipo y calidad del café.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {COFFEE_CODE_GLOSSARY.map((item) => (
              <div
                key={item.code}
                className="flex min-h-[34px] items-center gap-2 rounded-[11px] border border-[#eef2fb] bg-[#f8faff] px-2.5 py-1.5"
              >
                <span className="inline-flex min-w-10 justify-center rounded-[8px] border border-[#c7d8ff] bg-white px-2 py-1 text-[0.66rem] font-black text-[#102d92]">
                  {item.code}
                </span>
                <span className="text-xs font-bold text-slate-700">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
      <AppBottomNav activePath="/ajustes" />
    </div>
  );
}
