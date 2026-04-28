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

type TipoOrg = 'COOPERATIVA' | 'COMPRAVENTA' | 'PERSONALIZADO';
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
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[340px] items-center justify-center">
        <section className="w-full max-w-[320px] rounded-[14px] border border-slate-200 bg-white px-5 py-5 text-center shadow-[0_18px_38px_rgba(15,23,42,0.08)]">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Check size={18} strokeWidth={3.2} />
          </div>
          <h1 className="mt-3 text-[0.95rem] font-black tracking-tight text-[#121826]">
            Cuenta creada
          </h1>
          <p className="mt-1 text-[0.68rem] text-slate-600">Preparando inicio...</p>
        </section>
      </div>
    </div>
  );
}

function WelcomeView({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative min-h-screen overflow-hidden text-white">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#07132f_0%,#0b1e52_35%,#08142f_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_24%,rgba(113,149,255,0.22)_0%,rgba(113,149,255,0)_44%)]" />
      <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.85)_1px,transparent_0)] [background-size:28px_28px]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[340px] flex-col px-4 py-5">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/22 bg-white/14 px-4 py-2 backdrop-blur">
          <Coffee size={15} className="text-white/90" />
          <span className="text-[1.1rem] font-black tracking-tight text-white">Cafe Smart</span>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center pt-4">
          <div className="relative mt-1">
            <div className="cafesmart-pulse-ring absolute -inset-4 rounded-full border border-[#74a7ff59]" />
            <div
              className="cafesmart-pulse-ring absolute -inset-9 rounded-full border border-dashed border-[#71a2ff63]"
              style={{ animationDelay: '0.7s' }}
            />
            <div className="relative flex h-[176px] w-[176px] items-center justify-center">
              <div className="absolute inset-[18%] rounded-full bg-[#80c6ff]/18 blur-3xl" aria-hidden="true" />
              <img
                src="/imagenes-de-proyecto/granito-inteligente.png"
                alt="Granito inteligente de Cafe Smart"
                className="cafesmart-float relative h-[168px] w-[168px] object-contain drop-shadow-[0_22px_38px_rgba(6,10,28,0.38)]"
              />
            </div>
          </div>

          <div className="mt-4 w-full max-w-[340px] rounded-[14px] border border-[#70a2ff42] bg-[linear-gradient(180deg,rgba(15,34,88,0.35)_0%,rgba(13,27,70,0.4)_100%)] px-4 py-4 backdrop-blur-sm">
            <h1 className="text-center text-[1.35rem] font-black leading-tight tracking-normal text-white">
              Bienvenido a
              <span className="block bg-[linear-gradient(180deg,#b8e4ff_0%,#5db9ff_100%)] bg-clip-text text-transparent">
                Cafe Smart
              </span>
            </h1>

            <p className="mt-2 text-center text-[0.72rem] leading-5 text-[#e0e8ff]">
              Controla tu cafe en un solo lugar con precision.
            </p>

            <button
              type="button"
              onClick={onStart}
              className="mt-4 inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-[8px] bg-[#1240c7] px-4 py-2 text-[0.72rem] font-black text-white shadow-[0_14px_30px_rgba(13,70,222,0.35)]"
            >
              Comenzar ahora
              <ArrowRight size={20} />
            </button>
          </div>

          <div className="mt-3 grid w-full max-w-[340px] grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => window.open('mailto:soporte@cafesmart.com?subject=Ayuda%20Cafe%20Smart', '_self')}
              className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-[8px] border border-white/28 bg-[#0d162fcc] px-3 text-[0.68rem] font-bold text-white backdrop-blur"
            >
              <HelpCircle size={18} />
              Ayuda
            </button>
            <button
              type="button"
              onClick={() =>
                window.open('mailto:soporte@cafesmart.com?subject=Contacto%20Cafe%20Smart', '_self')
              }
              className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-[8px] border border-white/28 bg-[#0d162fcc] px-3 text-[0.68rem] font-bold text-white backdrop-blur"
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
      <div className="mx-auto w-full max-w-[320px] rounded-[14px] border border-white/80 bg-white/90 p-5 text-center shadow-[0_18px_38px_rgba(15,23,42,0.08)]">
        {status === 'creating' ? (
          <>
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#eef2ff] text-[#102d92]">
              <LoaderCircle className="h-5 w-5 animate-spin" />
            </div>
            <h1 className="mt-3 text-[0.95rem] font-black text-[#121826]">Creando cuenta...</h1>
            <p className="mt-1 text-[0.68rem] text-slate-600">Configurando tu espacio.</p>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-rose-100 text-rose-700">
              <AlertTriangle size={18} />
            </div>
            <h1 className="mt-3 text-[0.95rem] font-black text-[#121826]">{errorTitle}</h1>
            <p className="mt-1 text-[0.68rem] leading-5 text-slate-600">{errorMessage}</p>
            <button
              type="button"
              onClick={() => void executeRegistration(true)}
              className="mt-4 inline-flex min-h-[38px] w-full items-center justify-center rounded-[8px] border border-slate-200 bg-[#eef0fb] px-4 py-2 text-[0.68rem] font-black text-[#102d92]"
            >
              Reintentar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
