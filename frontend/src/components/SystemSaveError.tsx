import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Home,
  LifeBuoy,
  RefreshCcw,
  Send,
  X,
} from 'lucide-react';
import API_URL from '../config/api';

const SUPPORT_MESSAGE_MAX_LENGTH = 300;

type SystemSaveErrorProps = {
  operation: string;
  error: unknown;
  onRetry: () => void;
  onHome: () => void;
  retrying?: boolean;
  className?: string;
};

function errorToTechnical(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      status: (error as { status?: unknown }).status,
      field: (error as { field?: unknown }).field,
    };
  }

  return { value: String(error ?? 'Unknown error') };
}

async function sendSupportReport(report: Record<string, unknown>) {
  try {
    const response = await fetch(
      `${API_URL.replace(/\/$/, '')}/support/error-report`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      },
    );

    if (!response.ok) {
      throw new Error('Support report failed');
    }
  } catch {
    // No guardamos reportes localmente: los datos operativos deben vivir en backend.
  }
}

export function SystemSaveError({
  operation,
  error,
  onRetry,
  onHome,
  retrying = false,
  className = '',
}: SystemSaveErrorProps) {
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportText, setSupportText] = useState('');
  const [supportSent, setSupportSent] = useState(false);
  const reportId = useMemo(
    () => `CS-${Date.now().toString(36).toUpperCase()}`,
    [],
  );

  const submitSupport = async () => {
    await sendSupportReport({
      reportId,
      operation,
      userMessage: supportText.trim(),
      createdAt: new Date().toISOString(),
      technical: errorToTechnical(error),
      location:
        typeof window !== 'undefined' ? window.location.pathname : undefined,
    });
    setSupportSent(true);
  };

  return (
    <>
      <section
        role="alert"
        className={`rounded-[26px] border border-[#f0d6da] bg-white p-5 text-center shadow-[0_18px_48px_rgba(15,23,42,0.08)] ${className}`.trim()}
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#fff0f2] text-[#d1495b]">
          <AlertTriangle size={28} strokeWidth={2.6} />
        </div>
        <h2 className="mt-4 text-[1.55rem] font-black leading-tight text-[#1f2937]">
          No pudimos guardar la información
        </h2>
        <p className="mx-auto mt-2 max-w-[340px] text-base leading-6 text-slate-600">
          Puede ser un problema temporal o de conexión. Tus datos siguen en
          pantalla para que no tengas que escribirlos otra vez.
        </p>

        <div className="mt-5 grid gap-2">
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full bg-[#1D4ED8] px-4 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCcw size={16} className={retrying ? 'animate-spin' : ''} />
            {retrying ? 'Reintentando...' : 'Reintentar'}
          </button>
          <button
            type="button"
            onClick={onHome}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] border border-[#d9deeb] bg-[#f8faff] px-4 text-base font-semibold text-[#1D4ED8]"
          >
            <Home size={16} />
            Volver al inicio
          </button>
          <button
            type="button"
            onClick={() => setSupportOpen(true)}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[16px] px-4 text-base font-semibold text-slate-600"
          >
            <LifeBuoy size={16} />
            Contactar soporte
          </button>
        </div>
      </section>

      {supportOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-[24px] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.24)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase text-[#1D4ED8]">
                  Soporte
                </p>
                <h3 className="mt-1 text-[1.25rem] font-black text-slate-900">
                  Cuéntanos qué estabas haciendo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSupportOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                aria-label="Cerrar soporte"
              >
                <X size={16} />
              </button>
            </div>

            {supportSent ? (
              <div className="mt-5 rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-base leading-6 text-emerald-700">
                Gracias. Registramos tu mensaje y adjuntamos la información
                necesaria para revisar el problema.
              </div>
            ) : (
              <>
                <p className="mt-3 text-base leading-6 text-slate-600">
                  Cuéntanos la acción exacta, el dato que estabas guardando y si
                  ya intentaste reintentar. Adjuntaremos el contexto técnico del
                  error automáticamente.
                </p>
                <textarea
                  value={supportText}
                  maxLength={SUPPORT_MESSAGE_MAX_LENGTH}
                  onChange={(event) =>
                    setSupportText(
                      event.target.value.slice(0, SUPPORT_MESSAGE_MAX_LENGTH),
                    )
                  }
                  rows={4}
                  className="mt-4 w-full rounded-[16px] border border-[#dfe5f2] bg-[#f8faff] px-4 py-3 text-base text-slate-900 outline-none focus:border-[#1D4ED8]"
                  placeholder="Ej. Guardaba una compra de 125 kg para Juan Perez y falló al confirmar."
                />
                <p className="mt-1 text-right text-xs font-semibold text-slate-400">
                  {supportText.length}/{SUPPORT_MESSAGE_MAX_LENGTH}
                </p>
                <button
                  type="button"
                  onClick={() => void submitSupport()}
                  className="mt-4 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-full bg-[#1D4ED8] px-4 text-base font-black text-white"
                >
                  <Send size={15} />
                  Enviar a soporte
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
