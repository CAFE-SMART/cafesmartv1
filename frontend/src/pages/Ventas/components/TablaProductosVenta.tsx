import React from 'react';
import { AlertTriangle } from 'lucide-react';

export interface TablaProductoItem {
  id: string;
  codigo: string;
  tipoCafe: string;
  calidad: string;
  cantidadKg: number;
  subtotal: number;
}

interface TablaProductosVentaProps {
  items: TablaProductoItem[];
  totalKg: number;
  totalEstimado: number;
  vacioMessage?: string;
}

const kg = (v: number) =>
  `${v.toLocaleString('es-CO', { maximumFractionDigits: 2 })} kg`;
const money = (v: number) =>
  `$${v.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

export function TablaProductosVenta({
  items,
  totalKg,
  totalEstimado,
  vacioMessage = 'Sin productos agregados',
}: TablaProductosVentaProps) {
  if (items.length === 0) {
    return (
      <article className="rounded-[18px] border border-dashed border-[#d7dcec] bg-[#fafbff] px-4 py-8 text-center text-sm text-slate-500">
        <AlertTriangle size={32} className="mx-auto text-slate-300 mb-2" />
        <p className="font-bold text-slate-800">{vacioMessage}</p>
      </article>
    );
  }

  return (
    <article className="rounded-[18px] border border-[#e2e8f4] bg-[#fbfcff] p-4">
      <p className="text-[0.72rem] font-black uppercase tracking-[0.12em] text-slate-500">
        Productos a vender
      </p>
      <div className="mt-3 divide-y divide-slate-100">
        {items.map((item) => (
          <div key={item.id} className="flex items-start justify-between py-3">
            <div className="min-w-0">
              <p className="font-black text-slate-950">{item.tipoCafe}</p>
              <p className="text-xs font-semibold text-slate-500">{item.calidad}</p>
              <p className="text-xs font-semibold text-slate-400">{item.codigo}</p>
            </div>
            <div className="text-right">
              <p className="font-black text-slate-950">{kg(item.cantidadKg)}</p>
              <p className="text-sm font-bold text-[#173ea6]">{money(item.subtotal)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-[12px] bg-[#eef4ff] p-3">
        <div className="flex items-center justify-between text-sm font-black text-[#102d92]">
          <span>Total</span>
          <span>{kg(totalKg)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-lg font-black text-[#173ea6]">
          <span>Total a recibir</span>
          <span>{money(totalEstimado)}</span>
        </div>
      </div>
    </article>
  );
}
