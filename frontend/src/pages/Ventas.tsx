import React from 'react';
import { ArrowRight, Banknote, Clock3, FileText, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppBottomNav } from '../components/AppBottomNav';
import { CloudStatusBadge } from '../components/CloudStatusBadge';

export default function Ventas() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] px-4 py-5 pb-[145px] text-slate-900">
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-4">
        <header className="rounded-[22px] border border-white/80 bg-white/90 px-4 py-4 shadow-[0_14px_30px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-[#eef2ff] p-3 text-[#102d92]">
                <Banknote size={18} />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Cafe Smart
                </p>
                <h1 className="mt-1 text-[1.35rem] font-black leading-tight text-[#102d92]">
                  Ventas
                </h1>
                <p className="mt-1 text-sm text-slate-600">
                  Modulo visual listo para conectar backend de ventas.
                </p>
              </div>
            </div>
            <CloudStatusBadge compact className="max-w-[190px]" />
          </div>
        </header>

        <section className="rounded-[22px] border border-[#d8e4ff] bg-[#eef3ff] p-4 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#5b6f9d]">
            Estado
          </p>
          <h2 className="mt-2 text-[1.2rem] font-black text-[#102d92]">
            Flujo de venta en preparacion
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Ya puedes navegar por esta pantalla. Cuando bajemos la rama de ventas, conectamos
            pasos y guardado real sin romper compras e inventario.
          </p>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <article className="rounded-[18px] border border-[#e6e8f3] bg-white p-4 shadow-sm">
            <div className="inline-flex rounded-xl bg-[#eef2ff] p-2 text-[#102d92]">
              <FileText size={16} />
            </div>
            <p className="mt-3 text-sm font-black text-slate-900">Registro de venta</p>
            <p className="mt-1 text-xs text-slate-500">Paso a paso con resumen final.</p>
          </article>
          <article className="rounded-[18px] border border-[#e6e8f3] bg-white p-4 shadow-sm">
            <div className="inline-flex rounded-xl bg-[#e9fbf4] p-2 text-[#0d7b67]">
              <Wallet size={16} />
            </div>
            <p className="mt-3 text-sm font-black text-slate-900">Totales</p>
            <p className="mt-1 text-xs text-slate-500">Calculo rapido por kg y precio.</p>
          </article>
        </section>

        <section className="rounded-[20px] border border-[#e6e8f3] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-sm font-black text-slate-900">
              <Clock3 size={15} className="text-slate-500" />
              Siguiente integracion
            </p>
            <span className="rounded-full bg-[#eef1ff] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#102d92]">
              Pendiente
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Sincronizar backend de ventas y conectar formulario de seleccion de sublotes.
          </p>

          <button
            type="button"
            onClick={() => navigate('/inventario')}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[16px] bg-[#102d92] px-4 py-3 text-sm font-black text-white shadow-[0_12px_28px_rgba(16,45,146,0.2)]"
          >
            Ir a inventario por ahora
            <ArrowRight size={16} />
          </button>
        </section>
      </div>

      <AppBottomNav />
    </div>
  );
}

