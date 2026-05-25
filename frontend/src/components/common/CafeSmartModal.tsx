import type { ReactNode } from 'react';
import { X } from 'lucide-react';

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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] px-4 py-6">
      <button
        type="button"
        aria-label="Cerrar"
        className="absolute inset-0 bg-slate-950/25 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledById}
        className={`relative mx-auto flex max-h-[calc(100dvh-3rem)] w-full max-w-[430px] flex-col overflow-hidden rounded-[22px] border border-slate-100 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.24)] ${className}`}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-4">
          <div className="min-w-0">
            <h2 id={labelledById} className="text-base font-black text-slate-950">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </section>
    </div>
  );
}
