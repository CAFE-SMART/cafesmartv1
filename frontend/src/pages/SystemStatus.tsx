import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpenText,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Headphones,
  HelpCircle,
  LoaderCircle,
  Mail,
  Phone,
  RefreshCw,
  Shield,
  X,
} from 'lucide-react';
import { useUser } from '../context/UserContext';
import { authService, type AuthError, type AuthResponse } from '../services/authService';

type TipoOrg = 'COOPERATIVA' | 'COMPRAVENTA' | 'OTRO';
type ProcessStatus = 'creating' | 'success' | 'error';
type ActivePanel = 'help' | 'contact' | null;

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

const helpItems = [
  {
    id: 'compra',
    question: 'Como registrar una compra?',
    answer:
      'Ingresa al modulo de compras, agrega los sublotes y define tipo de cafe, calidad, peso y precio por kilo.',
  },
  {
    id: 'inventario',
    question: 'Como funciona el inventario?',
    answer:
      'El sistema agrupa los sublotes por tipo y calidad para mostrar los lotes disponibles en bodega del mas viejo al mas nuevo.',
  },
  {
    id: 'humedad',
    question: 'Donde registro la humedad?',
    answer:
      'La humedad se registra en cada sublote. Luego el sistema la resume para mostrarla en el inventario agrupado.',
  },
] as const;

function StatusCircle({ status }: { status: ProcessStatus }) {
  if (status === 'success') {
    return (
      <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-[#8ee7e3] shadow-[0_18px_48px_rgba(14,116,144,0.24)]" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#056a72] text-white">
          <Check size={28} strokeWidth={3} />
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-[#ffe4e6] shadow-[0_18px_48px_rgba(190,24,93,0.14)]" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#b91c1c] text-white">
          <AlertTriangle size={28} strokeWidth={2.6} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex flex-col items-center">
      <div className="relative h-28 w-28">
        <div className="absolute inset-0 rounded-full bg-[conic-gradient(#102d92_0deg,#102d92_120deg,#d8dcf6_120deg,#d8dcf6_360deg)] animate-[spin_2.3s_linear_infinite]" />
        <div className="absolute inset-[10px] rounded-full bg-[#f6f4ff]" />
        <div className="absolute inset-0 flex items-center justify-center text-[#102d92]">
          <LoaderCircle className="h-8 w-8 animate-spin" />
        </div>
      </div>
      <div className="mt-4 h-2 w-36 overflow-hidden rounded-full bg-[#d9def6]">
        <div className="h-full w-1/2 rounded-full bg-[#102d92] animate-[pulse_1.4s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  badge,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge: string;
  tone: 'blue' | 'mint';
}) {
  const toneStyles =
    tone === 'blue'
      ? {
          card: 'bg-[#102d92] text-white',
          icon: 'bg-white/12 text-white',
          badge: 'bg-white/14 text-white/90',
          description: 'text-blue-100',
        }
      : {
          card: 'bg-[#8ee7e3] text-[#0f4450]',
          icon: 'bg-white/40 text-[#0f5c63]',
          badge: 'bg-white/45 text-[#0f5c63]',
          description: 'text-[#0f5c63]/80',
        };

  return (
    <section className={`rounded-[28px] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] ${toneStyles.card}`}>
      <div className={`mb-5 inline-flex rounded-2xl p-3 ${toneStyles.icon}`}>{icon}</div>
      <h3 className="text-[1.55rem] font-black leading-tight">{title}</h3>
      <p className={`mt-4 text-base leading-7 ${toneStyles.description}`}>{description}</p>
      <div className={`mt-5 inline-flex rounded-full px-4 py-1.5 text-sm font-bold uppercase tracking-[0.18em] ${toneStyles.badge}`}>
        {badge}
      </div>
    </section>
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
  const [errorMessage, setErrorMessage] = useState(
    'No pudimos procesar tu solicitud. Revisa tu internet.',
  );
  const [errorTitle, setErrorTitle] = useState('Error de conexion. Intentalo de nuevo.');
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [openHelpId, setOpenHelpId] = useState<string>(helpItems[0].id);
  const [contactName, setContactName] = useState(processState?.nombre ?? '');
  const [contactEmail, setContactEmail] = useState(processState?.correo ?? '');
  const [contactMessage, setContactMessage] = useState('');
  const registrationStartedRef = useRef(false);

  useEffect(() => {
    if (processState?.nombre) {
      setContactName(processState.nombre);
    }

    if (processState?.correo) {
      setContactEmail(processState.correo);
    }
  }, [processState?.correo, processState?.nombre]);

  useEffect(() => {
    if (!hydrated) return;

    if (token && hasCompany && !processState) {
      navigate('/inicio', { replace: true });
    }
  }, [hasCompany, hydrated, navigate, processState, token]);

  useEffect(() => {
    setActivePanel(null);
  }, [status]);

  const executeRegistration = useCallback(
    async (force = false) => {
      if (registrationStartedRef.current && !force) {
        return;
      }

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
            organizacionId: response.user.organizacionId ?? null,
            tipoOrganizacion: response.user.tipoOrganizacion ?? null,
            otroTipoDetalle: response.user.otroTipoDetalle ?? null,
          },
          token: response.access_token,
          hasCompany: response.hasCompany,
        });

        setStatus('success');
      } catch (err) {
        const authError = err as AuthError;
        const field = (authError.field ?? '').toLowerCase();

        registrationStartedRef.current = false;

        if (field === 'email' || field === 'correo') {
          setErrorTitle('No se pudo crear la cuenta.');
        } else {
          setErrorTitle('Error de conexion. Intentalo de nuevo.');
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
  }, [executeRegistration]);

  const handleContactSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    window.alert('Tu mensaje quedo listo para soporte. Luego conectamos este envio.');
    setContactMessage('');
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f4ff_0%,#f1f0fc_100%)] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-white/70 bg-[#f6f4ff]/90 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[760px] items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/crear-empresa')}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-[#0f2d8f]"
          >
            <ArrowLeft size={24} />
          </button>

          <div className="text-center">
            <p className="text-3xl font-black tracking-tight text-[#11246f]">Cafe Smart</p>
            <p className="text-sm font-semibold text-slate-500">Estado del sistema</p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl text-[#0f2d8f]"
          >
            <X size={24} />
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 py-6 pb-10">
        <section
          className={`overflow-hidden rounded-[34px] border p-6 text-center shadow-[0_28px_60px_rgba(15,23,42,0.08)] backdrop-blur ${
            status === 'success'
              ? 'relative border-[#eadfce] bg-[linear-gradient(160deg,#faf4e8_0%,#f3efe7_45%,#f6f4f0_100%)]'
              : 'border-white/70 bg-white/80'
          }`}
        >
          {status === 'success' ? (
            <>
              <div className="pointer-events-none absolute -right-24 -top-16 h-60 w-60 rounded-full bg-[radial-gradient(circle,#c8a97e_0%,rgba(200,169,126,0)_70%)] opacity-30" />
              <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-[radial-gradient(circle,#d9c2a2_0%,rgba(217,194,162,0)_70%)] opacity-30" />
            </>
          ) : null}

          <StatusCircle status={status} />

          {status === 'creating' ? (
            <>
              <h2 className="mt-6 text-[2.15rem] font-black tracking-tight text-[#121826]">
                Creando cuenta...
              </h2>
              <p className="mx-auto mt-3 max-w-[350px] text-lg leading-8 text-slate-600">
                Estamos configurando tu espacio de trabajo digital.
              </p>
            </>
          ) : null}

          {status === 'success' ? (
            <>
              <h2 className="mt-6 text-[2.15rem] font-black leading-tight tracking-tight text-[#121826]">
                Bienvenido a Cafe Smart ☕
              </h2>
              <p className="mx-auto mt-4 max-w-[420px] text-lg leading-8 text-slate-600">
                Empieza a gestionar tu cafe con control total: compras, inventario y ventas en un solo lugar.
              </p>
              <p className="mt-4 text-sm font-bold text-emerald-700">✔ Cuenta activa</p>
              <div className="mt-8">
                <button
                  type="button"
                  onClick={() => navigate('/inicio', { replace: true })}
                  className="inline-flex flex-1 items-center justify-center gap-3 rounded-[24px] bg-[#102d92] px-6 py-4 text-lg font-black text-white shadow-[0_18px_40px_rgba(16,45,146,0.22)]"
                >
                  Comenzar ahora
                  <ArrowRight size={22} />
                </button>
              </div>
            </>
          ) : null}

          {status === 'error' ? (
            <>
              <h2 className="mt-6 text-[2.05rem] font-black leading-tight tracking-tight text-[#121826]">
                {errorTitle}
              </h2>
              <p className="mx-auto mt-4 max-w-[420px] text-lg leading-8 text-slate-600">
                {errorMessage}
              </p>
              <button
                type="button"
                onClick={() => void executeRegistration(true)}
                className="mt-8 inline-flex w-full items-center justify-center gap-3 rounded-[22px] border border-slate-200 bg-[#eef0fb] px-6 py-4 text-lg font-bold text-[#102d92]"
              >
                <RefreshCw size={20} />
                Reintentar
              </button>
            </>
          ) : null}
        </section>

        <div className="grid gap-5 md:grid-cols-2">
          <FeatureCard
            icon={<Shield size={28} />}
            title="Seguridad Garantizada"
            description="Tus datos de produccion estan protegidos con altos estandares y validacion segura de la cuenta."
            badge="Protegido"
            tone="blue"
          />
          <FeatureCard
            icon={<BarChart3 size={28} />}
            title="Panel de Control"
            description="Accede a tus flujos de compras, inventario y analisis sin perder el contexto del registro."
            badge="Eficiencia"
            tone="mint"
          />
        </div>

        {status === 'success' ? (
          <section className="rounded-[34px] border border-white/80 bg-white/88 p-5 shadow-[0_28px_70px_rgba(15,23,42,0.1)] backdrop-blur">
            <div className="text-center">
              <div className="mx-auto mb-4 inline-flex rounded-full bg-[#dde1ff] p-4 text-[#102d92]">
                <HelpCircle size={28} />
              </div>
              <h3 className="text-[1.9rem] font-black tracking-tight text-[#102d92]">
                Preguntas frecuentes
              </h3>
              <p className="mt-1 text-base text-slate-500">
                Toca un icono para abrir la ventana, no se queda fija en pantalla.
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => setActivePanel('help')}
                className={`flex flex-col items-center gap-2 rounded-[22px] border px-4 py-4 text-center transition-all ${
                  activePanel === 'help'
                    ? 'border-[#102d92] bg-[#102d92] text-white shadow-[0_14px_30px_rgba(16,45,146,0.22)]'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${activePanel === 'help' ? 'bg-white/12' : 'bg-[#eef1ff] text-[#102d92]'}`}>
                  <BookOpenText size={22} />
                </div>
                <span className="text-sm font-black">Ayuda</span>
              </button>

              <button
                type="button"
                onClick={() => setActivePanel('contact')}
                className={`flex flex-col items-center gap-2 rounded-[22px] border px-4 py-4 text-center transition-all ${
                  activePanel === 'contact'
                    ? 'border-[#102d92] bg-[#102d92] text-white shadow-[0_14px_30px_rgba(16,45,146,0.22)]'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${activePanel === 'contact' ? 'bg-white/12' : 'bg-[#eef1ff] text-[#102d92]'}`}>
                  <Headphones size={22} />
                </div>
                <span className="text-sm font-black">Contacto</span>
              </button>

              <div className="flex flex-col items-center gap-2 rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-center text-slate-600">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#102d92]">
                  <Shield size={22} />
                </div>
                <span className="text-sm font-black">Seguro</span>
              </div>

              <div className="flex flex-col items-center gap-2 rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-center text-slate-600">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef1ff] text-[#102d92]">
                  <BarChart3 size={22} />
                </div>
                <span className="text-sm font-black">Panel</span>
              </div>
            </div>
          </section>
        ) : null}
      </main>

      {status === 'success' && activePanel ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 sm:bottom-6 sm:justify-end sm:px-6">
          <div className="pointer-events-auto relative flex items-end gap-3">
            <div className="fixed left-4 right-4 bottom-20 z-50 max-h-[68vh] overflow-hidden rounded-[28px] border border-white/80 bg-white/95 shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:absolute sm:bottom-full sm:left-auto sm:right-0 sm:mb-3 sm:w-[min(92vw,24rem)] sm:max-h-none">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-[#102d92]">
                    {activePanel === 'help' ? 'Ayuda rápida' : 'Contacto rápido'}
                  </p>
                  <h3 className="mt-1 text-lg font-black text-slate-900">
                    {activePanel === 'help' ? 'Preguntas frecuentes' : 'Habla con soporte'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setActivePanel(null)}
                  className="rounded-full bg-slate-100 p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
                  aria-label="Cerrar ayuda"
                >
                  <X size={16} />
                </button>
              </div>

              {activePanel === 'help' ? (
                <div className="space-y-3 overflow-y-auto px-5 py-4 text-sm text-slate-600">
                  {helpItems.map((item) => {
                    const isOpen = openHelpId === item.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setOpenHelpId(isOpen ? '' : item.id)}
                        className="w-full rounded-[24px] border border-slate-100 bg-white px-5 py-4 text-left shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-lg font-black text-[#102d92]">{item.question}</p>
                            {isOpen ? (
                              <p className="mt-3 text-sm leading-7 text-slate-600">{item.answer}</p>
                            ) : (
                              <p className="mt-2 text-sm text-slate-500">
                                Toca para ver la respuesta rápida.
                              </p>
                            )}
                          </div>
                          {isOpen ? (
                            <ChevronDown size={20} className="mt-1 text-slate-400" />
                          ) : (
                            <ChevronRight size={20} className="mt-1 text-slate-400" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-5 overflow-y-auto px-5 py-4 text-sm text-slate-600">
                  <p>
                    Si algo falla en el registro, deja aquí tu mensaje sin perder la pantalla actual.
                  </p>

                  <form onSubmit={handleContactSubmit} className="space-y-4">
                    <input
                      type="text"
                      value={contactName}
                      onChange={(event) => setContactName(event.target.value)}
                      placeholder="Nombre completo"
                      className="w-full rounded-[20px] border border-slate-200 bg-white px-5 py-4 text-base text-slate-800 outline-none focus:border-[#102d92]"
                    />
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(event) => setContactEmail(event.target.value)}
                      placeholder="Correo electronico"
                      className="w-full rounded-[20px] border border-slate-200 bg-white px-5 py-4 text-base text-slate-800 outline-none focus:border-[#102d92]"
                    />
                    <textarea
                      value={contactMessage}
                      onChange={(event) => setContactMessage(event.target.value)}
                      placeholder="Escribe tu mensaje..."
                      rows={3}
                      className="w-full rounded-[20px] border border-slate-200 bg-white px-5 py-4 text-base text-slate-800 outline-none focus:border-[#102d92]"
                    />
                    <button
                      type="submit"
                      className="w-full rounded-[20px] bg-[#102d92] px-5 py-4 text-lg font-black text-white"
                    >
                      Enviar mensaje
                    </button>
                  </form>

                  <div className="grid gap-4 md:grid-cols-2">
                    <a
                      href="mailto:soporte@cafesmart.com"
                      className="flex items-center justify-between rounded-[22px] border border-slate-100 bg-white px-5 py-4 shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <div className="rounded-2xl bg-[#eef1ff] p-3 text-[#102d92]">
                          <Mail size={22} />
                        </div>
                        <div>
                          <p className="text-base font-black text-[#102d92]">Correo</p>
                          <p className="text-sm text-slate-500">soporte@cafesmart.com</p>
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-slate-400" />
                    </a>

                    <a
                      href="tel:+573000000000"
                      className="flex items-center justify-between rounded-[22px] border border-slate-100 bg-white px-5 py-4 shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <div className="rounded-2xl bg-[#eef1ff] p-3 text-[#102d92]">
                          <Phone size={22} />
                        </div>
                        <div>
                          <p className="text-base font-black text-[#102d92]">Linea de atencion</p>
                          <p className="text-sm text-slate-500">+57 300 000 0000</p>
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-slate-400" />
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-2 py-2 shadow-[0_18px_40px_rgba(15,23,42,0.14)] backdrop-blur-xl">
              <button
                type="button"
                onClick={() => setActivePanel('help')}
                className={`flex h-11 w-11 items-center justify-center rounded-full transition-all sm:h-12 sm:w-12 ${
                  activePanel === 'help'
                    ? 'bg-[#102d92] text-white shadow-[0_12px_24px_rgba(16,45,146,0.24)]'
                    : 'bg-[#eef1ff] text-[#102d92] hover:bg-[#dde1ff]'
                }`}
                aria-label="Abrir ayuda"
              >
                <BookOpenText size={20} />
              </button>
              <button
                type="button"
                onClick={() => setActivePanel('contact')}
                className={`flex h-11 w-11 items-center justify-center rounded-full transition-all sm:h-12 sm:w-12 ${
                  activePanel === 'contact'
                    ? 'bg-[#102d92] text-white shadow-[0_12px_24px_rgba(16,45,146,0.24)]'
                    : 'bg-[#eef1ff] text-[#102d92] hover:bg-[#dde1ff]'
                }`}
                aria-label="Abrir contacto"
              >
                <Headphones size={20} />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
