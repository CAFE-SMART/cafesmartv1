import React from 'react';
import { X } from 'lucide-react';
import { InlineGuidedError } from '../../../components/forms/GuidedError';
import {
  fieldHelpTextClass,
  fieldInputClass,
  fieldLabelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../styles/uiClasses';

export interface ClienteFormData {
  nombre: string;
  telefono: string;
  documento: string;
  tipoDocumento: 'CEDULA' | 'NIT' | '';
}

export interface ClienteFormErrors {
  nombre?: string;
  telefono?: string;
  documento?: string;
  tipoDocumento?: string;
}

interface FormularioClienteProps {
  form: ClienteFormData;
  errors: ClienteFormErrors;
  generalError: string | null;
  editando: boolean;
  onFormChange: (field: keyof ClienteFormData, value: string) => void;
  onGuardar: () => void;
  onCerrar: () => void;
}

const MAX_NOMBRE_CARACTERES = 60;
const DOCUMENT_TYPE_OPTIONS: Array<{ value: 'CEDULA' | 'NIT'; label: string }> = [
  { value: 'CEDULA', label: 'Cédula' },
  { value: 'NIT', label: 'NIT' },
];

export function FormularioCliente({
  form,
  errors,
  generalError,
  editando,
  onFormChange,
  onGuardar,
  onCerrar,
}: FormularioClienteProps) {
  return (
    <div className="fixed inset-0 z-50 flex h-[100dvh] items-end justify-center overflow-y-auto bg-slate-900/55 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-sm sm:items-center sm:px-5 sm:py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCerrar();
        }
      }}
    >
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_28px_70px_rgba(15,23,42,0.28)] sm:max-h-[min(88dvh,720px)]">
        <header className="shrink-0 border-b border-slate-100 px-5 pb-4 pt-3">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-[#cfd8e6]" />
          <div className="mt-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[1.35rem] font-semibold leading-tight text-[#111827]">
                {editando ? 'Editar cliente' : 'Registrar cliente'}
              </h2>
              <p className="mt-1 text-sm font-medium leading-5 text-slate-500">
                {editando
                  ? 'Actualiza los datos del cliente.'
                  : 'Completa los datos básicos para usarlo en esta venta.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar registro de cliente"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          <div className="flex flex-col gap-5 pb-6">
            {generalError && (
              <InlineGuidedError message={{ text: generalError } as any} className="mb-2" />
            )}

            {/* Tipo de Documento */}
            <div className="order-1">
              <label className={fieldLabelClass}>
                Tipo de documento
              </label>
              <div className="grid grid-cols-2 gap-2">
                {DOCUMENT_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onFormChange('tipoDocumento', option.value)}
                    className={`rounded-[12px] border px-4 py-2.5 text-sm font-black transition ${
                      form.tipoDocumento === option.value
                        ? 'border-[#1f3fa7] bg-[#eef4ff] text-[#1f3fa7]'
                        : 'border-[#dbe2f0] bg-white text-slate-700 hover:border-[#cad2e2]'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              {errors.tipoDocumento && (
                <p className="mt-1 text-xs font-semibold text-red-600">{errors.tipoDocumento}</p>
              )}
            </div>

            {/* Nombre */}
            <div className="order-2">
              <label className={fieldLabelClass}>
                {form.tipoDocumento === 'NIT' ? 'Nombre de la empresa' : 'Nombre completo'}
                <span
                  className={`ml-2 inline-flex text-[0.72rem] font-black ${
                    form.nombre.trim().length >= MAX_NOMBRE_CARACTERES
                      ? 'text-amber-700'
                      : 'text-slate-500'
                  }`}
                >
                  {form.nombre.trim().length}/{MAX_NOMBRE_CARACTERES}
                </span>
              </label>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => onFormChange('nombre', e.target.value)}
                placeholder="Ej. Juan Pérez"
                maxLength={MAX_NOMBRE_CARACTERES}
                className={`${fieldInputClass} rounded-[12px] px-4 py-3 ${
                  errors.nombre ? 'border-red-500' : ''
                }`}
              />
              {errors.nombre && (
                <p className="mt-1 text-xs font-semibold text-red-600">{errors.nombre}</p>
              )}
            </div>

            {/* Documento */}
            <div className="order-3">
              <label className={fieldLabelClass}>
                Número de documento
              </label>
              <input
                type="text"
                value={form.documento}
                onChange={(e) => onFormChange('documento', e.target.value)}
                placeholder="Ej. 1234567890"
                className={`${fieldInputClass} rounded-[12px] px-4 py-3 ${
                  errors.documento ? 'border-red-500' : ''
                }`}
              />
              {errors.documento && (
                <p className="mt-1 text-xs font-semibold text-red-600">{errors.documento}</p>
              )}
            </div>

            {/* Teléfono */}
            <div className="order-4">
              <label className={fieldLabelClass}>
                Teléfono <span className={fieldHelpTextClass}>(opcional)</span>
              </label>
              <input
                type="tel"
                value={form.telefono}
                onChange={(e) => onFormChange('telefono', e.target.value)}
                placeholder="Ej. 3001234567"
                className={`${fieldInputClass} rounded-[12px] px-4 py-3 ${
                  errors.telefono ? 'border-red-500' : ''
                }`}
              />
              {errors.telefono && (
                <p className="mt-1 text-xs font-semibold text-red-600">{errors.telefono}</p>
              )}
            </div>
          </div>
        </div>

        <footer className="shrink-0 border-t border-slate-100 px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onCerrar}
              className={`${secondaryButtonClass} min-h-[48px] rounded-[14px] text-sm`}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onGuardar}
              className={`${primaryButtonClass} min-h-[48px] rounded-[14px] text-sm`}
            >
              {editando ? 'Guardar cambios' : 'Registrar cliente'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
