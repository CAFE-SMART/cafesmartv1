import { AlertCircle, X } from 'lucide-react';

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

export function createGuidedErrorFromUi(uiMessage: {
  titulo: string;
  mensaje: string;
  accion?: string;
}): GuidedErrorMessage {
  return {
    what: uiMessage.titulo,
    why: uiMessage.mensaje,
    how: uiMessage.accion ?? '',
    action: uiMessage.accion ?? '',
  };
}

export function InlineGuidedError({
  id,
  message,
  className = '',
}: InlineGuidedErrorProps) {
  const guidance = message.action || message.how;

  return (
    <div
      id={id}
      role="alert"
      className={`rounded-[8px] border border-rose-200 bg-rose-50 px-3 py-2 text-[0.68rem] text-rose-800 shadow-sm ${className}`.trim()}
    >
      <div className="flex items-start gap-2">
        <AlertCircle size={14} className="mt-0.5 shrink-0 text-rose-600" />
        <div className="leading-snug">
          {message.why ? <p className="font-bold">{message.why}</p> : null}
          {guidance ? <p className="mt-0.5 text-rose-700">{guidance}</p> : null}
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
  const guidance = message.action || message.how;

  return (
    <div className="fixed inset-x-0 bottom-20 z-50 px-4">
      <div className="mx-auto w-full max-w-[340px] rounded-[12px] border border-rose-200 bg-white shadow-[0_12px_30px_rgba(15,23,42,0.14)]">
        <div className="flex items-start gap-2.5 p-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <AlertCircle size={15} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[0.72rem] leading-snug text-slate-700">
              {message.why ? <p className="font-bold">{message.why}</p> : null}
              {guidance ? (
                <p className="mt-0.5 text-rose-700">{guidance}</p>
              ) : null}
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {onPrimaryAction ? (
                <button
                  type="button"
                  onClick={onPrimaryAction}
                  className="rounded-full bg-rose-600 px-3 py-1.5 text-[0.68rem] font-bold text-white transition hover:bg-rose-700"
                >
                  {primaryLabel}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-[0.68rem] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
              >
                Cerrar
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar aviso"
            className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
