import React, { useState } from 'react';
import { FileText, ImageIcon, Receipt, Share2, X } from 'lucide-react';
import { CafeSmartErrorState } from './CafeSmartErrorState';
import type { ShareSummaryFormat } from '../services/shareMovementSummary';

type SummaryRow = {
  icon: React.ReactNode;
  label: string;
  value: string;
};

type HistoryItem = {
  title: string;
  detail: string;
  meta?: string;
};

type TransactionHistory = {
  title: string;
  summary: string;
  items: HistoryItem[];
};

type TransactionSuccessScreenProps = {
  title: string;
  message: string;
  info: string;
  totalLabel: string;
  totalValue: string;
  rows: SummaryRow[];
  history?: TransactionHistory;
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
  history,
  primaryLabel,
  onPrimary,
  onHome,
  capacityNotice,
  onShareSummary,
}: TransactionSuccessScreenProps) {
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareOptionsOpen, setShareOptionsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const handleShare = async (format: ShareSummaryFormat) => {
    if (!onShareSummary || sharing) return;

    setSharing(true);
    setShareError(null);

    try {
      const opened = await onShareSummary(format);
      if (!opened) {
        setShareError('No pudimos abrir las opciones de compartir.');
      } else {
        setShareOptionsOpen(false);
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
            <button
              type="button"
              onClick={() => setShareOptionsOpen(true)}
              disabled={sharing}
              className="inline-flex min-h-[50px] w-full min-w-0 items-center justify-center gap-2 rounded-[16px] border border-[#cbd5e1] bg-white px-3 text-center text-[0.82rem] font-black leading-tight text-[#1e3a8a] shadow-[0_8px_20px_rgba(15,23,42,0.045)] transition duration-200 hover:border-[#93c5fd] hover:bg-white hover:shadow-[0_12px_24px_rgba(15,23,42,0.07)] active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1d4ed8]/18 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <Share2 size={17} aria-hidden="true" />
              {sharing ? 'Abriendo...' : 'Compartir comprobante'}
            </button>
            {shareError ? (
              <p
                role="alert"
                className="rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800"
              >
                {shareError}
              </p>
            ) : null}
            {shareOptionsOpen ? (
              <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/45 px-5 py-6 backdrop-blur-sm">
                <section className="w-full max-w-[360px] rounded-[22px] bg-white p-5 text-left shadow-[0_28px_70px_rgba(15,23,42,0.28)] dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-black text-slate-950 dark:text-white">
                        Compartir comprobante
                      </h2>
                      <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
                        Elige cómo quieres enviarlo.
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Cerrar opciones de compartir"
                      onClick={() => setShareOptionsOpen(false)}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                    >
                      <X size={17} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mt-5 grid gap-2">
                    <button
                      type="button"
                      onClick={() => void handleShare('image')}
                      disabled={sharing}
                      className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] bg-[#102d92] px-4 text-sm font-black text-white transition hover:bg-[#173ea6] disabled:cursor-wait disabled:opacity-70"
                    >
                      <ImageIcon size={17} aria-hidden="true" />
                      Compartir imagen
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleShare('pdf')}
                      disabled={sharing}
                      className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[16px] border border-slate-200 bg-white px-4 text-sm font-black text-[#102d92] transition hover:bg-[#eef4ff] disabled:cursor-wait disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    >
                      <FileText size={17} aria-hidden="true" />
                      Compartir PDF
                    </button>
                  </div>
                </section>
              </div>
            ) : null}
          </div>
        ) : undefined
      }
      fullScreen
      className="max-h-none"
      hideInfoPanel
    >
      <section className="rounded-[22px] border border-slate-200/85 bg-white p-3 text-left shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900">
        <p className="mb-3 text-[0.72rem] font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
          Resumen del movimiento
        </p>

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

        <div className="mt-3 grid gap-2">
          <button
            type="button"
            onClick={() => setReceiptOpen(true)}
            className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[14px] border border-[#cbd5e1] bg-white px-3 text-sm font-black text-[#102d92] transition hover:bg-[#f8fbff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1d4ed8]/18 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-100 dark:hover:bg-slate-700"
          >
            <Receipt size={16} aria-hidden="true" />
            Ver comprobante
          </button>
          {history ? (
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="inline-flex min-h-[46px] w-full items-center justify-center rounded-[14px] border border-[#d5deee] bg-[#f8fbff] px-3 text-sm font-black text-[#173ea6] transition hover:bg-[#eef4ff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1d4ed8]/18 dark:border-slate-700 dark:bg-slate-800 dark:text-blue-100 dark:hover:bg-slate-700"
            >
              Ver historial completo
            </button>
          ) : null}
        </div>
      </section>

      {receiptOpen ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/50 px-5 py-6 backdrop-blur-sm">
          <section className="max-h-[calc(100dvh-2rem)] w-full max-w-[380px] overflow-y-auto rounded-[24px] border border-slate-200 bg-white p-5 text-left shadow-[0_28px_70px_rgba(15,23,42,0.28)] dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-slate-950 dark:text-white">
                  Comprobante
                </h2>
                <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
                  Resumen limpio del movimiento registrado.
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar comprobante"
                onClick={() => setReceiptOpen(false)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>
            <div className="mt-4 rounded-[18px] border border-[#dbe6ff] bg-[#f5f8ff] px-4 py-3 dark:border-blue-400/30 dark:bg-blue-500/10">
              <p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-[#102d92] dark:text-blue-200">
                {totalLabel}
              </p>
              <p className="mt-1 text-2xl font-black text-[#102d92] dark:text-blue-100">
                {totalValue}
              </p>
            </div>
            <div className="mt-4 space-y-2">
              {rows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-3 rounded-[12px] bg-[#f8fafc] px-3 py-2.5 dark:bg-slate-950"
                >
                  <span className="text-xs font-black uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
                    {row.label}
                  </span>
                  <span className="max-w-[58%] text-right text-sm font-black text-slate-950 dark:text-slate-100">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {historyOpen && history ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/50 px-5 py-6 backdrop-blur-sm">
          <section className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[420px] flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_28px_70px_rgba(15,23,42,0.28)] dark:border-slate-700 dark:bg-slate-900">
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-black text-slate-950 dark:text-white">
                  {history.title}
                </h2>
                <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-300">
                  {history.summary}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                aria-label={`Cerrar ${history.title}`}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500 transition hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </header>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
              {history.items.map((item, index) => (
                <article
                  key={`${item.title}-${index}`}
                  className="rounded-[16px] border border-slate-200 bg-[#fbfcff] px-4 py-3 dark:border-slate-700 dark:bg-slate-800"
                >
                  <p className="text-sm font-black uppercase text-slate-950 dark:text-slate-100">
                    {item.title}
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-600 dark:text-slate-300">
                    {item.detail}
                  </p>
                  {item.meta ? (
                    <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {item.meta}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </CafeSmartErrorState>
  );
}
