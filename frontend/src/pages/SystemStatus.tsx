import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { HelpCircle, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { useUser } from '../context/UserContext';
import {
  authService,
  type AuthError,
  type AuthResponse,
} from '../services/authService';
import { CafeSmartErrorState } from '../components/CafeSmartErrorState';
import { CafeSmartLogo } from '../components/CafeSmartLogo';

type TipoOrg = 'COOPERATIVA' | 'COMPRAVENTA' | 'PERSONALIZADO';
type ProcessStatus = 'creating' | 'success' | 'error';
type SuccessStage = 'confirm' | 'welcome';

type RegisterProcessState = {
  hasGoogleFlow: boolean;
  googleToken?: string;
  nombreOrganizacion: string;
  descripcionOrganizacion?: string;
  tipoOrganizacion: TipoOrg;
  otroTipoDetalle?: string;
  nombre: string;
  telefono: string;
  correo: string;
  password: string;
};

const CONFIRMATION_DURATION_MS = 1700;
const REGISTER_DRAFT_STORAGE_KEY = 'cafesmart:register-draft:v1';

function toAuthTipoOrganizacion(
  tipo: TipoOrg,
): 'COOPERATIVA' | 'COMPRAVENTA' | 'OTRO' {
  return tipo === 'PERSONALIZADO' ? 'OTRO' : tipo;
}

function ConfirmSuccessView() {
  return (
    <CafeSmartErrorState
      fullScreen
      variant="success"
      title="Cuenta creada"
      message="Preparando tu inicio en CaféSmart..."
      info="Tu espacio quedó configurado correctamente."
    />
  );
}

function WelcomeView({ onStart }: { onStart: () => void }) {
  return (
    <CafeSmartErrorState
      fullScreen
      variant="success"
      title="Bienvenido a CaféSmart"
      message="Tu empresa quedó lista para empezar a registrar compras, secado y ventas."
      primaryLabel="Comenzar ahora"
      onPrimary={onStart}
      info="Puedes comenzar a trabajar con tu información ya protegida en el sistema."
      extraAction={
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() =>
              window.open(
                'mailto:soporte@cafesmart.com?subject=Ayuda%20Cafe%20Smart',
                '_self',
              )
            }
            className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-[12px] border border-[#dfe5f1] bg-white/85 px-3 text-xs font-black text-[#536178] transition hover:bg-white hover:text-[#1e3a8a]"
          >
            <HelpCircle size={15} aria-hidden="true" />
            Ayuda
          </button>
          <button
            type="button"
            onClick={() =>
              window.open(
                'mailto:soporte@cafesmart.com?subject=Contacto%20Cafe%20Smart',
                '_self',
              )
            }
            className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-[12px] border border-[#dfe5f1] bg-white/85 px-3 text-xs font-black text-[#536178] transition hover:bg-white hover:text-[#1e3a8a]"
          >
            <MessageCircle size={15} aria-hidden="true" />
            Contacto
          </button>
        </div>
      }
    />
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
  const [successStage, setSuccessStage] = useState<SuccessStage>('confirm');
  const [errorMessage, setErrorMessage] = useState(
    'No pudimos procesar tu solicitud. Revisa tu conexión e inténtalo nuevamente.',
  );
  const [errorTitle, setErrorTitle] = useState('Sin conexión');
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

      if (!processState) {
        if (token && hasCompany) {
          navigate('/inicio', { replace: true });
        } else {
          navigate('/crear-empresa', { replace: true });
        }
        return;
      }

      setStatus('creating');
      setSuccessStage('confirm');
      setErrorTitle('Sin conexión');
      setErrorMessage(
        'No pudimos procesar tu solicitud. Revisa tu conexión e inténtalo nuevamente.',
      );

      try {
        let response: AuthResponse;
        console.log(
          '[CafeSmart][register-submit] payload:',
          JSON.stringify(
            {
              email: processState.correo,
              nombre: processState.nombre,
              telefono: processState.telefono,
              tipoOrganizacion: toAuthTipoOrganizacion(
                processState.tipoOrganizacion,
              ),
              nombreOrganizacion: processState.nombreOrganizacion,
              hasPassword: Boolean(processState.password),
              hasGoogleFlow: Boolean(
                processState.hasGoogleFlow && processState.googleToken,
              ),
            },
            null,
            2,
          ),
        );

        if (processState.hasGoogleFlow && processState.googleToken) {
          response = await authService.registerWithGoogle({
            googleToken: processState.googleToken,
            correo: processState.correo,
            nombre: processState.nombre,
            telefono: processState.telefono,
            password: processState.password,
            nombreOrganizacion: processState.nombreOrganizacion,
            descripcionOrganizacion: processState.descripcionOrganizacion,
            tipoOrganizacion: toAuthTipoOrganizacion(
              processState.tipoOrganizacion,
            ),
            otroTipoDetalle:
              processState.tipoOrganizacion === 'PERSONALIZADO'
                ? processState.otroTipoDetalle
                : undefined,
          });
        } else {
          response = await authService.register({
            nombreOrganizacion: processState.nombreOrganizacion,
            descripcionOrganizacion: processState.descripcionOrganizacion,
            tipoOrganizacion: toAuthTipoOrganizacion(
              processState.tipoOrganizacion,
            ),
            otroTipoDetalle:
              processState.tipoOrganizacion === 'PERSONALIZADO'
                ? processState.otroTipoDetalle
                : undefined,
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
            organizacionId: response.user.organizacionId ?? null,
            nombreOrganizacion:
              response.user.nombreOrganizacion ?? processState.nombreOrganizacion,
            tipoOrganizacion: response.user.tipoOrganizacion ?? null,
            otroTipoDetalle: response.user.otroTipoDetalle ?? null,
            descripcionOrganizacion:
              response.user.descripcionOrganizacion ??
              processState.descripcionOrganizacion ??
              null,
          },
          token: response.access_token,
          hasCompany: response.hasCompany,
        });

        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(REGISTER_DRAFT_STORAGE_KEY);
        }

        setStatus('success');
        setSuccessStage('confirm');
      } catch (err) {
        const authError = err as AuthError;
        const field = (authError.field ?? '').toLowerCase();
        console.error('[CafeSmart][register-submit] error:', {
          name: err instanceof Error ? err.name : typeof err,
          status: authError.status ?? null,
          code: authError.code ?? authError.apiCode ?? null,
          message: authError.message ?? null,
          field: authError.field ?? null,
          details: authError.details ?? null,
        });

        registrationStartedRef.current = false;
        setStatus('error');
        setSuccessStage('confirm');

        if (field === 'email' || field === 'correo') {
          setErrorTitle('No se pudo crear la cuenta');
        } else {
          setErrorTitle('No pudimos crear la cuenta');
        }

        setErrorMessage(
          authError.message ||
            'No pudimos procesar tu solicitud. Revisa tu conexión e inténtalo nuevamente.',
        );
      }
    },
    [hasCompany, navigate, processState, setSession, token],
  );

  useEffect(() => {
    void executeRegistration();
  }, [executeRegistration]);

  useEffect(() => {
    if (status !== 'success' || successStage !== 'confirm') return;

    const timer = window.setTimeout(() => {
      setSuccessStage('welcome');
    }, CONFIRMATION_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [status, successStage]);

  if (status === 'success' && successStage === 'confirm') {
    return <ConfirmSuccessView />;
  }

  if (status === 'success' && successStage === 'welcome') {
    return (
      <WelcomeView onStart={() => navigate('/inicio', { replace: true })} />
    );
  }

  if (status === 'error') {
    return (
      <CafeSmartErrorState
        fullScreen
        title={errorTitle}
        message={errorMessage}
        info="La información que escribiste se mantiene segura. Puedes intentarlo nuevamente o volver al inicio."
        onPrimary={() => void executeRegistration(true)}
        onSecondary={() => navigate('/inicio', { replace: true })}
      />
    );
  }

  return (
    <main
      className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-[#f8fbff] px-5 py-7 text-[#07153b]"
      aria-busy="true"
      aria-live="polite"
    >
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

          @keyframes cafesmartSteam {
            0%, 100% { opacity: .58; transform: translateY(0) scaleX(1); }
            50% { opacity: 1; transform: translateY(-5px) scaleX(.96); }
          }

          @keyframes cafesmartProgress {
            0% { transform: translateX(-64%) scaleX(.42); opacity: .65; }
            50% { transform: translateX(12%) scaleX(.72); opacity: 1; }
            100% { transform: translateX(124%) scaleX(.42); opacity: .65; }
          }

          @keyframes cafesmartFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-7px); }
          }

          @keyframes cafesmartGlowBreath {
            0%, 100% { opacity: .54; transform: scale(.96); }
            50% { opacity: .95; transform: scale(1.07); }
          }

          @keyframes cafesmartSway {
            0%, 100% { transform: rotate(-2deg) translateX(0); }
            50% { transform: rotate(2deg) translateX(4px); }
          }

          @keyframes cafesmartPulseSoft {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.045); }
          }

          .bg-cafesmart-status {
            background: radial-gradient(circle at 50% 16%, rgba(47,128,237,0.09), transparent 30%), linear-gradient(180deg,#ffffff 0%,#f8fbff 60%,#eef5ff 100%);
          }
        `}
      </style>
      <div className="pointer-events-none absolute inset-0 bg-cafesmart-status" />

      <section className="relative z-10 flex min-h-[calc(100dvh-3.5rem)] w-full max-w-[430px] flex-col items-center pb-28 text-center">
        <div className="animate-[cafesmartFadeScale_300ms_ease-out_both]">
          <CafeSmartLogo size="sm" compact />
        </div>

        <div className="relative mt-8 animate-[cafesmartFadeUp_420ms_ease-out_100ms_both]">
          <div className="absolute inset-x-0 top-2 mx-auto h-36 w-36 rounded-full bg-[#e9f3ff] animate-[cafesmartPulseSoft_2.8s_ease-in-out_infinite]" />
          <div className="absolute inset-x-0 top-5 mx-auto h-36 w-36 rounded-full bg-[#bfdbfe]/55 blur-sm animate-[cafesmartGlowBreath_3.2s_ease-in-out_infinite]" />
          <span className="absolute left-1 top-8 h-2 w-2 rounded-full bg-[#7db5ff] opacity-70 animate-[cafesmartFloat_3.6s_ease-in-out_infinite]" />
          <span className="absolute right-2 top-14 h-1.5 w-1.5 rounded-full bg-[#93c5fd] opacity-80 animate-[cafesmartFloat_4s_ease-in-out_infinite]" />
          <span className="absolute right-8 bottom-7 h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_16px_rgba(22,131,247,0.32)] animate-[cafesmartGlowBreath_3.4s_ease-in-out_infinite]" />
          <div className="absolute -left-8 bottom-0 h-24 w-20 origin-bottom opacity-60 animate-[cafesmartSway_4.3s_ease-in-out_infinite]">
            <svg viewBox="0 0 96 140" fill="none" aria-hidden="true">
              <path d="M48 134C45 92 52 56 75 17" stroke="#86bfff" strokeWidth="5" strokeLinecap="round" />
              <path d="M49 96C28 90 16 76 14 58C35 60 49 75 49 96Z" fill="#9ccaff" />
              <path d="M57 78C77 73 89 61 91 43C71 43 58 58 57 78Z" fill="#7db5ff" />
              <path d="M60 116C77 112 88 101 91 84C73 84 61 98 60 116Z" fill="#9ccaff" />
              <circle cx="55" cy="119" r="5" fill="#7db5ff" />
              <circle cx="69" cy="126" r="5" fill="#7db5ff" />
            </svg>
          </div>
          <div className="absolute -right-9 bottom-0 h-28 w-20 origin-bottom opacity-60 animate-[cafesmartSway_4.9s_ease-in-out_infinite] [animation-delay:250ms]">
            <svg viewBox="0 0 96 140" fill="none" aria-hidden="true">
              <path d="M48 134C45 92 52 56 75 17" stroke="#86bfff" strokeWidth="5" strokeLinecap="round" />
              <path d="M49 96C28 90 16 76 14 58C35 60 49 75 49 96Z" fill="#9ccaff" />
              <path d="M57 78C77 73 89 61 91 43C71 43 58 58 57 78Z" fill="#7db5ff" />
              <path d="M60 116C77 112 88 101 91 84C73 84 61 98 60 116Z" fill="#9ccaff" />
              <circle cx="55" cy="119" r="5" fill="#7db5ff" />
              <circle cx="69" cy="126" r="5" fill="#7db5ff" />
            </svg>
          </div>
          <div className="relative flex h-40 w-40 items-center justify-center rounded-full bg-[#eef6ff] shadow-[0_22px_54px_rgba(37,99,235,0.14)] animate-[cafesmartFloat_3.8s_ease-in-out_infinite]">
            <div className="absolute -right-1 top-7 flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-[#1683f7] shadow-[0_12px_26px_rgba(37,99,235,0.14)]">
              <Sparkles size={18} strokeWidth={2.4} aria-hidden="true" />
            </div>
            <div className="rounded-[30px] bg-white/70 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
              <CafeSmartLogo size="md" showText={false} showSubtitle={false} />
            </div>
          </div>
        </div>

        <div className="mt-8 animate-[cafesmartFadeUp_420ms_ease-out_180ms_both]">
          <h1 className="text-[1.55rem] font-black leading-tight text-[#07153b]">
            Creando cuenta...
          </h1>
          <p className="mx-auto mt-3 max-w-[310px] text-sm font-semibold leading-6 text-slate-500">
            Estamos preparando CaféSmart para tu negocio. Esto tomará solo unos segundos.
          </p>
        </div>

        <div className="mt-7 animate-[cafesmartFadeUp_420ms_ease-out_260ms_both]">
          <div className="mx-auto h-2.5 w-44 overflow-hidden rounded-full bg-[#dbeafe] shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)]">
            <div className="h-full w-24 origin-left rounded-full bg-[#1683f7] shadow-[0_0_18px_rgba(22,131,247,0.34)] animate-[cafesmartProgress_1.45s_ease-in-out_infinite]" />
          </div>
          <p className="mt-4 text-xs font-black text-[#7da9e8]">
            Preparando tu espacio cafetero...
          </p>
        </div>

        <div className="mt-7 flex w-full max-w-[330px] items-center gap-3 rounded-[22px] bg-[#eef6ff] p-4 text-left shadow-[0_18px_38px_rgba(37,99,235,0.08)] animate-[cafesmartFadeUp_420ms_ease-out_340ms_both]">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1683f7] shadow-[0_10px_24px_rgba(37,99,235,0.08)]">
            <ShieldCheck size={25} strokeWidth={2.3} />
          </div>
          <div>
            <p className="text-sm font-black text-[#07153b]">
              Tu información está protegida
            </p>
            <p className="mt-1 text-[0.78rem] font-semibold leading-5 text-slate-500">
              Estamos creando tu cuenta de forma segura.
            </p>
          </div>
        </div>
      </section>

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
        <div className="absolute bottom-3 left-8 h-24 w-20 origin-bottom opacity-85 animate-[cafesmartSway_4s_ease-in-out_infinite]">
          <svg viewBox="0 0 96 140" fill="none" aria-hidden="true">
            <path d="M48 134C45 92 52 56 75 17" stroke="#86bfff" strokeWidth="5" strokeLinecap="round" />
            <path d="M49 96C28 90 16 76 14 58C35 60 49 75 49 96Z" fill="#9ccaff" />
            <path d="M57 78C77 73 89 61 91 43C71 43 58 58 57 78Z" fill="#7db5ff" />
            <path d="M60 116C77 112 88 101 91 84C73 84 61 98 60 116Z" fill="#9ccaff" />
            <circle cx="55" cy="119" r="5" fill="#7db5ff" />
            <circle cx="69" cy="126" r="5" fill="#7db5ff" />
          </svg>
        </div>
        <div className="absolute bottom-3 right-5 h-36 w-24 origin-bottom opacity-90 animate-[cafesmartSway_4.8s_ease-in-out_infinite] [animation-delay:350ms]">
          <svg viewBox="0 0 96 140" fill="none" aria-hidden="true">
            <path d="M48 134C45 92 52 56 75 17" stroke="#86bfff" strokeWidth="5" strokeLinecap="round" />
            <path d="M49 96C28 90 16 76 14 58C35 60 49 75 49 96Z" fill="#9ccaff" />
            <path d="M57 78C77 73 89 61 91 43C71 43 58 58 57 78Z" fill="#7db5ff" />
            <path d="M60 116C77 112 88 101 91 84C73 84 61 98 60 116Z" fill="#9ccaff" />
            <circle cx="55" cy="119" r="5" fill="#7db5ff" />
            <circle cx="69" cy="126" r="5" fill="#7db5ff" />
          </svg>
        </div>
      </div>
    </main>
  );
}
