import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  BarChart3,
  Check,
  CheckCircle2,
  Headset,
  HelpCircle,
  LoaderCircle,
  RefreshCw,
  Shield,
} from 'lucide-react';
import { authService, type AuthError, type AuthResponse } from '../services/authService';
import { useUser } from '../context/UserContext';

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
  const [errorMessage, setErrorMessage] = useState('No pudimos procesar tu solicitud. Revisa tu internet.');
  const [errorTitle, setErrorTitle] = useState('Error de conexión. Inténtalo de nuevo.');
  const registrationStartedRef = useRef(false);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    // Si ya hay sesión completa y entran a esta pantalla por error, enviarlos al inventario.
    if (token && hasCompany && !processState) {
      navigate('/inventario', { replace: true });
    }
  }, [hasCompany, hydrated, navigate, processState, token]);

  const executeRegistration = useCallback(async (force = false) => {
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
    setErrorTitle('Error de conexión. Inténtalo de nuevo.');
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
        },
        token: response.access_token,
        hasCompany: response.hasCompany,
      });
      setStatus('success');

      // Una vez creada la cuenta, continuar al inventario sin reintentar el registro.
      setTimeout(() => {
        navigate('/inventario', { replace: true });
      }, 1000);
    } catch (err) {
      const authError = err as AuthError;
      const field = (authError.field ?? '').toLowerCase();
      if (field === 'email' || field === 'correo') {
        setErrorTitle('No se pudo crear la cuenta.');
      }
      setErrorMessage(authError.message || 'No pudimos procesar tu solicitud. Revisa tu internet.');
      setStatus('error');
    }
  }, [hasCompany, navigate, processState, setSession, token]);

  useEffect(() => {
    void executeRegistration();
  }, [executeRegistration]);

  return (
    <div className="min-h-screen bg-[#efeff5] text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-[#efeff5] px-4 py-4">
        <div className="mx-auto flex w-full max-w-[520px] items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/crear-empresa')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0b2a85]"
          >
            <ArrowLeft size={17} />
            Café Smart
          </button>
          <p className="text-base font-semibold text-[#0b2a85]">Estado del Sistema</p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[520px] flex-col gap-6 px-4 py-6 pb-28">
        {status === 'creating' && (
          <section className="rounded-2xl bg-[#e9e9f2] p-6 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border-4 border-[#c9cedf] border-t-[#0b2a85] text-[#0b2a85]">
              <LoaderCircle className="h-7 w-7 animate-spin" />
            </div>
            <h2 className="text-4xl font-extrabold tracking-tight text-[#0b2a85]">Creando cuenta...</h2>
            <p className="mx-auto mt-3 max-w-[260px] text-lg text-slate-600">
              Estamos preparando tu perfil de agrónomo digital.
            </p>
          </section>
        )}

        {status === 'success' && (
          <section className="rounded-2xl bg-white p-6 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#80d9d8] text-[#0a5f63]">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-black">
              ¡Cuenta creada correctamente!
            </h2>
            <p className="mx-auto mt-3 max-w-[280px] text-lg text-slate-700">
              Bienvenido a bordo. Ya puedes gestionar tus cosechas.
            </p>
            <button
              type="button"
              onClick={() => navigate('/inventario')}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0b2a85] px-4 py-3 text-lg font-semibold text-white"
            >
              Ir al Inicio <ArrowRight size={18} />
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
            <p className="mx-auto mt-3 max-w-[290px] text-lg text-slate-700">{errorMessage}</p>
            <button
              type="button"
              onClick={() => void executeRegistration(true)}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-[#dddee8] px-4 py-3 text-lg font-semibold text-[#0b1e6b]"
            >
              <RefreshCw size={17} /> Reintentar
            </button>
          </section>
        )}

        <section className="rounded-2xl bg-[#072688] p-6 text-white shadow-sm">
          <Shield className="mb-4 h-8 w-8" />
          <h3 className="text-4xl font-bold leading-tight">Seguridad Garantizada</h3>
          <p className="mt-3 text-lg text-blue-100">
            Tus datos de producción están protegidos con los más altos estándares de la industria agrícola.
          </p>
        </section>

        <section className="rounded-2xl bg-[#7dd8d9] p-6 text-[#0b5663] shadow-sm">
          <BarChart3 className="mb-4 h-8 w-8" />
          <h3 className="text-4xl font-bold leading-tight">Panel de Control</h3>
          <p className="mt-3 text-lg">
            Analiza el rendimiento de tus lotes y optimiza cada grano de tu cosecha en tiempo real.
          </p>
        </section>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-[#efeff5] px-4 py-3">
        <div className="mx-auto flex w-full max-w-[520px] items-center justify-center gap-10">
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