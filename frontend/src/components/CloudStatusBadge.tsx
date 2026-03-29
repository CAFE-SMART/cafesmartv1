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

const toneClasses = {
  offline: 'border-red-200 bg-red-50 text-red-700',
  checking: 'border-slate-200 bg-white text-slate-700',
  connected: 'border-sky-200 bg-sky-50 text-sky-700',
  syncing: 'border-amber-200 bg-amber-50 text-amber-700',
  synced: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  error: 'border-red-200 bg-red-50 text-red-700',
  degraded: 'border-orange-200 bg-orange-50 text-orange-700',
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

export function CloudStatusBadge() {
  const { tone, title, detail, refreshHealth } = useCloudStatus();

  return (
    <button
      type="button"
      onClick={() => void refreshHealth()}
      className={`inline-flex max-w-[260px] items-center gap-3 rounded-2xl border px-3 py-2 text-left shadow-sm transition-colors ${toneClasses[tone]}`}
      title={detail}
    >
      <span className="flex-shrink-0">
        <StatusIcon tone={tone} />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-bold uppercase tracking-wide">{title}</span>
        <span className="block truncate text-[11px] opacity-90">{detail}</span>
      </span>
    </button>
  );
}
