import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Coffee,
  HelpCircle,
  LoaderCircle,
  MessageCircle,
} from 'lucide-react';
import { useUser } from '../context/UserContext';
import { authService, type AuthError, type AuthResponse } from '../services/authService';

type TipoOrg = 'COOPERATIVA' | 'COMPRAVENTA' | 'OTRO';
type ProcessStatus = 'creating' | 'success' | 'error';
type SuccessStage = 'confirm' | 'welcome';

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

const CONFIRMATION_DURATION_MS = 1700;

function ConfirmSuccessView() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f4ff_0%,#f1f0fc_100%)] px-4 py-8 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[520px] items-center justify-center">
        <section className="w-full max-w-[360px] rounded-3xl border border-slate-200 bg-white px-6 py-7 text-center shadow-[0_24px_50px_rgba(15,23,42,0.1)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Check size={30} strokeWidth={3.2} />
          </div>
          <h1 className="mt-4 text-[1.35rem] font-black tracking-tight text-[#121826]">
            Cuenta creada
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">Preparando tu bienvenida...</p>
        </section>
      </div>
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
            <div className="relative flex h-[228px] w-[228px] items-center justify-center rounded-full bg-white/95 shadow-[0_28px_50px_rgba(6,10,28,0.45)]">
              <div className="cafesmart-float relative h-[170px] w-[170px]" aria-hidden="true">
                <div className="absolute inset-0 rounded-[46%_54%_50%_50%/58%_44%_56%_42%] bg-[radial-gradient(circle_at_32%_22%,#dbeafe_0%,#7dd3fc_18%,#3b82f6_42%,#1d4ed8_64%,#0f172a_100%)] shadow-[0_18px_34px_rgba(37,99,235,0.36)]" />
                <div className="absolute inset-y-[18%] left-1/2 w-[18%] -translate-x-1/2 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.4)_0%,rgba(15,23,42,0.2)_100%)] opacity-90" />
                <div className="absolute left-[28%] top-[25%] h-4 w-4 rounded-full bg-white/40 blur-sm" />
                <div className="absolute right-[22%] top-[54%] h-7 w-7 rounded-full bg-sky-300/25 blur-md" />
              </div>
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
              Controla tu cafe en un solo lugar con precision.
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
              Contactenos
            </button>
          </div>
        </div>
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
  const [successStage, setSuccessStage] = useState<SuccessStage>('confirm');
  const [errorMessage, setErrorMessage] = useState(
    'No pudimos procesar tu solicitud. Revisa tu conexion e intentalo nuevamente.',
  );
  const [errorTitle, setErrorTitle] = useState('Error de conexion');
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
      setErrorTitle('Error de conexion');
      setErrorMessage('No pudimos procesar tu solicitud. Revisa tu conexion e intentalo nuevamente.');

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
            organizacionId: response.user.organizacionId ?? null,
            tipoOrganizacion: response.user.tipoOrganizacion ?? null,
            otroTipoDetalle: response.user.otroTipoDetalle ?? null,
          },
          token: response.access_token,
          hasCompany: response.hasCompany,
        });

        setStatus('success');
        setSuccessStage('confirm');
      } catch (err) {
        const authError = err as AuthError;
        const field = (authError.field ?? '').toLowerCase();

        registrationStartedRef.current = false;
        setStatus('error');
        setSuccessStage('confirm');

        if (field === 'email' || field === 'correo') {
          setErrorTitle('No se pudo crear la cuenta');
        } else {
          setErrorTitle('Error de conexion');
        }

        setErrorMessage(
          authError.message ||
            'No pudimos procesar tu solicitud. Revisa tu conexion e intentalo nuevamente.',
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
    return <WelcomeView onStart={() => navigate('/inicio', { replace: true })} />;
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f4ff_0%,#f1f0fc_100%)] px-4 py-8 text-slate-900">
      <div className="mx-auto w-full max-w-[520px] rounded-[30px] border border-white/80 bg-white/90 p-6 text-center shadow-[0_24px_50px_rgba(15,23,42,0.08)]">
        {status === 'creating' ? (
          <>
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#eef2ff] text-[#102d92]">
              <LoaderCircle className="h-9 w-9 animate-spin" />
            </div>
            <h1 className="mt-5 text-[1.8rem] font-black text-[#121826]">Creando cuenta...</h1>
            <p className="mt-3 text-base text-slate-600">Estamos configurando tu espacio de trabajo.</p>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-100 text-rose-700">
              <AlertTriangle size={34} />
            </div>
            <h1 className="mt-5 text-[1.8rem] font-black text-[#121826]">{errorTitle}</h1>
            <p className="mt-3 text-base text-slate-600">{errorMessage}</p>
            <button
              type="button"
              onClick={() => void executeRegistration(true)}
              className="mt-6 inline-flex min-h-[46px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-[#eef0fb] px-5 py-3 text-base font-bold text-[#102d92]"
            >
              Reintentar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
