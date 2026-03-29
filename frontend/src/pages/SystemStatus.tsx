import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Headset,
  HelpCircle,
  LoaderCircle,
  RefreshCw,
  Shield,
} from 'lucide-react';
import { CloudStatusBadge } from '../components/CloudStatusBadge';
import { useUser } from '../context/UserContext';
import { authService, type AuthError, type AuthResponse } from '../services/authService';

type TipoOrg = 'COOPERATIVA' | 'COMPRAVENTA' | 'OTRO';

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

type ProcessStatus = 'creating' | 'success' | 'error';

export default function SystemStatus() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setSession, token, hasCompany, hydrated } = useUser();

  const processState = useMemo(
    () => (location.state ?? null) as RegisterProcessState | null,
    [location.state],
  );

  const [status, setStatus] = useState<ProcessStatus>('creating');
  const [errorMessage, setErrorMessage] = useState(
    'No pudimos procesar tu solicitud. Revisa tu internet.',
  );
  const [errorTitle, setErrorTitle] = useState('Error de conexion. Intentalo de nuevo.');
  const registrationStartedRef = useRef(false);
  const redirectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    if (token && hasCompany && !processState) {
      navigate('/inventario', { replace: true });
    }
  }, [hasCompany, hydrated, navigate, processState, token]);

  const executeRegistration = useCallback(
    async (force = false) => {
      if (registrationStartedRef.current && !force) {
        return;
      }

      registrationStartedRef.current = true;

      if (!processState) {
        if (token && hasCompany) {
          navigate('/inventario', { replace: true });
        } else {
          navigate('/crear-empresa', { replace: true });
        }
        return;
      }

      setStatus('creating');
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
              processState.tipoOrganizacion === 'OTRO'
                ? processState.otroTipoDetalle
                : undefined,
          });
        } else {
          response = await authService.register({
            nombreOrganizacion: processState.nombreOrganizacion,
            tipoOrganizacion: processState.tipoOrganizacion,
            otroTipoDetalle:
              processState.tipoOrganizacion === 'OTRO'
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
          },
          token: response.access_token,
          hasCompany: response.hasCompany,
        });
        setStatus('success');

        redirectTimerRef.current = window.setTimeout(() => {
          navigate('/inventario', { replace: true });
        }, 1000);
      } catch (err) {
        const authError = err as AuthError;
        const field = (authError.field ?? '').toLowerCase();
        if (field === 'email' || field === 'correo') {
          setErrorTitle('No se pudo crear la cuenta.');
        }
        setErrorMessage(
          authError.message || 'No pudimos procesar tu solicitud. Revisa tu internet.',
        );
        setStatus('error');
      }
    },
    [hasCompany, navigate, processState, setSession, token],
  );

  useEffect(() => {
    void executeRegistration();

    return () => {
      if (redirectTimerRef.current !== null) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, [executeRegistration]);

  return (
    <div className="min-h-screen bg-[#efeff5] text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-[#efeff5] px-4 py-4">
        <div className="mx-auto flex w-full max-w-[720px] items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/crear-empresa')}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#0b2a85]"
            >
              <ArrowLeft size={17} />
              Cafe Smart
            </button>
            <p className="text-base font-semibold text-[#0b2a85]">Estado del sistema</p>
          </div>
          <CloudStatusBadge />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[720px] flex-col gap-6 px-4 py-6 pb-28">
        {status === 'creating' && (
          <section className="rounded-2xl bg-[#e9e9f2] p-6 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border-4 border-[#c9cedf] border-t-[#0b2a85] text-[#0b2a85]">
              <LoaderCircle className="h-7 w-7 animate-spin" />
            </div>
            <h2 className="text-4xl font-extrabold tracking-tight text-[#0b2a85]">
              Creando cuenta...
            </h2>
            <p className="mx-auto mt-3 max-w-[260px] text-lg text-slate-600">
              Estamos preparando tu perfil de agronomo digital.
            </p>
          </section>
        )}

        {status === 'success' && (
          <section className="rounded-2xl bg-white p-6 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#80d9d8] text-[#0a5f63]">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-black">
              Cuenta creada correctamente
            </h2>
            <p className="mx-auto mt-3 max-w-[280px] text-lg text-slate-700">
              Bienvenido a bordo. Ya puedes gestionar tus cosechas.
            </p>
            <p className="mx-auto mt-3 max-w-[320px] text-sm font-medium text-emerald-700">
              Si ves la nube en verde arriba, la cuenta ya fue confirmada con la API.
            </p>
            <button
              type="button"
              onClick={() => navigate('/inventario')}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0b2a85] px-4 py-3 text-lg font-semibold text-white"
            >
              Ir al inicio <ArrowRight size={18} />
            </button>
          </section>
        )}

        {status === 'error' && (
          <section className="rounded-2xl bg-[#e9e9f2] p-6 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center text-red-700">
              <AlertTriangle className="h-10 w-10" />
            </div>
            <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-black">
              {errorTitle}
            </h2>
            <p className="mx-auto mt-3 max-w-[290px] text-lg text-slate-700">
              {errorMessage}
            </p>
            <button
              type="button"
              onClick={() => void executeRegistration(true)}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-[#dddee8] px-4 py-3 text-lg font-semibold text-[#0b1e6b]"
            >
              <RefreshCw size={17} /> Reintentar
            </button>
          </section>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm flex items-start gap-4 transition-all hover:shadow-md">
            <div className="bg-blue-50 p-3 rounded-xl text-[#072688] flex-shrink-0">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Seguridad garantizada</h3>
              <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                Tus datos de produccion estan protegidos con altos estandares de seguridad.
              </p>
            </div>
          </section>

          <section className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm flex items-start gap-4 transition-all hover:shadow-md">
            <div className="bg-emerald-50 p-3 rounded-xl text-[#0b5663] flex-shrink-0">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Panel de control</h3>
              <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                Analiza el rendimiento y optimiza cada grano de tu cosecha en tiempo real.
              </p>
            </div>
          </section>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-[#efeff5] px-4 py-3">
        <div className="mx-auto flex w-full max-w-[720px] items-center justify-center gap-10">
          <button type="button" className="flex flex-col items-center gap-1 text-slate-700">
            <HelpCircle size={18} />
            <span className="text-xs font-semibold">Ayuda</span>
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-1 rounded-2xl bg-[#d8d9e4] px-5 py-3 text-[#0b2a85]"
          >
            <Headset size={18} />
            <span className="text-xs font-semibold">Contacto</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
