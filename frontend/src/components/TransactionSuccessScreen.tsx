import React from 'react';
import { CafeSmartErrorState } from './CafeSmartErrorState';

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
}: TransactionSuccessScreenProps) {
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
