import React from 'react';
import {
  Cloud,
  CloudAlert,
  CloudCheck,
  CloudCog,
  CloudOff,
  LoaderCircle,
} from 'lucide-react';
import { useCloudStatus } from '../context/CloudStatusContext';
import { alertThemes } from '../theme/alertThemes';

const toneClasses = {
  offline: alertThemes.error.container,
  checking: alertThemes.info.container,
  connected: alertThemes.info.container,
  syncing: alertThemes.warning.container,
  synced: alertThemes.success.container,
  error: alertThemes.error.container,
  degraded: alertThemes.warning.container,
} as const;

function StatusIcon({ tone }: { tone: keyof typeof toneClasses }) {
  if (tone === 'offline') {
    return <CloudOff size={18} />;
  }

  if (tone === 'checking') {
    return <CloudCog size={18} />;
  }

  if (tone === 'syncing') {
    return <LoaderCircle size={18} className="animate-spin" />;
  }

  if (tone === 'synced') {
    return <CloudCheck size={18} />;
  }

  if (tone === 'error' || tone === 'degraded') {
    return <CloudAlert size={18} />;
  }

  return <Cloud size={18} />;
}

export function CloudStatusBadge({
  className = '',
  compact = false,
}: {
  className?: string;
  compact?: boolean;
} = {}) {
  const { tone, title, detail, refreshHealth } = useCloudStatus();

  return (
    <button
      type="button"
      onClick={() => void refreshHealth()}
      className={`inline-flex min-w-0 items-start gap-3 rounded-[16px] border text-left shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-0.5 ${
        compact
          ? 'w-full max-w-[260px] px-3 py-2.5'
          : 'max-w-[300px] px-3.5 py-2.5'
      } ${toneClasses[tone]} ${className}`}
      title={detail}
      aria-live="polite"
    >
      <span className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[12px] bg-white/85 dark:bg-white/10">
        <StatusIcon tone={tone} />
      </span>
      <span className="min-w-0">
        <span className="block text-[0.88rem] font-black leading-5">{title}</span>
        {!compact ? (
          <span className="mt-1 block truncate text-[0.82rem] font-semibold leading-5 opacity-90">{detail}</span>
        ) : (
          <span className="mt-1 block truncate text-[0.82rem] font-semibold leading-5 opacity-90">{detail}</span>
        )}
      </span>
    </button>
  );
}
