import React from 'react';
import { ReceiptText } from 'lucide-react';

interface ModalConfirmacionVentaProps {
  mostrar: boolean;
  guardando: boolean;
  presionado: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ModalConfirmacionVenta({
  mostrar,
  guardando,
  presionado,
  onConfirm,
  onCancel,
}: ModalConfirmacionVentaProps) {
  if (!mostrar) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[420px] rounded-[24px] bg-white p-6 text-center shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
        <div className="mx-auto h-2 w-16 rounded-full bg-[#d7deeb]" />
        <div className="mx-auto mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#e7f1ff] text-[#1f3fa7]">
          <ReceiptText size={24} />
        </div>
        <h2 className="mt-5 text-[1.8rem] font-black leading-tight text-slate-950">
          Confirmar venta
        </h2>
        <p className="mt-3 text-base leading-6 text-slate-500">
          Se registrará esta venta y se descontará del inventario.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={guardando || presionado}
            className="inline-flex min-h-[54px] items-center justify-center rounded-[14px] border border-[#d5deee] bg-white px-5 text-base font-black text-[#334b85] transition hover:bg-[#f4f7ff] disabled:cursor-not-allowed disabled:opacity-70"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={guardando || presionado}
            className="inline-flex min-h-[54px] items-center justify-center rounded-[14px] bg-[#1f3fa7] px-5 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {guardando || presionado ? 'Guardando venta...' : 'Confirmar venta'}
          </button>
        </div>
      </div>
    </div>
  );
}
