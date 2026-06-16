import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { RefreshCcw } from 'lucide-react';

interface RefreshButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  iconOnly?: boolean;
  children?: ReactNode;
}

export function RefreshButton({
  loading,
  iconOnly,
  children,
  className = '',
  disabled,
  ...props
}: RefreshButtonProps) {
  const buttonDisabled = disabled || loading;
  const content = children ?? props['aria-label'];

  return (
    <button
      type="button"
      disabled={buttonDisabled}
      aria-disabled={buttonDisabled ? 'true' : undefined}
      aria-busy={loading ? 'true' : undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-[14px] border border-[#dbe2ee] bg-white px-3 py-2 text-[0.75rem] font-black text-[#334155] shadow-sm transition hover:bg-[#f8fafc] disabled:cursor-wait disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 dark:border-blue-500/35 dark:bg-[#1f3fa7] dark:text-white dark:shadow-none dark:hover:bg-[#294fc4] dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-300 ${iconOnly ? 'h-10 w-10 px-0' : 'h-10'} ${className}`.trim()}
      {...props}
    >
      <RefreshCcw
        size={14}
        className={loading ? 'animate-spin' : ''}
        aria-hidden="true"
      />
      {!iconOnly ? content : null}
    </button>
  );
}
