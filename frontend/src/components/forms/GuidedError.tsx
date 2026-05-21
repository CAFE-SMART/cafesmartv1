import { X } from 'lucide-react';
import { AppFeedbackMessage } from '../AppFeedbackMessage';

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
  autoClose?: boolean;
  duration?: number;
  onClose?: () => void;
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

export function InlineGuidedError({
  id,
  message,
  className = '',
  autoClose = true,
  duration,
  onClose,
}: InlineGuidedErrorProps) {
  const fallbackMessage = message as GuidedErrorMessage & { text?: string };
  const guidance = message.action || message.how || fallbackMessage.text;

  return (
    <AppFeedbackMessage
      id={id}
      variant="error"
      title={message.why}
      description={guidance}
      className={`mt-1.5 ${className}`.trim()}
      autoClose={autoClose}
      duration={duration}
      onClose={onClose}
    />
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
    <div
      className="fixed inset-x-0 bottom-20 z-50 px-4"
      role="status"
      aria-live="polite"
    >
      <AppFeedbackMessage
        variant="error"
        title={message.why}
        description={guidance}
        className="mx-auto max-w-[340px] bg-white"
        action={
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar aviso"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-white hover:text-slate-800"
          >
            <X size={14} />
          </button>
        }
      >
        <div className="flex flex-wrap gap-2">
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
            className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-[0.68rem] font-semibold text-rose-800 transition hover:border-rose-300"
          >
            Cerrar
          </button>
        </div>
      </AppFeedbackMessage>
    </div>
  );
}
