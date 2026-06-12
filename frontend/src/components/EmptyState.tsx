import React from 'react';
import type { LucideIcon } from 'lucide-react';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`rounded-[18px] border border-dashed border-[#d7ddec] bg-[#fbfcff] px-4 py-6 text-center ${className}`.trim()}
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#eef3ff] text-[#1D4ED8]">
        <Icon size={20} />
      </div>
      <p className="mt-3 text-base font-black text-slate-900">{title}</p>
      <p className="mx-auto mt-1 max-w-[300px] text-sm leading-6 text-slate-600">
        {description}
      </p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex min-h-[42px] items-center justify-center rounded-full bg-[#1D4ED8] px-4 text-sm font-black text-white"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
