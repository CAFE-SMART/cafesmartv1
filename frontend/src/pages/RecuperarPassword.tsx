import React from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Headset,
  Loader,
  Mail,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppFeedbackMessage } from '../components/AppFeedbackMessage';
import { CafeSmartLogo } from '../components/CafeSmartLogo';
import { useResetPassword } from '../hooks/useResetPassword';

function RecoveryDecorations() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_48%_8%,rgba(47,99,216,0.12),transparent_30%),linear-gradient(180deg,#ffffff_0%,#f8fbff_56%,#edf5ff_100%)] dark:bg-[radial-gradient(circle_at_48%_8%,rgba(59,130,246,0.18),transparent_30%),linear-gradient(180deg,#020617_0%,#0f172a_56%,#020617_100%)]" />
      <div className="absolute -left-20 bottom-6 h-48 w-48 rounded-full bg-[#dbeafe]/80 blur-2xl dark:bg-blue-950/50" />
      <div className="absolute -right-16 top-16 h-40 w-40 rounded-full bg-[#bfdbfe]/55 blur-2xl dark:bg-slate-800/70" />
      <svg
        className="absolute inset-x-0 bottom-0 h-32 w-full text-[#bfdbfe]/70 dark:text-slate-800/80"
        viewBox="0 0 430 140"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 66C60 37 113 43 166 74C222 106 270 70 323 59C366 50 398 67 430 86V140H0V66Z"
          fill="currentColor"
        />
        <path
          d="M0 100C58 76 112 84 175 107C232 128 280 104 332 94C374 86 404 99 430 114V140H0V100Z"
          fill="#dbeafe"
          opacity="0.7"
          className="dark:fill-slate-700"
        />
      </svg>
    </div>
  );
}

function RecoveryErrorNotice({
  message,
  code,
  onRetry,
  onSecondary,
}: {
  message: string;
  code?: string;
  onRetry?: () => void;
  onSecondary?: () => void;
}) {
  const detail =
    code === 'NETWORK'
      ? 'Verifica tu conexión e intenta nuevamente.'
      : code === 'NOT_FOUND'
        ? 'Revisa el correo o usa otra dirección.'
        : code === 'VALIDATION'
          ? 'Corrige el dato para continuar.'
          : 'Intenta nuevamente en unos segundos.';

  return (
    <AppFeedbackMessage variant="error" title={message} description={detail}>
      {onRetry || onSecondary ? (
        <div className="flex flex-wrap gap-2">
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex min-h-[36px] items-center justify-center rounded-[12px] bg-[#102d92] px-3 text-xs font-black text-white shadow-[0_10px_20px_rgba(16,45,146,0.18)]"
            >
              Intentar de nuevo
            </button>
          ) : null}
          {onSecondary ? (
            <button
              type="button"
              onClick={onSecondary}
              className="inline-flex min-h-[36px] items-center justify-center rounded-[12px] border border-[#cdd8ef] bg-white px-3 text-xs font-black text-[#102d92] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            >
              Usar otro correo
            </button>
          ) : null}
        </div>
      ) : null}
    </AppFeedbackMessage>
  );
}

export default function RecuperarPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const recoveryState = location.state as {
    origin?: string;
    returnTo?: string;
    returnLabel?: string;
    finalBackTo?: string;
  } | null;
  const returnTo =
    typeof recoveryState?.returnTo === 'string' && recoveryState.returnTo.startsWith('/')
      ? recoveryState.returnTo
      : '/login';
  const returnLabel =
    typeof recoveryState?.returnLabel === 'string' && recoveryState.returnLabel.trim()
      ? recoveryState.returnLabel
      : returnTo === '/resumen-financiero/acceso'
        ? 'Volver al acceso financiero'
        : 'Volver al login';
  const handleBack = () => {
    navigate(returnTo, {
      replace: true,
      state:
        recoveryState?.origin === 'financial-access'
          ? {
              finalBackTo:
                typeof recoveryState.finalBackTo === 'string' &&
                recoveryState.finalBackTo.startsWith('/')
                  ? recoveryState.finalBackTo
                  : '/ajustes',
            }
          : undefined,
    });
  };
  const {
    email,
    setEmail,
    error,
    enlaceEnviado,
    cooldownSeconds,
    isLoading,
    handleSubmit,
    reenviarEnlace,
    usarOtroCorreo,
  } = useResetPassword();

  const header = (
    <header className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full border border-[#dbe7ff] bg-white px-3 text-xs font-black text-[#102d92] shadow-sm transition hover:bg-[#f5f9ff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1d4ed8]/15 dark:border-slate-700 dark:bg-slate-900 dark:text-blue-200 dark:hover:bg-slate-800"
        aria-label={returnLabel}
      >
        <ArrowLeft size={18} />
      </button>
      <h1 className="text-[1.25rem] font-black tracking-tight text-slate-950 dark:text-slate-100">
        Recuperar contraseña
      </h1>
    </header>
  );

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f6f7ff] px-4 py-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <RecoveryDecorations />
      <main className="relative z-10 w-full max-w-[430px] rounded-[28px] border border-[#e6eefb] bg-white/95 p-5 text-slate-900 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100 sm:p-7">
        {header}

        {enlaceEnviado ? (
          <section className="mt-7 space-y-4" aria-live="polite">
            <div className="text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[24px] bg-[#eaf2ff] text-[#102d92] shadow-[0_18px_38px_rgba(16,45,146,0.16)] ring-1 ring-[#bfdbfe] dark:bg-blue-500/15 dark:text-blue-200 dark:ring-blue-500/30">
                <CheckCircle2 size={32} strokeWidth={2.5} aria-hidden="true" />
              </div>
              <h2 className="mt-5 text-[1.7rem] font-black leading-tight text-slate-950 dark:text-slate-100">
                Revisa tu correo
              </h2>
              <p className="mx-auto mt-3 max-w-[330px] text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
                Te enviamos un enlace para restablecer tu contraseña. Revisa
                también la carpeta de spam.
              </p>
            </div>

            {error ? (
              <RecoveryErrorNotice
                message={error.message}
                code={error.code}
                onRetry={() => void reenviarEnlace()}
                onSecondary={usarOtroCorreo}
              />
            ) : null}

            <div className="rounded-[22px] border border-[#dbe7ff] bg-[#f8fbff] px-4 py-4 text-left shadow-[0_12px_28px_rgba(47,99,216,0.07)] dark:border-slate-700 dark:bg-slate-800">
              <p className="text-sm font-black text-slate-950 dark:text-slate-100">
                ¿No recibiste el correo?
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => void reenviarEnlace()}
                  disabled={isLoading || cooldownSeconds > 0}
                  className="inline-flex min-h-[44px] min-w-[156px] flex-1 items-center justify-center gap-2 rounded-[16px] bg-[#102d92] px-4 text-center text-[0.82rem] font-black leading-tight text-white shadow-[0_14px_28px_rgba(16,45,146,0.2)] transition hover:bg-[#18358f] active:scale-[0.985] focus:outline-none focus:ring-4 focus:ring-[#1e3a8a]/20 disabled:cursor-not-allowed disabled:bg-[#9fb2d9] disabled:shadow-none sm:flex-none"
                >
                  {isLoading ? (
                    <>
                      <Loader size={17} className="animate-spin" />
                      Reenviando...
                    </>
                  ) : cooldownSeconds > 0 ? (
                    `Reenviar enlace (${cooldownSeconds}s)`
                  ) : (
                    'Reenviar enlace'
                  )}
                </button>

                <button
                  type="button"
                  onClick={usarOtroCorreo}
                  className="inline-flex min-h-[44px] min-w-[132px] flex-1 items-center justify-center rounded-[16px] border border-[#cdd8ef] bg-white/90 px-4 text-center text-[0.82rem] font-black leading-tight text-[#102d92] shadow-[0_8px_18px_rgba(15,23,42,0.045)] transition hover:border-[#93c5fd] hover:bg-white active:scale-[0.985] focus:outline-none focus:ring-4 focus:ring-[#1e3a8a]/10 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 sm:flex-none"
                >
                  Usar otro correo
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-[#e5ebf7] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.045)] dark:border-slate-700 dark:bg-slate-900">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef4ff] text-[#102d92] shadow-[0_8px_18px_rgba(37,99,235,0.08)] dark:bg-blue-500/15 dark:text-blue-200">
                  <Headset size={19} aria-hidden="true" />
                </div>
                <p className="min-w-0 text-sm font-black leading-5 text-slate-950 dark:text-slate-100">
                  ¿Sigues teniendo problemas?
                </p>
              </div>
              <a
                href="mailto:soporte@cafesmart.com?subject=Ayuda%20con%20recuperaci%C3%B3n%20de%20contrase%C3%B1a"
                className="inline-flex min-h-[42px] shrink-0 items-center justify-center rounded-[16px] border border-[#cdd8ef] bg-white px-4 text-[0.82rem] font-black text-[#102d92] shadow-[0_8px_18px_rgba(15,23,42,0.045)] transition hover:border-[#93c5fd] hover:bg-[#f5f9ff] active:scale-[0.985] focus:outline-none focus:ring-4 focus:ring-[#1e3a8a]/10 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                Contactar soporte
              </a>
            </div>

            <button
              type="button"
              onClick={handleBack}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[16px] border border-[#cdd8ef] bg-white px-4 text-[0.82rem] font-black text-[#102d92] shadow-[0_8px_18px_rgba(15,23,42,0.045)] transition hover:border-[#93c5fd] hover:bg-[#f5f9ff] active:scale-[0.985] focus:outline-none focus:ring-4 focus:ring-[#1e3a8a]/10 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              {returnLabel}
            </button>
          </section>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="mt-7 space-y-4">
            <div className="flex justify-center">
              <CafeSmartLogo size="md" compact />
            </div>
            <section className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[24px] bg-[#eaf2ff] text-[#102d92] shadow-[0_18px_38px_rgba(16,45,146,0.14)] ring-1 ring-[#bfdbfe] dark:bg-blue-500/15 dark:text-blue-200 dark:ring-blue-500/30">
                <Mail size={30} strokeWidth={2.3} aria-hidden="true" />
              </div>
              <p className="mx-auto max-w-[330px] text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
                Ingresa tu correo y te enviaremos un enlace para restablecer tu
                contraseña.
              </p>
            </section>
            <label className="block">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                Correo electrónico
              </span>
              <span className="relative mt-2 block">
                <Mail
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300"
                  aria-hidden="true"
                />
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="correo@empresa.com"
                  {...(error
                    ? ({ 'aria-invalid': 'true' } as const)
                    : ({ 'aria-invalid': 'false' } as const))}
                  className="h-12 w-full rounded-[14px] border border-[#dfe5f1] bg-white pl-10 pr-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#274ab8] focus:ring-4 focus:ring-[#274ab8]/10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
                />
              </span>
            </label>

            {error ? (
              <RecoveryErrorNotice
                message={error.message}
                code={error.code}
                onRetry={() => {
                  if (email.trim()) {
                    void reenviarEnlace();
                  }
                }}
              />
            ) : null}

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#102d92] px-4 text-sm font-black text-white shadow-[0_16px_30px_rgba(16,45,146,0.22)] transition hover:bg-[#18358f] active:scale-[0.985] focus:outline-none focus:ring-4 focus:ring-[#1e3a8a]/20 disabled:cursor-wait disabled:bg-[#9fb2d9] disabled:shadow-none"
            >
              {isLoading ? (
                <>
                  <Loader size={17} className="animate-spin" />
                  Enviando enlace...
                </>
              ) : (
                'Enviar enlace'
              )}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
