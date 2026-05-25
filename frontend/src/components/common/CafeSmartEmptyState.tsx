import type { ReactNode } from 'react';

type CafeSmartEmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function CafeSmartEmptyState({
  title,
  description,
  action,
}: CafeSmartEmptyStateProps) {
  return (
    <div className="rounded-[16px] bg-[#f8faff] px-4 py-5 text-center">
      <p className="text-sm font-black text-slate-900">{title}</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
