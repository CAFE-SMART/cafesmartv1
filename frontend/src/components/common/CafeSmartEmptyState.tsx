import type { ReactNode } from 'react';

type CafeSmartEmptyStateProps = {
  title: string;
  description: string;
  icon?: ReactNode;
  action?: ReactNode;
};

export function CafeSmartEmptyState({
  title,
  description,
  icon,
  action,
}: CafeSmartEmptyStateProps) {
  return (
    <div className="rounded-[16px] bg-[#f8faff] px-4 py-5 text-center dark:bg-slate-900">
      {icon ? (
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#102d92] shadow-sm dark:bg-slate-800 dark:text-blue-200">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-black text-slate-900 dark:text-slate-100">{title}</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-300">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}