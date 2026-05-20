import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { AppFeedbackMessage } from './AppFeedbackMessage';

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
    <AppFeedbackMessage
      variant="info"
      icon={Icon}
      title={title}
      description={description}
      className={className}
    >
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex min-h-[42px] items-center justify-center rounded-[12px] bg-[#102d92] px-4 text-sm font-black text-white"
        >
          {actionLabel}
        </button>
      ) : null}
    </AppFeedbackMessage>
  );
}
