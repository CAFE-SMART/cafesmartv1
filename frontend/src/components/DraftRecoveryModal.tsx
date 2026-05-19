import React from 'react';
import { Save } from 'lucide-react';

type DraftRecoveryModalProps = {
  title?: string;
  heading?: string;
  message: string;
  primaryLabel: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onSecondary: () => void;
  details?: Array<{
    label: string;
    value: React.ReactNode;
  }>;
  labelledById?: string;
  describedById?: string;
};

export function DraftRecoveryModal({
  title = 'Borrador guardado',
  heading = 'Registro en progreso',
  message,
  primaryLabel,
  secondaryLabel = 'Empezar de nuevo',
  onPrimary,
  onSecondary,
  details,
  labelledById = 'draft-recovery-title',
  describedById = 'draft-recovery-description',
}: DraftRecoveryModalProps) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 px-4 backdrop-blur-sm"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledById}
        aria-describedby={describedById}
        className="w-full max-w-[430px] rounded-[26px] bg-white p-5 shadow-[0_28px_70px_rgba(15,23,42,0.24)]"
      >
        <div className="mx-auto h-1.5 w-12 rounded-full bg-[#cfd8e6]" />
        <div className="mt-5 flex items-start gap-4">
          <span
            className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-[#eef4ff] text-[#173ea6]"
            aria-hidden="true"
          >
            <Save size={24} />
          </span>
          <div className="min-w-0">
            <p className="text-[0.78rem] font-black uppercase tracking-[0.11em] text-[#40516d]">
              {title}
            </p>
            <h2
              id={labelledById}
              className="mt-1 text-[1.45rem] font-black leading-tight text-slate-950"
            >
              {heading}
            </h2>
            <p
              id={describedById}
              className="mt-2 text-[0.98rem] font-semibold leading-6 text-slate-700"
            >
              {message}
            </p>
          </div>
        </div>

        {details?.length ? (
          <div className="mt-5 rounded-[18px] border border-[#dbe5fb] bg-[#f8faff] px-4 py-3 text-sm font-semibold text-[#52657d]">
            {details.map((detail, index) => (
              <div
                key={detail.label}
                className={`flex items-center justify-between gap-3 ${
                  index > 0 ? 'mt-2 border-t border-[#dbe5fb] pt-2' : ''
                }`}
              >
                <span>{detail.label}</span>
                <span className="font-black text-[#102d92]">{detail.value}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onPrimary}
            className="inline-flex min-h-[54px] min-w-[150px] flex-1 items-center justify-center rounded-[16px] bg-[#102d92] px-5 py-3 text-[0.98rem] font-black text-white shadow-[0_16px_34px_rgba(16,45,146,0.22)] transition hover:bg-[#18358f] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1f3fa7]/20"
          >
            {primaryLabel}
          </button>
          <button
            type="button"
            onClick={onSecondary}
            className="inline-flex min-h-[52px] min-w-[150px] flex-1 items-center justify-center rounded-[16px] border border-[#d5deee] bg-white px-5 py-3 text-[0.96rem] font-black text-[#334b85] transition hover:bg-[#f4f7ff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1f3fa7]/15"
          >
            {secondaryLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
