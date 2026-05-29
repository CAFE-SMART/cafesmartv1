import React from 'react';
import { InternalLoadingScreen } from '../../../components/InternalLoadingScreen';

interface LoadingCardProps {
  text?: string;
  mode?: 'page' | 'inline';
}

export function LoadingCard({
  text = 'Cargando información...',
  mode = 'inline',
}: LoadingCardProps) {
  if (mode === 'page') {
    return (
      <InternalLoadingScreen
        title={text}
        description="Estamos preparando la información de ventas."
        warningText="Esto puede tardar unos segundos."
        securityTitle="Carga segura"
        securityDescription="Tus datos se mantienen protegidos mientras actualizamos la vista."
      />
    );
  }

  return (
    <section
      className="rounded-[18px] border border-[#e5e7f2] bg-white px-4 py-3 shadow-sm"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <span
          className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-blue-200 border-t-blue-700 dark:border-slate-700 dark:border-t-blue-300"
          aria-hidden="true"
        />
        <span className="sr-only">Cargando información</span>
        <p className="text-sm font-semibold text-[#102d92]">{text}</p>
      </div>
    </section>
  );
}
