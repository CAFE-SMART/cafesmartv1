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
      <section className="rounded-[22px] border border-slate-200/80 bg-white p-4 text-left shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
        <p className="text-center text-[0.72rem] font-black uppercase tracking-[0.14em] text-emerald-700">
          Todo quedó listo
        </p>
        <p className="mt-2 text-center text-sm font-semibold leading-5 text-slate-600">
          {info}
        </p>

        <div className="mt-4 divide-y divide-slate-200/70 rounded-[16px] border border-slate-200/70 bg-white px-4">
          {rows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-[3rem_1fr] items-center gap-2 py-3"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#eef2ff] text-sm font-black text-[#1d4ed8]">
                {row.icon}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black text-[#0f172a]">
                  {row.label}
                </span>
                <span className="mt-1 block truncate text-sm font-medium leading-5 text-[#475569]">
                  {row.value}
                </span>
              </span>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-[18px] border border-[#d8e3f7] bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] px-4 py-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
          <span className="text-[0.7rem] font-black uppercase tracking-[0.16em] text-[#38557f]">
            {totalLabel}
          </span>
          <p className="mt-1 break-words text-[clamp(1.65rem,7vw,2.05rem)] font-black leading-tight text-[#173a8a]">
            {totalValue}
          </p>
        </div>

        {capacityNotice ? <div className="mt-3">{capacityNotice}</div> : null}
      </section>
    </CafeSmartErrorState>
  );
}
