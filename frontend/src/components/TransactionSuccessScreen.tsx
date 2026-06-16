import React, { useState } from 'react';
import { FileText, ImageIcon } from 'lucide-react';
import { CafeSmartErrorState } from './CafeSmartErrorState';
import type { ShareSummaryFormat } from '../services/shareMovementSummary';

type SummaryRow = {
  icon: React.ReactNode;
  label: string;
  value: string;
};

type TransactionSuccessScreenProps = {
  title: string;
  message: string;
  info: string;
  totalLabel: string;
  totalValue: string;
  rows: SummaryRow[];
  primaryLabel: string;
  onPrimary: () => void;
  onHome: () => void;
  capacityNotice?: React.ReactNode;
  onShareSummary?: (format: ShareSummaryFormat) => Promise<boolean>;
};

export function TransactionSuccessScreen({
  title,
  message,
  info,
  totalLabel,
  totalValue,
  rows,
  primaryLabel,
  onPrimary,
  onHome,
  capacityNotice,
  onShareSummary,
}: TransactionSuccessScreenProps) {
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const handleShare = async (format: ShareSummaryFormat) => {
    if (!onShareSummary || sharing) return;

    setSharing(true);
    setShareError(null);

    try {
      const opened = await onShareSummary(format);
      if (!opened) {
        setShareError('No pudimos abrir las opciones de compartir.');
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <CafeSmartErrorState
      variant="success"
      title={title}
      message={message}
      info={info}
      primaryLabel={primaryLabel}
      secondaryLabel="Ir al inicio"
      onPrimary={onPrimary}
      onSecondary={onHome}
      extraAction={
        onShareSummary ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handleShare('image')}
                disabled={sharing}
                className="inline-flex min-h-[50px] w-full min-w-0 items-center justify-center gap-2 rounded-[16px] border border-[#cbd5e1] bg-white px-3 text-center text-[0.82rem] font-black leading-tight text-[#1e3a8a] shadow-[0_8px_20px_rgba(15,23,42,0.045)] transition duration-200 hover:border-[#93c5fd] hover:bg-white hover:shadow-[0_12px_24px_rgba(15,23,42,0.07)] active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1d4ed8]/18 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                <ImageIcon size={17} aria-hidden="true" />
                {sharing ? 'Abriendo...' : 'Compartir imagen'}
              </button>
              <button
                type="button"
                onClick={() => void handleShare('pdf')}
                disabled={sharing}
                className="inline-flex min-h-[50px] w-full min-w-0 items-center justify-center gap-2 rounded-[16px] border border-[#cbd5e1] bg-white px-3 text-center text-[0.82rem] font-black leading-tight text-[#1e3a8a] shadow-[0_8px_20px_rgba(15,23,42,0.045)] transition duration-200 hover:border-[#93c5fd] hover:bg-white hover:shadow-[0_12px_24px_rgba(15,23,42,0.07)] active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1d4ed8]/18 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                <FileText size={17} aria-hidden="true" />
                {sharing ? 'Abriendo...' : 'Compartir PDF'}
              </button>
            </div>
            {shareError ? (
              <p
                role="alert"
                className="rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800"
              >
                {shareError}
              </p>
            ) : null}
          </div>
        ) : undefined
      }
      fullScreen
      className="max-h-none"
    >
      <section className="rounded-[20px] border border-slate-200/85 bg-white p-3 text-left shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-[0.72rem] font-black uppercase tracking-[0.14em] text-emerald-700">
            Resumen
          </span>
          <span className="text-[0.72rem] font-semibold text-slate-500 dark:text-slate-300">
            {totalLabel}
          </span>
        </div>

        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[2.5rem_1fr] items-center gap-2 rounded-[14px] bg-[#f7fbff] px-3 py-2 dark:bg-slate-800"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#eef4ff] text-sm font-black text-[#1d4ed8] dark:bg-slate-700 dark:text-sky-300">
                {row.icon}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900 dark:text-slate-100">
                  {row.label}
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {row.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-[16px] bg-[#eef4ff] px-3 py-3 text-center dark:bg-slate-800">
          <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-[#375a9c] dark:text-sky-300">
            {totalLabel}
          </p>
          <p className="mt-1 text-lg font-black leading-tight text-[#0f172a] dark:text-slate-100">
            {totalValue}
          </p>
        </div>

        {capacityNotice ? <div className="mt-3 text-sm">{capacityNotice}</div> : null}
      </section>
    </CafeSmartErrorState>
  );
}
