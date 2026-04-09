import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Check, HelpCircle, LoaderCircle, Phone, User } from 'lucide-react';
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

const CONFIRMATION_DURATION_MS = 1800;

function ConfirmSuccessView() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f4ee_0%,#f6f4ff_100%)] px-4">
      <div className="mx-auto flex min-h-screen w-full max-w-[520px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Check size={34} strokeWidth={3} />
          </div>
          <h1 className="mt-5 text-[1.7rem] font-black tracking-tight text-[#14213d]">
            Cuenta creada satisfactoriamente
          </h1>
        </div>
      </div>
    </div>
  );
}

function WelcomeView({ onStart }: { onStart: () => void }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#fcf8f1_0%,#f7f5ff_62%,#f5f6fb_100%)] px-4 py-8">
      <div className="pointer-events-none absolute -right-24 -top-20 h-64 w-64 rounded-full bg-[radial-gradient(circle,#cbb08a_0%,rgba(203,176,138,0)_72%)] opacity-25 blur-sm" />
      <div className="pointer-events-none absolute -left-16 top-1/3 h-52 w-52 rounded-full bg-[radial-gradient(circle,#b28f67_0%,rgba(178,143,103,0)_72%)] opacity-12 blur-sm" />
      <div className="pointer-events-none absolute bottom-10 right-8 h-40 w-40 rounded-full bg-[radial-gradient(circle,#d8c1a0_0%,rgba(216,193,160,0)_74%)] opacity-20 blur-sm" />

      <div className="mx-auto flex w-full max-w-[460px] flex-col">
        <div className="mb-4 flex justify-end">
          <div className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm">
            <User size={16} />
            <span className="absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
          </div>
        </div>

        <section className="rounded-3xl border border-white/80 bg-white/88 px-5 py-6 shadow-[0_8px_18px_rgba(15,23,42,0.06)] backdrop-blur-sm">
          <h1 className="text-[1.8rem] font-black leading-tight tracking-tight text-[#102d92]">
            Bienvenido a Cafe Smart ☕
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Gestiona tus compras, inventario y ventas de café en un solo lugar.
          </p>

          <button
            type="button"
            onClick={onStart}
            className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#102d92] px-5 py-3 text-base font-black text-white shadow-[0_12px_24px_rgba(16,45,146,0.22)]"
          >
            Comenzar ahora
            <ArrowRight size={18} />
          </button>
        </section>

        <section className="mt-5 flex items-center justify-center gap-3 text-xs text-slate-500">
          <a
            href="mailto:soporte@cafesmart.com?subject=Ayuda%20Cafe%20Smart"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 py-2"
          >
            <HelpCircle size={13} />
            Ayuda
          </a>
          <a
            href="tel:+573000000000"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 py-2"
          >
            <Phone size={13} />
            Contáctenos
          </a>
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
    'No pudimos procesar tu solicitud. Revisa tu internet.',
  );
  const [errorTitle, setErrorTitle] = useState('Error de conexion. Intentalo de nuevo.');
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
      setErrorTitle('Error de conexion. Intentalo de nuevo.');
      setErrorMessage('No pudimos procesar tu solicitud. Revisa tu internet.');

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
          setErrorTitle('No se pudo crear la cuenta.');
        } else {
          setErrorTitle('Error de conexion. Intentalo de nuevo.');
        }

        setErrorMessage(
          authError.message || 'No pudimos procesar tu solicitud. Revisa tu internet.',
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
            <p className="mt-3 text-base text-slate-600">
              Estamos configurando tu espacio de trabajo.
            </p>
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
