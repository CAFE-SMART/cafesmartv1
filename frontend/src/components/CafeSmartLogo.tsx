import React from 'react';

type CafeSmartLogoProps = {
  compact?: boolean;
  className?: string;
};

export function CafeSmartLogo({
  compact = false,
  className = '',
}: CafeSmartLogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`.trim()}>
      <span
        className={`inline-flex items-center justify-center overflow-hidden rounded-full bg-[#0b1118] text-white shadow-[0_8px_18px_rgba(39,74,184,0.22)] ${
          compact ? 'h-8 w-8' : 'h-10 w-10'
        }`}
        aria-hidden="true"
      >
        <img
          src="/imagenes-de-proyecto/granito-inteligente.png"
          alt=""
          className="h-full w-full object-cover"
        />
      </span>

      <span
        className={`font-black tracking-[-0.02em] text-[#172033] ${compact ? 'text-sm' : 'text-xl'}`}
      >
        Caf&eacute; Smart
      </span>
    </div>
  );
}
