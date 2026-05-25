import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { themeClasses } from '../../theme/themeClasses';

type CafeSmartModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  labelledById: string;
  className?: string;
};

export function CafeSmartModal({
  open,
  title,
  description,
  children,
  onClose,
  labelledById,
  className = '',
}: CafeSmartModalProps) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    dialog?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] px-4 py-6">
      <button
        type="button"
        aria-label="Cerrar"
        className={`absolute inset-0 ${themeClasses.overlay}`}
        onClick={onClose}
      />
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledById}
        aria-describedby={description ? `${labelledById}-description` : undefined}
        tabIndex={-1}
        className={`relative mx-auto flex max-h-[calc(100dvh-3rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-[22px] shadow-[0_24px_70px_rgba(15,23,42,0.24)] ${themeClasses.modalBase} ${className}`}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 dark:border-slate-700">
          <div className="min-w-0">
            <h2 id={labelledById} className={`text-base font-black ${themeClasses.textPrimary}`}>
              {title}
            </h2>
            {description ? (
              <p
                id={`${labelledById}-description`}
                className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-200"
              >
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </section>
    </div>
  );
}
