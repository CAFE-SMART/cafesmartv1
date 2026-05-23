import React from 'react';
import { RefreshCw } from 'lucide-react';
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
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <RefreshCw size={16} className="shrink-0 animate-spin text-[#102d92]" />
        <p className="text-sm font-semibold text-[#102d92]">{text}</p>
      </div>
    </section>
  );
}
