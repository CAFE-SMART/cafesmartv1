import React from 'react';
import {
  AlertTriangle,
  Check,
  Home,
  RefreshCcw,
  ShieldCheck,
} from 'lucide-react';
import { CafeSmartLogo } from './CafeSmartLogo';

type CafeSmartErrorStateProps = {
  variant?: 'error' | 'success';
  title: string;
  message: string;
  info?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  primaryBusy?: boolean;
  className?: string;
  fullScreen?: boolean;
  children?: React.ReactNode;
  extraAction?: React.ReactNode;
};

function ErrorStateAnimations() {
  return (
    <style>
      {`
        @keyframes cafesmartFadeScale {
          0% { opacity: 0; transform: translateY(8px) scale(0.94); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes cafesmartFadeUp {
          0% { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes cafesmartSway {
          0%, 100% { transform: rotate(-2deg) translateX(0); }
          50% { transform: rotate(2deg) translateX(4px); }
        }

        @keyframes cafesmartPulseSoft {
          0%, 100% { transform: scale(1); opacity: .75; }
          50% { transform: scale(1.045); opacity: .96; }
        }

        @keyframes cafesmartGlowBreath {
          0%, 100% { opacity: .58; transform: scale(.98); filter: blur(0); }
          50% { opacity: .92; transform: scale(1.06); filter: blur(1px); }
        }

        .bg-gradient-radial {
          background: radial-gradient(circle at 50% 16%, rgba(47,128,237,0.09), transparent 30%), linear-gradient(180deg,#ffffff 0%,#f8fbff 60%,#eef5ff 100%);
        }

        .bg-success-glow {
          background: rgba(16,185,129,0.18);
        }

        .bg-error-glow {
          background: rgba(239,68,68,0.18);
        }

        .delay-0s {
          animation-delay: 0s;
        }

        .delay-2s {
          animation-delay: 0.2s;
        }

        .delay-35s {
          animation-delay: 0.35s;
        }
      `}
    </style>
  );
}

function CoffeePlant({
  className,
  delayClass = '',
}: {
  className: string;
  delayClass?: string;
}) {
  return (
    <svg
      viewBox="0 0 96 140"
      className={`${className} ${delayClass}`.trim()}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M48 134C45 92 52 56 75 17"
        stroke="#86bfff"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path d="M49 96C28 90 16 76 14 58C35 60 49 75 49 96Z" fill="#9ccaff" />
      <path d="M57 78C77 73 89 61 91 43C71 43 58 58 57 78Z" fill="#7db5ff" />
      <path
        d="M60 116C77 112 88 101 91 84C73 84 61 98 60 116Z"
        fill="#9ccaff"
      />
      <circle cx="55" cy="119" r="5" fill="#8b5a2b" opacity="0.75" />
      <circle cx="69" cy="126" r="5" fill="#b8753a" opacity="0.72" />
    </svg>
  );
}

function BottomDecoration() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[168px] overflow-hidden">
      <svg
        className="absolute bottom-0 h-full w-full"
        viewBox="0 0 430 190"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 86C54 55 105 72 153 101C211 136 259 95 313 84C358 75 393 93 430 116V190H0V86Z"
          fill="#dbeafe"
          opacity="0.82"
        />
        <path
          d="M0 126C59 94 113 106 170 133C223 158 270 126 319 116C364 108 397 126 430 143V190H0V126Z"
          fill="#bfdbfe"
          opacity="0.58"
        />
      </svg>
      <CoffeePlant className="absolute bottom-2 left-7 h-24 w-20 origin-bottom opacity-75 animate-[cafesmartSway_4s_ease-in-out_infinite] delay-0s" />
      <CoffeePlant
        className="absolute bottom-2 right-5 h-32 w-24 origin-bottom opacity-85 animate-[cafesmartSway_4.8s_ease-in-out_infinite]"
        delayClass="delay-35s"
      />
    </div>
  );
}

function StatusIllustration({ variant }: { variant: 'error' | 'success' }) {
  const isSuccess = variant === 'success';
  const glowClass = isSuccess ? 'bg-success-glow' : 'bg-error-glow';
  const haloClass = isSuccess
    ? 'bg-[#d1fae5] ring-[#a7f3d0]'
    : 'bg-[#fee2e2] ring-[#fecaca]';
  const iconClass = isSuccess
    ? 'text-[#10b981] shadow-[0_16px_36px_rgba(16,185,129,0.22),0_0_42px_rgba(16,185,129,0.16)] ring-[#a7f3d0]'
    : 'text-[#ef4444] shadow-[0_16px_36px_rgba(239,68,68,0.18),0_0_42px_rgba(239,68,68,0.13)] ring-[#fecaca]';

  return (
    <div className="relative z-10 mt-6 animate-[cafesmartFadeUp_360ms_ease-out_80ms_both]">
      <div className="absolute inset-x-0 top-2 mx-auto h-28 w-28 rounded-full bg-[#e9f3ff] animate-[cafesmartPulseSoft_2.8s_ease-in-out_infinite]" />
      <div
        className={`absolute inset-x-0 top-5 mx-auto h-28 w-28 rounded-full animate-[cafesmartGlowBreath_3.2s_ease-in-out_infinite] ${glowClass}`}
        aria-hidden="true"
      />
      <CoffeePlant className="absolute -left-8 bottom-0 h-20 w-16 origin-bottom opacity-55 animate-[cafesmartSway_4.2s_ease-in-out_infinite]" />
      <CoffeePlant
        className="absolute -right-8 bottom-0 h-24 w-16 origin-bottom opacity-55 animate-[cafesmartSway_4.7s_ease-in-out_infinite]"
        delayClass="delay-2s"
      />
      <div className="relative mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-[#eef6ff] shadow-[0_22px_54px_rgba(37,99,235,0.12)]">
        <div
          className={`flex h-[74px] w-[74px] items-center justify-center rounded-full bg-white ring-1 ${haloClass} ${iconClass}`}
        >
          {isSuccess ? (
            <Check size={38} strokeWidth={3} />
          ) : (
            <AlertTriangle size={36} strokeWidth={2.4} />
          )}
        </div>
      </div>
    </div>
  );
}

export function CafeSmartErrorState({
  variant = 'error',
  title,
  message,
  info,
  primaryLabel = 'Reintentar',
  secondaryLabel = 'Volver al inicio',
  onPrimary,
  onSecondary,
  primaryBusy = false,
  className = '',
  fullScreen = false,
  children,
  extraAction,
}: CafeSmartErrorStateProps) {
  const isSuccess = variant === 'success';
  const resolvedInfo =
    info ??
    (isSuccess
      ? 'La información quedó guardada correctamente en CaféSmart.'
      : 'Tus datos siguen seguros. Puedes intentarlo nuevamente cuando tengas conexión.');
  const hasActions = Boolean(onPrimary || onSecondary || extraAction);
  const actionColumns =
    onPrimary && onSecondary
      ? 'grid-cols-2 max-[330px]:grid-cols-1'
      : 'grid-cols-1';

  const sectionA11yProps = isSuccess
    ? ({ role: 'status', 'aria-live': 'polite' } as const)
    : ({ role: 'alert', 'aria-live': 'assertive' } as const);

  const content = (
    <section
      {...sectionA11yProps}
      className={`relative z-10 flex w-full max-w-[430px] flex-col items-center overflow-hidden rounded-[30px] border border-[#e6eefb] bg-[#f8fbff] px-5 pb-8 pt-6 text-center text-[#07153b] shadow-[0_28px_80px_rgba(15,23,42,0.14)] ${className}`.trim()}
    >
      <div className="relative z-10 animate-[cafesmartFadeScale_280ms_ease-out_both]">
        <CafeSmartLogo size="sm" compact />
      </div>

      <StatusIllustration variant={variant} />

      <div className="relative z-10 mt-7 animate-[cafesmartFadeUp_360ms_ease-out_150ms_both]">
        <h1 className="text-[1.48rem] font-black leading-tight text-[#07153b]">
          {title}
        </h1>
        <p className="mx-auto mt-3 max-w-[320px] text-sm font-semibold leading-6 text-slate-500">
          {message}
        </p>
      </div>

      {children ? (
        <div className="relative z-10 mt-6 w-full max-w-[340px] animate-[cafesmartFadeUp_360ms_ease-out_190ms_both]">
          {children}
        </div>
      ) : null}

      {hasActions ? (
        <div
          className={`relative z-10 mt-6 grid w-full max-w-[348px] ${actionColumns} gap-3 animate-[cafesmartFadeUp_360ms_ease-out_220ms_both]`}
        >
          {onPrimary ? (
            <button
              type="button"
              onClick={onPrimary}
              disabled={primaryBusy}
              className="inline-flex min-h-[52px] min-w-0 items-center justify-center gap-2 rounded-[16px] bg-[#1d4ed8] px-3 text-center text-[0.82rem] font-black leading-tight text-white shadow-[0_18px_36px_rgba(29,78,216,0.26)] transition duration-200 hover:bg-[#1e3a8a] hover:shadow-[0_20px_40px_rgba(29,78,216,0.3)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-65 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1d4ed8]/25 sm:px-4 sm:text-sm"
            >
              {isSuccess ? (
                <Check size={17} strokeWidth={3} aria-hidden="true" />
              ) : (
                <RefreshCcw
                  size={17}
                  className={primaryBusy ? 'animate-spin' : ''}
                  aria-hidden="true"
                />
              )}
              {primaryBusy ? 'Reintentando...' : primaryLabel}
            </button>
          ) : null}
          {onSecondary ? (
            <button
              type="button"
              onClick={onSecondary}
              className="inline-flex min-h-[52px] min-w-0 items-center justify-center gap-2 rounded-[16px] border border-[#cbd5e1] bg-white/90 px-3 text-center text-[0.82rem] font-black leading-tight text-[#1e3a8a] shadow-[0_8px_20px_rgba(15,23,42,0.045)] transition duration-200 hover:border-[#93c5fd] hover:bg-white hover:shadow-[0_12px_24px_rgba(15,23,42,0.07)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1d4ed8]/18 sm:px-4 sm:text-sm"
            >
              <Home size={17} aria-hidden="true" />
              {secondaryLabel}
            </button>
          ) : null}
          {extraAction ? <div className="col-span-full">{extraAction}</div> : null}
        </div>
      ) : null}

      <div className="relative z-10 mt-6 flex w-full max-w-[330px] items-center gap-3 rounded-[22px] bg-[#eef6ff] p-4 text-left shadow-[0_18px_38px_rgba(37,99,235,0.08)] animate-[cafesmartFadeUp_360ms_ease-out_290ms_both]">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1683f7] shadow-[0_10px_24px_rgba(37,99,235,0.08)]">
          <ShieldCheck size={25} strokeWidth={2.3} aria-hidden="true" />
        </div>
        <p className="text-[0.8rem] font-semibold leading-5 text-slate-500">
          <span className="block text-sm font-black text-[#07153b]">
            {isSuccess ? 'Todo quedó listo' : 'Tus datos siguen seguros'}
          </span>
          {resolvedInfo}
        </p>
      </div>
      {!fullScreen ? <BottomDecoration /> : null}
    </section>
  );

  if (!fullScreen) {
    return (
      <div className="relative overflow-hidden">
        <ErrorStateAnimations />
        {content}
      </div>
    );
  }

  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-[#f8fbff] px-5 py-7">
      <ErrorStateAnimations />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-radial"
      />
      {content}
      <BottomDecoration />
    </main>
  );
}
