import React from 'react';
import { ReceiptText } from 'lucide-react';
import {
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../styles/uiClasses';

interface ModalConfirmacionVentaProps {
  mostrar: boolean;
  guardando: boolean;
  presionado: boolean;
  offline?: boolean;
  fifoNotice?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ModalConfirmacionVenta({
  mostrar,
  guardando,
  presionado,
  offline = false,
  fifoNotice,
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
          {offline ? 'Guardar venta pendiente' : 'Confirmar venta'}
        </h2>
        <p className="mt-3 text-base leading-6 text-slate-500">
          {offline
            ? 'Se guardará en este dispositivo y se validará al sincronizar.'
            : 'Se registrará esta venta y se descontará del inventario.'}
        </p>
        {fifoNotice ? (
          <p className="mt-4 rounded-[14px] border border-[#cfe0ff] bg-[#f4f8ff] px-4 py-3 text-sm font-black leading-5 text-[#102d92]">
            {fifoNotice}
          </p>
        ) : null}

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={guardando || presionado}
            className={`${secondaryButtonClass} min-h-[54px] rounded-[14px] text-base`}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={guardando || presionado}
            className={`${primaryButtonClass} min-h-[54px] rounded-[14px] text-base`}
          >
            {guardando || presionado
              ? 'Guardando venta...'
              : offline
                ? 'Guardar pendiente'
                : 'Confirmar venta'}
          </button>
        </div>
      </div>
    </div>
  );
}
