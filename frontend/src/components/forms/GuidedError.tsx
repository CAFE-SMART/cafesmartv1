import { AlertCircle, X } from 'lucide-react';
import type { MensajeUI } from '../../utils/uiMessages';

export type GuidedErrorMessage = {
  what: string;
  why: string;
  how: string;
  action: string;
};

type InlineGuidedErrorProps = {
  id?: string;
  message: GuidedErrorMessage;
  className?: string;
};

type FloatingGuidedNoticeProps = {
  message: GuidedErrorMessage;
  primaryLabel?: string;
  onPrimaryAction?: () => void;
  onClose: () => void;
};

export function createGuidedError(
  what: string,
  why: string,
  how: string,
  action: string,
): GuidedErrorMessage {
  return { what, why, how, action };
}

export function createGuidedErrorFromUi(message: MensajeUI): GuidedErrorMessage {
  return createGuidedError(
    message.mensaje,
    message.titulo,
    message.mensaje,
    message.accion ?? 'Intenta nuevamente',
  );
}

export function InlineGuidedError({
  id,
  message,
  className = '',
}: InlineGuidedErrorProps) {
  return (
    <div
      id={id}
      role="alert"
      className={`rounded-[12px] border border-rose-200 bg-rose-50 px-4 py-3 text-base text-rose-800 shadow-sm ${className}`.trim()}
    >
      <div className="flex items-start gap-3">
        <AlertCircle size={18} className="mt-0.5 shrink-0 text-rose-600" />
        <div className="space-y-0.5 leading-snug">
          <p className="font-bold">{message.why}</p>
          <p>{message.how} <span className="font-medium text-rose-700">{message.action}</span></p>
        </div>
      </div>
    </div>
  );
}

export function FloatingGuidedNotice({
  message,
  primaryLabel = 'Revisar ahora',
  onPrimaryAction,
  onClose,
}: FloatingGuidedNoticeProps) {
  return (
    <div className="fixed inset-x-0 bottom-4 z-50 px-4">
      <div className="mx-auto w-full max-w-[520px] rounded-[24px] border border-rose-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.16)]">
        <div className="flex items-start gap-3 p-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <AlertCircle size={20} />
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-sm font-black uppercase text-rose-600">
              Revision necesaria
            </p>

            <div className="space-y-0.5 text-base leading-snug text-slate-700">
              <p className="font-bold">{message.why}</p>
              <p>{message.how} <span className="font-medium text-rose-700">{message.action}</span></p>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {onPrimaryAction ? (
                <button
                  type="button"
                  onClick={onPrimaryAction}
                  className="rounded-full bg-rose-600 px-4 py-2 text-base font-bold text-white transition hover:bg-rose-700"
                >
                  {primaryLabel}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-slate-200 px-4 py-2 text-base font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                Cerrar
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar aviso"
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
