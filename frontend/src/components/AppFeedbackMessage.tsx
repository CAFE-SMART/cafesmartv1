import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  type LucideIcon,
} from 'lucide-react';

export type AppFeedbackVariant = 'success' | 'error' | 'warning' | 'info';

type AppFeedbackMessageProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'role' | 'title'
> & {
  variant?: AppFeedbackVariant;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  role?: 'alert' | 'status';
  'aria-live'?: 'assertive' | 'polite' | 'off';
  icon?: LucideIcon;
  action?: React.ReactNode;
};

const variantStyles: Record<
  AppFeedbackVariant,
  {
    border: string;
    bg: string;
    icon: string;
    iconBg: string;
    title: string;
    description: string;
    Icon: LucideIcon;
    defaultRole: 'alert' | 'status';
    defaultLive: 'assertive' | 'polite';
  }
> = {
  success: {
    border: 'border-emerald-200',
    bg: 'bg-emerald-50',
    icon: 'text-emerald-700',
    iconBg: 'bg-white/85',
    title: 'text-emerald-900',
    description: 'text-emerald-800',
    Icon: CheckCircle2,
    defaultRole: 'status',
    defaultLive: 'polite',
  },
  error: {
    border: 'border-rose-200',
    bg: 'bg-rose-50',
    icon: 'text-rose-700',
    iconBg: 'bg-white/85',
    title: 'text-rose-900',
    description: 'text-rose-800',
    Icon: AlertCircle,
    defaultRole: 'alert',
    defaultLive: 'assertive',
  },
  warning: {
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    icon: 'text-amber-700',
    iconBg: 'bg-white/85',
    title: 'text-amber-950',
    description: 'text-amber-800',
    Icon: AlertTriangle,
    defaultRole: 'status',
    defaultLive: 'polite',
  },
  info: {
    border: 'border-sky-200',
    bg: 'bg-sky-50',
    icon: 'text-sky-700',
    iconBg: 'bg-white/85',
    title: 'text-sky-950',
    description: 'text-sky-800',
    Icon: Info,
    defaultRole: 'status',
    defaultLive: 'polite',
  },
};

export const AppFeedbackMessage = React.forwardRef<
  HTMLDivElement,
  AppFeedbackMessageProps
>(function AppFeedbackMessage(
  {
    variant = 'info',
    title,
    description,
    children,
    className = '',
    id,
    role,
    'aria-live': ariaLive,
    icon,
    action,
    ...rest
  },
  ref,
) {
  const styles = variantStyles[variant];
  const Icon = icon ?? styles.Icon;
  const resolvedRole = role ?? styles.defaultRole;
  const resolvedLive = ariaLive ?? styles.defaultLive;

  return (
    <div
      ref={ref}
      id={id}
      role={resolvedRole}
      aria-live={resolvedLive}
      {...rest}
      className={`w-full min-w-0 rounded-[16px] border px-4 py-3 text-sm shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition-all duration-300 ease-out animate-[cafesmartFeedbackIn_220ms_ease-out_both] ${styles.border} ${styles.bg} ${className}`.trim()}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] ${styles.iconBg} ${styles.icon}`}
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
            <p
              className={`${title ? 'mt-1' : ''} text-[0.82rem] font-semibold leading-5 ${styles.description}`}
            >
              {description}
            </p>
          ) : null}
          {children ? <div className={title || description ? 'mt-3' : ''}>{children}</div> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
});
