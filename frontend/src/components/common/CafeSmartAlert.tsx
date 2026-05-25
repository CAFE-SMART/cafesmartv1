import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  type LucideIcon,
} from 'lucide-react';
import { alertThemes, type AlertVariant } from '../../theme/alertThemes';

const defaultIcons: Record<AlertVariant, LucideIcon> = {
  error: AlertCircle,
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
};

type CafeSmartAlertProps = {
  variant?: AlertVariant;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  actions?: React.ReactNode;
  chips?: React.ReactNode;
  icon?: LucideIcon;
  onClose?: () => void;
  className?: string;
  role?: 'alert' | 'status';
  'aria-live'?: 'assertive' | 'polite' | 'off';
};

export function CafeSmartAlert({
  variant = 'info',
  title,
  description,
  children,
  actions,
  chips,
  icon,
  onClose,
  className = '',
  role,
  'aria-live': ariaLive,
}: CafeSmartAlertProps) {
  const styles = alertThemes[variant];
  const Icon = icon ?? defaultIcons[variant];
  const resolvedRole = role ?? (variant === 'error' ? 'alert' : 'status');
  const resolvedLive = ariaLive ?? (variant === 'error' ? 'assertive' : 'polite');

  return (
    <div
      role={resolvedRole}
      aria-live={resolvedLive}
      className={`w-full min-w-0 rounded-[16px] px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.06)] ${styles.container} ${className}`.trim()}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] ${styles.iconWrap} ${styles.icon}`}
          aria-hidden="true"
        >
          <Icon size={18} strokeWidth={2.4} />
        </span>
        <div className="min-w-0 flex-1">
          {title ? (
            <p className={`text-[0.88rem] font-black leading-5 ${styles.title}`}>
              {title}
            </p>
          ) : null}
          {description ? (
            <p className={`${title ? 'mt-1' : ''} text-[0.82rem] font-semibold leading-5 ${styles.description}`}>
              {description}
            </p>
          ) : null}
          {chips ? <div className="mt-3 flex flex-wrap gap-2">{chips}</div> : null}
          {children ? <div className={title || description || chips ? 'mt-3' : ''}>{children}</div> : null}
          {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar alerta"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/70 text-slate-600 transition hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X size={15} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
