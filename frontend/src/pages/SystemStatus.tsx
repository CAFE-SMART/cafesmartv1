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
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] items-center justify-center">
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
    <div className="min-h-screen bg-[#f7f8fb] px-4 py-8 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[430px] items-center justify-center">
        <section className="w-full rounded-[16px] border border-[#dfe5f1] bg-white px-5 py-5 text-center shadow-[0_18px_38px_rgba(15,23,42,0.08)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#eef4ff] text-[#274ab8]">
            <Coffee size={21} strokeWidth={2.4} />
          </div>

          <h1 className="mt-4 text-[1.18rem] font-black leading-tight tracking-normal text-[#111827]">
            Bienvenido a Cafe Smart
          </h1>

          <p className="mt-2 text-[0.76rem] leading-5 text-[#64748b]">
            Tu empresa quedo lista para empezar a registrar compras, secado y ventas.
          </p>

          <button
            type="button"
            onClick={onStart}
            className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-[#284bc1] px-4 text-[0.78rem] font-black text-white shadow-[0_14px_26px_rgba(40,75,193,0.18)] transition hover:bg-[#203fa8]"
          >
            Comenzar ahora
            <ArrowRight size={16} />
          </button>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => window.open('mailto:soporte@cafesmart.com?subject=Ayuda%20Cafe%20Smart', '_self')}
              className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-[10px] border border-[#dfe5f1] bg-[#f8fafc] px-3 text-[0.68rem] font-bold text-[#536178] transition hover:bg-[#eef2f8]"
            >
              <HelpCircle size={15} />
              Ayuda
            </button>
            <button
              type="button"
              onClick={() =>
                window.open('mailto:soporte@cafesmart.com?subject=Contacto%20Cafe%20Smart', '_self')
              }
              className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-[10px] border border-[#dfe5f1] bg-[#f8fafc] px-3 text-[0.68rem] font-bold text-[#536178] transition hover:bg-[#eef2f8]"
            >
              <MessageCircle size={15} />
              Contacto
            </button>
          </div>
        </section>
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
