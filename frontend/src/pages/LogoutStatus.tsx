import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CafeSmartLogo } from '../components/CafeSmartLogo';
import { useUser } from '../context/UserContext';

const MIN_LOGOUT_DURATION_MS = 2200;
const LOGIN_FADE_DELAY_MS = 280;

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function LogoutAnimations() {
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

        @keyframes cafesmartFadeOut {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-6px); }
        }

        @keyframes cafesmartSteam {
          0%, 100% { opacity: .58; transform: translateY(0) scaleX(1); }
          50% { opacity: 1; transform: translateY(-5px) scaleX(.96); }
        }

        @keyframes cafesmartSpin {
          to { transform: rotate(360deg); }
        }

        @keyframes cafesmartSway {
          0%, 100% { transform: rotate(-2deg) translateX(0); }
          50% { transform: rotate(2deg) translateX(4px); }
        }

        @keyframes cafesmartPulseSoft {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.045); }
        }
      `}
    </style>
  );
}

function CoffeePlant({
  className,
  delay = '0s',
}: {
  className: string;
  delay?: string;
}) {
  return (
    <svg
      viewBox="0 0 96 140"
      className={className}
      fill="none"
      style={{ animationDelay: delay }}
      aria-hidden="true"
    >
      <path d="M48 134C45 92 52 56 75 17" stroke="#86bfff" strokeWidth="5" strokeLinecap="round" />
      <path d="M49 96C28 90 16 76 14 58C35 60 49 75 49 96Z" fill="#9ccaff" />
      <path d="M57 78C77 73 89 61 91 43C71 43 58 58 57 78Z" fill="#7db5ff" />
      <path d="M60 116C77 112 88 101 91 84C73 84 61 98 60 116Z" fill="#9ccaff" />
      <circle cx="55" cy="119" r="5" fill="#7db5ff" />
      <circle cx="69" cy="126" r="5" fill="#7db5ff" />
    </svg>
  );
}

function BottomDecoration() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[190px] overflow-hidden">
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
      <CoffeePlant className="absolute bottom-3 left-8 h-24 w-20 origin-bottom opacity-85 animate-[cafesmartSway_4s_ease-in-out_infinite]" />
      <CoffeePlant
        className="absolute bottom-3 right-5 h-36 w-24 origin-bottom opacity-90 animate-[cafesmartSway_4.8s_ease-in-out_infinite]"
        delay="0.35s"
      />
    </div>
  );
}

function SidePlants() {
  return (
    <>
      <CoffeePlant className="absolute -left-8 bottom-0 h-24 w-20 origin-bottom opacity-60 animate-[cafesmartSway_4.3s_ease-in-out_infinite]" />
      <CoffeePlant
        className="absolute -right-9 bottom-0 h-28 w-20 origin-bottom opacity-60 animate-[cafesmartSway_4.9s_ease-in-out_infinite]"
        delay="0.25s"
      />
    </>
  );
}

export default function LogoutStatus() {
  const navigate = useNavigate();
  const { logout } = useUser();
  const [status, setStatus] = useState<'loading' | 'error' | 'leaving'>('loading');
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const closeSession = async () => {
      const startedAt = Date.now();

      try {
        await logout();
        await wait(Math.max(0, MIN_LOGOUT_DURATION_MS - (Date.now() - startedAt)));
        setStatus('leaving');
        await wait(LOGIN_FADE_DELAY_MS);
        navigate('/login', { replace: true });
      } catch {
        await wait(Math.max(0, MIN_LOGOUT_DURATION_MS - (Date.now() - startedAt)));
        setStatus('error');
      }
    };

    void closeSession();
  }, [logout, navigate]);

  const isError = status === 'error';

  return (
    <main
      className={`relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-[#f8fbff] px-5 py-7 text-[#07153b] ${
        status === 'leaving' ? 'animate-[cafesmartFadeOut_280ms_ease-in_both]' : ''
      }`}
      aria-busy={!isError}
      aria-live="polite"
    >
      <LogoutAnimations />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 16%, rgba(47,128,237,0.09), transparent 30%), linear-gradient(180deg,#ffffff 0%,#f8fbff 60%,#eef5ff 100%)',
        }}
      />

      <section className="relative z-10 flex min-h-[calc(100dvh-3.5rem)] w-full max-w-[430px] flex-col items-center pb-28 text-center">
        <div className="animate-[cafesmartFadeScale_300ms_ease-out_both]">
          <CafeSmartLogo size="sm" compact />
        </div>

        <div className="relative mt-8 animate-[cafesmartFadeUp_420ms_ease-out_100ms_both]">
          <div className="absolute inset-x-0 top-2 mx-auto h-32 w-32 rounded-full bg-[#e9f3ff] animate-[cafesmartPulseSoft_2.8s_ease-in-out_infinite]" />
          <SidePlants />
          <div className="relative flex h-36 w-36 items-center justify-center rounded-full bg-[#eef6ff] shadow-[0_22px_54px_rgba(37,99,235,0.12)]">
            {isError ? (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-rose-500 shadow-[0_16px_34px_rgba(244,63,94,0.12)]">
                <AlertTriangle size={42} strokeWidth={2.4} />
              </div>
            ) : (
              <CafeSmartLogo size="md" showText={false} showSubtitle={false} />
            )}
          </div>
        </div>

        <div className="mt-8 animate-[cafesmartFadeUp_420ms_ease-out_180ms_both]">
          <h1 className="text-[1.55rem] font-black leading-tight text-[#07153b]">
            {isError ? 'No pudimos cerrar sesión' : 'Cerrando sesión...'}
          </h1>
          <p className="mx-auto mt-3 max-w-[310px] text-sm font-semibold leading-6 text-slate-500">
            {isError
              ? 'Ocurrió un problema al cerrar tu sesión. Intenta nuevamente en unos segundos.'
              : 'Por favor espera un momento mientras cerramos tu sesión de forma segura.'}
          </p>
        </div>

        {!isError ? (
          <div className="mt-7 animate-[cafesmartFadeUp_420ms_ease-out_260ms_both]">
            <div className="mx-auto h-12 w-12 rounded-full border-[4px] border-blue-100 border-t-[#1683f7] animate-[cafesmartSpin_850ms_linear_infinite]" />
            <p className="mt-4 text-xs font-black text-[#7da9e8]">Protegiendo tu información...</p>
          </div>
        ) : null}

        <div className="mt-7 flex w-full max-w-[330px] items-center gap-3 rounded-[22px] bg-[#eef6ff] p-4 text-left shadow-[0_18px_38px_rgba(37,99,235,0.08)] animate-[cafesmartFadeUp_420ms_ease-out_340ms_both]">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1683f7] shadow-[0_10px_24px_rgba(37,99,235,0.08)]">
            <ShieldCheck size={25} strokeWidth={2.3} />
          </div>
          <div>
            <p className="text-sm font-black text-[#07153b]">Tu seguridad es importante</p>
            <p className="mt-1 text-[0.78rem] font-semibold leading-5 text-slate-500">
              {isError
                ? 'Tus datos siguen protegidos. Revisaremos el cierre cuando lo intentes de nuevo.'
                : 'Hemos cerrado tu sesión correctamente. Gracias por usar CaféSmart.'}
            </p>
          </div>
        </div>
      </section>

      <BottomDecoration />
    </main>
  );
}
