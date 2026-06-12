import React, { useMemo, useState } from 'react';
import { LifeBuoy, Send, X } from 'lucide-react';
import API_URL from '../config/api';
import { AppFeedbackMessage } from './AppFeedbackMessage';
import { CafeSmartErrorState } from './CafeSmartErrorState';

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
    // Si el envio falla, la persona puede volver a intentar desde la ventana.
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
      <CafeSmartErrorState
        title="No pudimos guardar la información"
        message="Revisa tu conexión a internet e intenta nuevamente."
        info="Tus datos siguen en pantalla para que no tengas que escribirlos otra vez."
        onPrimary={onRetry}
        onSecondary={onHome}
        primaryBusy={retrying}
        className={className}
        extraAction={
          <button
            type="button"
            onClick={() => setSupportOpen(true)}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[16px] px-4 text-sm font-black text-slate-600 transition hover:bg-white/70 hover:text-[#1e3a8a] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1d4ed8]/18 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-blue-200"
          >
            <LifeBuoy size={16} aria-hidden="true" />
            Contactar soporte
          </button>
        }
      />

      {supportOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[420px] rounded-[24px] border border-slate-200 bg-white p-5 text-slate-900 shadow-[0_24px_60px_rgba(15,23,42,0.24)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase text-[#102d92] dark:text-blue-200">
                  Soporte
                </p>
                <h3 className="mt-1 text-[1.25rem] font-black text-slate-900 dark:text-slate-100">
                  Cuéntanos qué estabas haciendo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSupportOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500 transition hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/40 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white"
                aria-label="Cerrar soporte"
              >
                <X size={16} />
              </button>
            </div>

            {supportSent ? (
              <AppFeedbackMessage
                variant="success"
                description="Gracias. Registramos tu mensaje y adjuntamos lo necesario para revisar el problema."
                className="mt-5"
              />
            ) : (
              <>
                <p className="mt-3 text-base leading-6 text-slate-600 dark:text-slate-300">
                  Escribe una frase breve. Enviaremos lo necesario para poder
                  ayudarte sin interrumpir tu trabajo.
                </p>
                <textarea
                  value={supportText}
                  onChange={(event) => setSupportText(event.target.value)}
                  rows={4}
                  className="mt-4 w-full rounded-[16px] border border-[#dfe5f2] bg-[#f8faff] px-4 py-3 text-base text-slate-900 outline-none placeholder:text-slate-500 focus:border-[#102d92] dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-blue-400"
                  placeholder="Ej. Estaba registrando una compra y no pude guardarla."
                />
                <button
                  type="button"
                  onClick={() => void submitSupport()}
                  className="mt-4 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[16px] bg-[#102d92] px-4 text-base font-black text-white"
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
