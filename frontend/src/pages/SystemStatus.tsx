import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Clock,
  Coffee,
  FileWarning,
  HelpCircle,
  Mail,
  MessageCircle,
  RotateCcw,
  ServerCrash,
  ShieldCheck,
  UserPlus,
  WifiOff,
  X,
} from 'lucide-react';
import { useUser } from '../context/UserContext';
import { authService, type AuthError, type AuthResponse } from '../services/authService';

type TipoOrg = 'COOPERATIVA' | 'COMPRAVENTA' | 'PERSONALIZADO';
type ProcessStatus = 'creating' | 'success' | 'error';

type RegisterProcessState = {
  hasGoogleFlow: boolean;
  googleToken?: string;
  nombreOrganizacion: string;
  tipoOrganizacion: TipoOrg;
  otroTipoDetalle?: string;
  nombre: string;
  telefono: string;
  correo: string;
  password: string;
};

type ErrorKind = 'connection' | 'email' | 'invalid' | 'server' | 'timeout';

type RegistrationErrorInfo = {
  kind: ErrorKind;
  title: string;
  message: string;
  solution: string;
  cardTitle: string;
  cardText: string;
  support?: boolean;
};

const SUCCESS_AUTO_REDIRECT_MS = 5200;
const CREATING_MIN_DURATION_MS = 2400;

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function StatusAnimations() {
  return (
    <style>
      {`
        @keyframes cafesmartFadeScale {
          0% { opacity: 0; transform: translateY(8px) scale(0.94); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes cafesmartFadeUp {
          0% { opacity: 0; transform: translateY(14px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes cafesmartLoadingFill {
          0% { width: 8%; }
          100% { width: 92%; }
        }

        @keyframes cafesmartPulseSoft {
          0%, 100% { transform: scale(1); box-shadow: 0 18px 40px rgba(37, 99, 235, 0.12); }
          50% { transform: scale(1.055); box-shadow: 0 24px 48px rgba(37, 99, 235, 0.18); }
        }

        @keyframes cafesmartSway {
          0%, 100% { transform: rotate(-2deg) translateX(0); }
          50% { transform: rotate(2deg) translateX(4px); }
        }

        @keyframes cafesmartPop {
          0% { opacity: 0; transform: scale(0.64); }
          72% { opacity: 1; transform: scale(1.08); }
          100% { opacity: 1; transform: scale(1); }
        }

        @keyframes cafesmartShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-2px); }
          80% { transform: translateX(2px); }
        }
      `}
    </style>
  );
}

function getRegistrationErrorInfo(error: AuthError): RegistrationErrorInfo {
  const field = (error.field ?? '').toLowerCase();
  const message = (error.message ?? '').toLowerCase();
  const status = error.status ?? 0;

  if (
    error.code === 'OFFLINE' ||
    message.includes('conexión') ||
    message.includes('conexion') ||
    message.includes('internet') ||
    message.includes('servidor')
  ) {
    return {
      kind: 'connection',
      title: 'No se pudo crear tu cuenta',
      message: 'No pudimos conectarnos al servidor.',
      solution: 'Verifica tu conexión a internet e intenta nuevamente.',
      cardTitle: 'Verifica tu conexión',
      cardText: 'Asegúrate de tener una conexión estable antes de intentarlo de nuevo.',
      support: true,
    };
  }

  if (message.includes('tardó') || message.includes('timeout') || message.includes('tiempo')) {
    return {
      kind: 'timeout',
      title: 'No se pudo crear tu cuenta',
      message: 'La solicitud tardó demasiado.',
      solution: 'Intenta nuevamente.',
      cardTitle: 'Tiempo de espera agotado',
      cardText: 'El servidor demoró más de lo esperado. Puedes reintentar sin perder tus datos.',
      support: true,
    };
  }

  if (
    field === 'email' ||
    field === 'correo' ||
    status === 409 ||
    message.includes('correo ya') ||
    message.includes('ya está registrado') ||
    message.includes('ya esta registrado')
  ) {
    return {
      kind: 'email',
      title: 'No se pudo crear tu cuenta',
      message: 'Este correo ya está registrado.',
      solution: 'Intenta iniciar sesión o usa otro correo.',
      cardTitle: 'Correo en uso',
      cardText: 'Puedes volver al formulario para cambiarlo o iniciar sesión con ese correo.',
    };
  }

  if (
    status === 400 ||
    status === 422 ||
    field.length > 0 ||
    message.includes('inválid') ||
    message.includes('invalid') ||
    message.includes('campo') ||
    message.includes('revisa')
  ) {
    return {
      kind: 'invalid',
      title: 'No se pudo crear tu cuenta',
      message: 'Algunos campos tienen errores.',
      solution: 'Revisa la información ingresada e inténtalo nuevamente.',
      cardTitle: 'Revisa los datos',
      cardText: error.message || 'Hay información que el servidor no pudo aceptar.',
    };
  }

  return {
    kind: 'server',
    title: 'No se pudo crear tu cuenta',
    message: 'Ocurrió un problema en el sistema.',
    solution: 'Intenta nuevamente en unos minutos.',
    cardTitle: 'Problema temporal',
    cardText: 'El sistema no pudo completar el registro ahora. Tus datos siguen en esta pantalla.',
    support: status >= 500,
  };
}

function StatusDecoration({ tone }: { tone: 'success' | 'error' }) {
  const plantColor = tone === 'success' ? '#86efac' : '#93c5fd';
  const leafColor = tone === 'success' ? '#4ade80' : '#60a5fa';

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44">
      <svg viewBox="0 0 430 190" className="absolute inset-x-0 bottom-0 h-full w-full" preserveAspectRatio="none">
        <path
          d="M0 84C53 54 104 73 151 105C203 140 251 142 304 116C350 94 386 90 430 112V190H0V84Z"
          fill="#dbeafe"
          opacity="0.85"
        />
        <path
          d="M0 123C60 93 108 111 164 142C219 171 258 146 307 126C358 104 393 122 430 137V190H0V123Z"
          fill="#bfdbfe"
          opacity="0.55"
        />
      </svg>
      <svg
        viewBox="0 0 95 145"
        className="absolute bottom-4 right-5 h-36 w-24 origin-bottom animate-[cafesmartSway_4.2s_ease-in-out_infinite]"
        fill="none"
      >
        <path d="M50 138C49 93 57 57 82 17" stroke={plantColor} strokeWidth="5" strokeLinecap="round" />
        <path d="M60 82C78 75 88 64 91 46C72 48 61 59 60 82Z" fill={plantColor} />
        <path d="M48 104C27 98 15 84 12 65C34 67 47 81 48 104Z" fill={plantColor} />
        <path d="M65 121C81 118 91 108 95 91C77 90 66 101 65 121Z" fill={leafColor} />
        <circle cx="55" cy="125" r="5" fill={leafColor} />
        <circle cx="70" cy="130" r="5" fill={leafColor} />
        <circle cx="62" cy="138" r="5" fill={leafColor} />
      </svg>
      <svg
        viewBox="0 0 72 78"
        className="absolute bottom-5 left-10 h-20 w-20 origin-bottom animate-[cafesmartSway_3.8s_ease-in-out_infinite]"
        fill="none"
        style={{ animationDelay: '0.35s' }}
      >
        <path d="M36 74C34 50 27 33 9 14" stroke={plantColor} strokeWidth="4" strokeLinecap="round" />
        <path d="M29 48C12 45 4 34 2 20C19 22 28 33 29 48Z" fill={plantColor} />
        <path d="M40 55C55 51 64 41 67 27C51 27 41 39 40 55Z" fill={leafColor} />
      </svg>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-white text-[#1d9bf0] shadow-[0_14px_32px_rgba(37,99,235,0.12)]">
        <Coffee size={38} strokeWidth={2.4} />
      </div>
      <p className="mt-3 text-[1.7rem] font-black tracking-tight">
        <span className="text-[#0f172a]">Café</span>
        <span className="text-[#1d9bf0]">Smart</span>
      </p>
    </div>
  );
}

function SuccessStatusView({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f8fbff] px-5 py-8 text-slate-900">
      <StatusAnimations />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col items-center justify-center pb-28 text-center">
        <div className="relative animate-[cafesmartPop_520ms_cubic-bezier(.2,1.35,.3,1)_both]">
          <div className="absolute -inset-8 rounded-full bg-emerald-100/75" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_18px_42px_rgba(16,185,129,0.28)]">
            <Check size={52} strokeWidth={3.2} />
          </div>
        </div>

        <div className="mt-10 animate-[cafesmartFadeUp_650ms_ease-out_120ms_both]">
          <BrandMark />
        </div>

        <div className="mt-8 animate-[cafesmartFadeUp_650ms_ease-out_220ms_both]">
          <h1 className="text-[2rem] font-black leading-tight tracking-tight text-[#0f172a]">
            ¡Cuenta creada
            <span className="block text-emerald-600">correctamente!</span>
          </h1>
          <p className="mx-auto mt-5 max-w-[330px] text-[1rem] font-medium leading-7 text-slate-600">
            Tu cuenta ha sido creada con éxito. Ya puedes empezar a gestionar tu negocio cafetero.
          </p>
        </div>

        <div className="mt-8 flex w-full max-w-[360px] items-center gap-4 rounded-3xl bg-emerald-50 p-5 text-left shadow-[0_18px_38px_rgba(16,185,129,0.08)] animate-[cafesmartFadeUp_650ms_ease-out_340ms_both]">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-600">
            <ShieldCheck size={36} strokeWidth={2.2} />
          </div>
          <div>
            <p className="text-[1rem] font-black text-[#0f172a]">Todo listo para empezar</p>
            <p className="mt-1 text-sm font-medium leading-6 text-slate-600">
              Explora todas las herramientas que CaféSmart tiene para ti.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="mt-10 inline-flex min-h-[58px] w-full max-w-[360px] items-center justify-center gap-3 rounded-2xl bg-[#1683f7] px-5 py-4 text-[1.1rem] font-black text-white shadow-[0_16px_32px_rgba(22,131,247,0.28)] transition-transform active:scale-[0.98]"
        >
          Ir a mi panel
          <ArrowRight size={22} />
        </button>
      </div>
      <StatusDecoration tone="success" />
    </div>
  );
}

function getErrorIcon(kind: ErrorKind) {
  if (kind === 'connection') return <WifiOff size={34} strokeWidth={2.4} />;
  if (kind === 'email') return <Mail size={34} strokeWidth={2.4} />;
  if (kind === 'invalid') return <FileWarning size={34} strokeWidth={2.4} />;
  if (kind === 'timeout') return <Clock size={34} strokeWidth={2.4} />;
  return <ServerCrash size={34} strokeWidth={2.4} />;
}

function ErrorStatusView({
  info,
  onRetry,
  onBack,
}: {
  info: RegistrationErrorInfo;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#fffafa] px-5 py-8 text-slate-900">
      <StatusAnimations />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] flex-col items-center justify-center pb-28 text-center">
        <div className="relative animate-[cafesmartShake_520ms_ease-in-out_both]">
          <div className="absolute -inset-8 rounded-full bg-red-100/80" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-red-500 text-white shadow-[0_18px_42px_rgba(239,68,68,0.28)]">
            <X size={52} strokeWidth={3.2} />
          </div>
        </div>

        <div className="mt-10 animate-[cafesmartFadeUp_650ms_ease-out_120ms_both]">
          <BrandMark />
        </div>

        <div className="mt-8 animate-[cafesmartFadeUp_650ms_ease-out_220ms_both]">
          <h1 className="text-[2rem] font-black leading-tight tracking-tight text-[#0f172a]">
            No se pudo crear
            <span className="block text-red-600">tu cuenta</span>
          </h1>
          <p className="mx-auto mt-5 max-w-[340px] text-[1rem] font-medium leading-7 text-slate-600">
            {info.message} {info.solution}
          </p>
        </div>

        <div className="mt-8 flex w-full max-w-[360px] items-center gap-4 rounded-3xl bg-red-50 p-5 text-left shadow-[0_18px_38px_rgba(239,68,68,0.08)] animate-[cafesmartFadeUp_650ms_ease-out_340ms_both]">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-red-500">
            {getErrorIcon(info.kind)}
          </div>
          <div>
            <p className="text-[1rem] font-black text-[#0f172a]">{info.cardTitle}</p>
            <p className="mt-1 text-sm font-medium leading-6 text-slate-600">
              {info.cardText}
            </p>
          </div>
        </div>

        <div className="mt-10 grid w-full max-w-[360px] gap-3">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-[58px] items-center justify-center gap-3 rounded-2xl bg-[#1683f7] px-5 py-4 text-[1.05rem] font-black text-white shadow-[0_16px_32px_rgba(22,131,247,0.28)] transition-transform active:scale-[0.98]"
          >
            <RotateCcw size={21} />
            Intentar nuevamente
          </button>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-[54px] items-center justify-center rounded-2xl border border-[#1683f7] bg-white px-5 py-3 text-[1.05rem] font-black text-[#1683f7] transition-transform active:scale-[0.98]"
          >
            Volver
          </button>
          {info.support ? (
            <button
              type="button"
              onClick={() => window.open('mailto:soporte@cafesmart.com?subject=Soporte%20registro%20CafeSmart', '_self')}
              className="text-sm font-bold text-slate-500 underline underline-offset-4"
            >
              Contactar soporte
            </button>
          ) : null}
        </div>
      </div>
      <StatusDecoration tone="error" />
    </div>
  );
}

function WelcomeView({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#07132f_0%,#0b1e52_35%,#08142f_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_24%,rgba(113,149,255,0.32)_0%,rgba(113,149,255,0)_42%)]" />
      <div className="absolute -left-20 top-12 h-72 w-72 rounded-full bg-[#2d7cff]/20 blur-3xl" />
      <div className="absolute -right-16 top-0 h-80 w-80 rounded-full bg-[#54d2ff]/18 blur-3xl" />
      <div className="absolute inset-x-0 bottom-[-8rem] mx-auto h-80 w-[36rem] rounded-full bg-[#0a2f73]/55 blur-3xl" />
      <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.85)_1px,transparent_0)] [background-size:28px_28px]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[520px] flex-col px-4 py-5">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/22 bg-white/14 px-5 py-2.5 backdrop-blur">
          <Coffee size={18} className="text-white/90" />
          <span className="text-[1.95rem] font-black tracking-tight text-white">Cafe Smart</span>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center pt-4">
          <div className="relative mt-1">
            <div className="cafesmart-pulse-ring absolute -inset-4 rounded-full border border-[#74a7ff59]" />
            <div
              className="cafesmart-pulse-ring absolute -inset-9 rounded-full border border-dashed border-[#71a2ff63]"
              style={{ animationDelay: '0.7s' }}
            />
            <div className="relative flex h-[258px] w-[258px] items-center justify-center">
              <div className="absolute inset-[18%] rounded-full bg-[#80c6ff]/18 blur-3xl" aria-hidden="true" />
              <img
                src="/imagenes-de-proyecto/granito-inteligente.png"
                alt="Granito inteligente de Cafe Smart"
                className="cafesmart-float relative h-[250px] w-[250px] object-contain drop-shadow-[0_28px_50px_rgba(6,10,28,0.45)]"
              />
            </div>
          </div>

          <div className="mt-6 w-full max-w-[460px] rounded-[30px] border border-[#70a2ff42] bg-[linear-gradient(180deg,rgba(15,34,88,0.35)_0%,rgba(13,27,70,0.4)_100%)] px-5 py-5 backdrop-blur-sm">
            <h1 className="text-center text-[2.35rem] font-black leading-[1.04] tracking-tight text-white">
              Bienvenido a
              <span className="block bg-[linear-gradient(180deg,#b8e4ff_0%,#5db9ff_100%)] bg-clip-text text-transparent">
                Cafe Smart
              </span>
            </h1>

            <p className="mt-3 text-center text-[1rem] leading-7 text-[#e0e8ff]">
              Controla tu café en un solo lugar con precisión.
            </p>

            <button
              type="button"
              onClick={onStart}
              className="mt-6 inline-flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[22px] bg-[#1240c7] px-6 py-3 text-[1.5rem] font-black text-white shadow-[0_18px_40px_rgba(13,70,222,0.5)]"
            >
              Comenzar ahora
              <ArrowRight size={20} />
            </button>
          </div>

          <div className="mt-4 grid w-full max-w-[460px] grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => window.open('mailto:soporte@cafesmart.com?subject=Ayuda%20Cafe%20Smart', '_self')}
              className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-2xl border border-white/28 bg-[#0d162fcc] px-4 text-[1.06rem] font-bold text-white backdrop-blur"
            >
              <HelpCircle size={18} />
              Ayuda
            </button>
            <button
              type="button"
              onClick={() =>
                window.open('mailto:soporte@cafesmart.com?subject=Contacto%20Cafe%20Smart', '_self')
              }
              className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-2xl border border-white/28 bg-[#0d162fcc] px-4 text-[1.06rem] font-bold text-white backdrop-blur"
            >
              <MessageCircle size={18} />
              Contáctenos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreatingAccountView() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f8fbff] px-5 py-8 text-slate-900">
      <style>
        {`
          @keyframes cafesmartFadeScale {
            0% { opacity: 0; transform: translateY(8px) scale(0.94); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }

          @keyframes cafesmartFadeUp {
            0% { opacity: 0; transform: translateY(14px); }
            100% { opacity: 1; transform: translateY(0); }
          }

          @keyframes cafesmartLoadingFill {
            0% { width: 8%; }
            100% { width: 92%; }
          }

          @keyframes cafesmartPulseSoft {
            0%, 100% { transform: scale(1); box-shadow: 0 18px 40px rgba(37, 99, 235, 0.12); }
            50% { transform: scale(1.055); box-shadow: 0 24px 48px rgba(37, 99, 235, 0.18); }
          }

          @keyframes cafesmartSway {
            0%, 100% { transform: rotate(-2deg) translateX(0); }
            50% { transform: rotate(2deg) translateX(4px); }
          }
        `}
      </style>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[460px] flex-col items-center justify-center pb-28">
        <div className="animate-[cafesmartFadeScale_600ms_ease-out_both] text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-white text-[#1d4ed8] shadow-[0_18px_42px_rgba(37,99,235,0.14)]">
            <Coffee size={46} strokeWidth={2.4} />
          </div>
          <p className="mt-4 text-[2rem] font-black tracking-tight">
            <span className="text-[#0f172a]">Café</span>
            <span className="text-[#1d9bf0]">Smart</span>
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Gestiona tu negocio cafetero
          </p>
        </div>

        <div className="mt-14 animate-[cafesmartFadeUp_650ms_ease-out_180ms_both] text-center">
          <div className="relative mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-blue-50 text-[#1d4ed8] animate-[cafesmartPulseSoft_2.4s_ease-in-out_infinite]">
            <span className="absolute -left-5 top-5 h-3 w-3 rounded-full border-2 border-blue-200" />
            <span className="absolute -right-5 top-1 h-3 w-3 rotate-45 rounded-[4px] border-2 border-blue-200" />
            <span className="absolute -bottom-2 left-2 h-2 w-2 rotate-45 rounded-[3px] border-2 border-blue-200" />
            <UserPlus size={54} strokeWidth={2.2} />
          </div>

          <h1 className="mt-8 text-[1.65rem] font-black tracking-tight text-[#0f172a]">
            Creando tu cuenta
          </h1>
          <p className="mx-auto mt-3 max-w-[330px] text-[1rem] font-medium leading-7 text-slate-600">
            Estamos configurando todo para que puedas empezar a gestionar tu negocio.
          </p>
        </div>

        <div className="mt-10 w-full max-w-[360px] animate-[cafesmartFadeUp_650ms_ease-out_340ms_both]">
          <div className="h-3 w-full overflow-hidden rounded-full bg-blue-100">
            <div className="h-full rounded-full bg-[#1683f7] animate-[cafesmartLoadingFill_2.6s_ease-in-out_forwards]" />
          </div>
          <p className="mt-4 text-center text-[1.05rem] font-black text-[#1683f7]">
            Configurando...
          </p>
        </div>

        <div className="mt-10 flex w-full max-w-[360px] items-center gap-4 rounded-3xl bg-blue-50/90 p-5 shadow-[0_18px_38px_rgba(37,99,235,0.08)] animate-[cafesmartFadeUp_650ms_ease-out_480ms_both]">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1683f7] shadow-[0_10px_24px_rgba(37,99,235,0.1)]">
            <ShieldCheck size={36} strokeWidth={2.2} />
          </div>
          <div>
            <p className="text-[1rem] font-black text-[#0f172a]">Tu información está segura</p>
            <p className="mt-1 text-sm font-medium leading-6 text-slate-600">
              Protegemos tus datos para que puedas enfocarte en lo que más importa.
            </p>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 text-blue-100">
        <svg viewBox="0 0 430 190" className="absolute inset-x-0 bottom-0 h-full w-full" preserveAspectRatio="none">
          <path
            d="M0 84C53 54 104 73 151 105C203 140 251 142 304 116C350 94 386 90 430 112V190H0V84Z"
            fill="#dbeafe"
            opacity="0.85"
          />
          <path
            d="M0 123C60 93 108 111 164 142C219 171 258 146 307 126C358 104 393 122 430 137V190H0V123Z"
            fill="#bfdbfe"
            opacity="0.55"
          />
        </svg>
        <svg
          viewBox="0 0 95 145"
          className="absolute bottom-4 right-5 h-36 w-24 origin-bottom animate-[cafesmartSway_4.2s_ease-in-out_infinite]"
          fill="none"
        >
          <path d="M50 138C49 93 57 57 82 17" stroke="#7db5f5" strokeWidth="5" strokeLinecap="round" />
          <path d="M60 82C78 75 88 64 91 46C72 48 61 59 60 82Z" fill="#93c5fd" />
          <path d="M48 104C27 98 15 84 12 65C34 67 47 81 48 104Z" fill="#93c5fd" />
          <path d="M65 121C81 118 91 108 95 91C77 90 66 101 65 121Z" fill="#60a5fa" />
          <circle cx="55" cy="125" r="5" fill="#60a5fa" />
          <circle cx="70" cy="130" r="5" fill="#60a5fa" />
          <circle cx="62" cy="138" r="5" fill="#60a5fa" />
        </svg>
        <svg
          viewBox="0 0 72 78"
          className="absolute bottom-5 left-10 h-20 w-20 origin-bottom animate-[cafesmartSway_3.8s_ease-in-out_infinite]"
          fill="none"
          style={{ animationDelay: '0.35s' }}
        >
          <path d="M36 74C34 50 27 33 9 14" stroke="#93c5fd" strokeWidth="4" strokeLinecap="round" />
          <path d="M29 48C12 45 4 34 2 20C19 22 28 33 29 48Z" fill="#93c5fd" />
          <path d="M40 55C55 51 64 41 67 27C51 27 41 39 40 55Z" fill="#60a5fa" />
        </svg>
      </div>
    </div>
  );
}

export default function SystemStatus() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setSession, token, hasCompany, hydrated } = useUser();

  const processState = useMemo(
    () => (location.state ?? null) as RegisterProcessState | null,
    [location.state],
  );

  const [status, setStatus] = useState<ProcessStatus>('creating');
  const [errorInfo, setErrorInfo] = useState<RegistrationErrorInfo>({
    kind: 'connection',
    title: 'No se pudo crear tu cuenta',
    message: 'No pudimos conectarnos al servidor.',
    solution: 'Verifica tu conexión a internet e intenta nuevamente.',
    cardTitle: 'Verifica tu conexión',
    cardText: 'Asegúrate de tener una conexión estable antes de intentarlo de nuevo.',
    support: true,
  });
  const registrationStartedRef = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    if (token && hasCompany && !processState) {
      navigate('/inicio', { replace: true });
    }
  }, [hasCompany, hydrated, navigate, processState, token]);

  const executeRegistration = useCallback(
    async (force = false) => {
      if (registrationStartedRef.current && !force) return;
      registrationStartedRef.current = true;
      const startedAt = Date.now();

      if (!processState) {
        if (token && hasCompany) {
          navigate('/inicio', { replace: true });
        } else {
          navigate('/crear-empresa', { replace: true });
        }
        return;
      }

      setStatus('creating');

      try {
        let response: AuthResponse;

        if (processState.hasGoogleFlow && processState.googleToken) {
          response = await authService.registerWithGoogle({
            googleToken: processState.googleToken,
            correo: processState.correo,
            nombre: processState.nombre,
            telefono: processState.telefono,
            password: processState.password,
            nombreOrganizacion: processState.nombreOrganizacion,
            tipoOrganizacion: processState.tipoOrganizacion,
            otroTipoDetalle:
              processState.tipoOrganizacion === 'OTRO' ? processState.otroTipoDetalle : undefined,
          });
        } else {
          response = await authService.register({
            nombreOrganizacion: processState.nombreOrganizacion,
            tipoOrganizacion: processState.tipoOrganizacion,
            otroTipoDetalle:
              processState.tipoOrganizacion === 'OTRO' ? processState.otroTipoDetalle : undefined,
            nombre: processState.nombre,
            telefono: processState.telefono,
            correo: processState.correo,
            password: processState.password,
          });
        }

        await setSession({
          user: {
            id: response.user.id,
            email: response.user.email,
            name: response.user.name,
            telefono: response.user.telefono ?? processState.telefono,
            organizacionId: response.user.organizacionId ?? null,
            nombreOrganizacion:
              response.user.nombreOrganizacion ?? processState.nombreOrganizacion,
            tipoOrganizacion: response.user.tipoOrganizacion ?? null,
            otroTipoDetalle: response.user.otroTipoDetalle ?? null,
          },
          token: response.access_token,
          hasCompany: response.hasCompany,
        });

        await wait(Math.max(0, CREATING_MIN_DURATION_MS - (Date.now() - startedAt)));
        setStatus('success');
      } catch (err) {
        const authError = err as AuthError;

        await wait(Math.max(0, CREATING_MIN_DURATION_MS - (Date.now() - startedAt)));
        registrationStartedRef.current = false;
        setStatus('error');
        setErrorInfo(getRegistrationErrorInfo(authError));
      }
    },
    [hasCompany, navigate, processState, setSession, token],
  );

  useEffect(() => {
    void executeRegistration();
  }, [executeRegistration]);

  useEffect(() => {
    if (status !== 'success') return;

    const timer = window.setTimeout(() => {
      navigate('/inicio', { replace: true });
    }, SUCCESS_AUTO_REDIRECT_MS);

    return () => window.clearTimeout(timer);
  }, [navigate, status]);

  if (status === 'success') {
    return <SuccessStatusView onStart={() => navigate('/inicio', { replace: true })} />;
  }

  if (status === 'creating') {
    return <CreatingAccountView />;
  }

  return (
    <ErrorStatusView
      info={errorInfo}
      onRetry={() => {
        setStatus('creating');
        void executeRegistration(true);
      }}
      onBack={() =>
        navigate('/register', {
          replace: true,
          state: processState ? { registerDraft: processState } : undefined,
        })
      }
    />
  );
}
