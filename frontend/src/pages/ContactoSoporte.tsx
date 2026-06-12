import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bug,
  ChevronRight,
  Headset,
  HelpCircle,
  Info,
  LoaderCircle,
  Mail,
  MessageCircle,
  Send,
  X,
} from 'lucide-react';
import { AppBottomNav } from '../components/AppBottomNav';
import { SmartSelect } from '../components/SmartSelect';
import { useUser } from '../context/UserContext';
import API_URL from '../config/api';
import { validatePersonName } from '../utils/personValidation';
import { sanitizeLimitedText } from '../utils/inputLimits';

type SupportType =
  | 'Problema tecnico'
  | 'Duda general'
  | 'Reporte de error'
  | 'Sugerencia'
  | 'Otro';

type SupportForm = {
  nombre: string;
  correo: string;
  tipo: SupportType | '';
  mensaje: string;
};

type SupportErrors = Partial<Record<keyof SupportForm, string>>;
type SupportModal = 'faq' | 'reporte' | 'antes' | 'contacto' | null;

const supportTypes: Array<{ value: SupportType; label: string }> = [
  { value: 'Problema tecnico', label: 'Problema técnico' },
  { value: 'Duda general', label: 'Duda general' },
  { value: 'Reporte de error', label: 'Reporte de error' },
  { value: 'Sugerencia', label: 'Sugerencia' },
  { value: 'Otro', label: 'Otro' },
];
const SUPPORT_NAME_MAX = 60;
const SUPPORT_MESSAGE_MAX = 500;

const supportItems: Array<{
  id: Exclude<SupportModal, null>;
  title: string;
  description: string;
  icon: typeof HelpCircle;
}> = [
  {
    id: 'faq',
    title: 'Ayuda básica',
    description: 'Guías rápidas',
    icon: HelpCircle,
  },
  {
    id: 'contacto',
    title: 'Contacto',
    description: 'Canales de atención',
    icon: Headset,
  },
  {
    id: 'reporte',
    title: 'Reportar problema',
    description: 'Cuéntanos qué falló',
    icon: Bug,
  },
  {
    id: 'antes',
    title: 'Preguntas frecuentes',
    description: 'Respuestas rápidas',
    icon: Info,
  },
];

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function getFieldClass(hasError: boolean) {
  return `mt-2 block min-h-[48px] w-full rounded-[15px] border bg-white px-4 text-sm font-semibold text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#2448bd] focus:ring-4 focus:ring-[#2448bd]/12 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:ring-blue-400/20 ${
    hasError
      ? 'border-red-300 bg-red-50/40 dark:border-red-400/60 dark:bg-red-500/15'
      : 'border-[#dce4f2] dark:border-slate-700'
  }`;
}

async function sendSupportMessage(payload: Record<string, unknown>) {
  const response = await fetch(
    `${API_URL.replace(/\/$/, '')}/support/error-report`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error('No pudimos enviar tu mensaje.');
  }
}

export default function ContactoSoporte() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [activeModal, setActiveModal] = useState<SupportModal>(null);
  const [form, setForm] = useState<SupportForm>(() => ({
    nombre: user?.name ?? '',
    correo: user?.email ?? '',
    tipo: '',
    mensaje: '',
  }));
  const [errors, setErrors] = useState<SupportErrors>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'success' | 'error' | null>(null);
  const [limitNotice, setLimitNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = <Key extends keyof SupportForm>(
    field: Key,
    value: SupportForm[Key],
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setStatusMessage(null);
    setStatusTone(null);
  };

  React.useEffect(() => {
    if (!limitNotice) return undefined;
    const timeout = window.setTimeout(() => setLimitNotice(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [limitNotice]);

  React.useEffect(() => {
    setForm((prev) => ({
      ...prev,
      nombre: user?.name ?? '',
      correo: user?.email ?? '',
    }));
    setErrors((prev) => ({
      ...prev,
      nombre: undefined,
      correo: undefined,
    }));
  }, [user?.email, user?.name]);

  const validateForm = () => {
    const nextErrors: SupportErrors = {};
    const nameValidation = validatePersonName(form.nombre, 'El nombre');
    if (!form.nombre.trim()) nextErrors.nombre = 'Escribe tu nombre.';
    else if (!nameValidation.isValid) {
      nextErrors.nombre = nameValidation.message ?? 'Escribe un nombre válido.';
    }
    if (!form.correo.trim()) {
      nextErrors.correo = 'Escribe tu correo.';
    } else if (!isValidEmail(form.correo)) {
      nextErrors.correo = 'Escribe un correo válido.';
    }
    if (!form.tipo) nextErrors.tipo = 'Selecciona el tipo de solicitud.';
    if (!form.mensaje.trim()) {
      nextErrors.mensaje = 'Cuéntanos qué pasó.';
    } else if (form.mensaje.trim().length < 12) {
      nextErrors.mensaje = 'Agrega un poco más de contexto.';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage(null);
    setStatusTone(null);
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await sendSupportMessage({
        reportId: `CS-SOP-${Date.now().toString(36).toUpperCase()}`,
        operation: 'contacto-soporte',
        userMessage: form.mensaje.trim(),
        createdAt: new Date().toISOString(),
        contact: {
          nombre: form.nombre.trim(),
          correo: form.correo.trim(),
          tipo: form.tipo,
        },
      });
      setStatusMessage('Reporte enviado correctamente.');
      setStatusTone('success');
      setForm({
        nombre: user?.name ?? '',
        correo: user?.email ?? '',
        tipo: '',
        mensaje: '',
      });
      setErrors({});
    } catch {
      setStatusMessage(
        'No pudimos enviar el reporte. Revisa tu conexión e intenta nuevamente.',
      );
      setStatusTone('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f6fb] px-4 pb-[150px] pt-5 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <main className="mx-auto w-full max-w-[430px]">
        <header className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/ajustes')}
            aria-label="Volver a ajustes"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#d9e1f0] bg-white text-[#2448bd] dark:border-slate-700 dark:bg-slate-900 dark:text-blue-200"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-[1.45rem] font-black text-slate-950 dark:text-slate-100">
            Soporte
          </h1>
          <span className="h-11 w-11" aria-hidden="true" />
        </header>

        <section className="mt-4 rounded-[18px] border border-[#dfe6f4] bg-white px-3.5 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-[#edf3ff] text-[#2448bd] dark:bg-blue-500/15 dark:text-blue-200">
              <Headset size={18} />
            </span>
            <div>
              <h2 className="text-base font-black text-slate-950 dark:text-slate-100">
                ¿Necesitas ayuda?
              </h2>
              <p className="text-xs font-semibold leading-4 text-slate-500 dark:text-slate-300">
                Elige una opción y te guiamos.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-4 space-y-2">
          {supportItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === 'faq') {
                    navigate('/soporte/ayuda');
                    return;
                  }
                  setActiveModal(item.id);
                }}
                className="flex min-h-[58px] w-full items-center gap-2.5 rounded-[15px] border border-[#dfe6f4] bg-white px-3 py-2.5 text-left shadow-sm transition active:scale-[0.99] dark:border-slate-700 dark:bg-slate-900"
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-[#edf3ff] text-[#2448bd] dark:bg-blue-500/15 dark:text-blue-200">
                  <Icon size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.86rem] font-black text-slate-950 dark:text-slate-100">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-[0.72rem] font-semibold text-slate-500 dark:text-slate-300">
                    {item.description}
                  </span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-slate-400 dark:text-slate-300" />
              </button>
            );
          })}
        </section>
      </main>

      {activeModal ? (
        <SupportModalShell
          title={getModalTitle(activeModal)}
          onClose={() => setActiveModal(null)}
        >
          {activeModal === 'antes' ? <BeforeContactContent /> : null}
          {activeModal === 'contacto' ? <ContactContent /> : null}
          {activeModal === 'reporte' ? (
            <ReportForm
              form={form}
              errors={errors}
              statusMessage={statusMessage}
              statusTone={statusTone}
              isSubmitting={isSubmitting}
              limitNotice={limitNotice}
              setLimitNotice={setLimitNotice}
              updateField={updateField}
              onSubmit={handleSubmit}
            />
          ) : null}
        </SupportModalShell>
      ) : null}

      <AppBottomNav />
    </div>
  );
}

function getModalTitle(modal: Exclude<SupportModal, null>) {
  if (modal === 'reporte') return 'Reportar problema';
  if (modal === 'antes') return 'Preguntas frecuentes';
  if (modal === 'faq') return 'Ayuda básica';
  return 'Contacto';
}

function SupportModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex h-[100dvh] items-end justify-center bg-slate-900/55 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm sm:items-center">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="support-modal-title"
        className="flex max-h-[min(82dvh,620px)] w-full max-w-[410px] flex-col overflow-hidden rounded-[22px] border border-slate-200 bg-white text-slate-900 shadow-[0_28px_70px_rgba(15,23,42,0.28)] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-700">
          <h2 id="support-modal-title" className="text-base font-black text-slate-950 dark:text-slate-100">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar soporte"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500 dark:bg-slate-800 dark:text-slate-300"
          >
            <X size={16} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {children}
        </div>
      </section>
    </div>
  );
}

function BeforeContactContent() {
  return (
    <div className="space-y-3">
      <InfoCard title="¿Cuándo se libera espacio en bodega?">
        El espacio se libera cuando registras una venta, finalizas un secado o
        cancelas un proceso de secado que devuelve café verde al inventario.
        También puedes ampliar la capacidad desde Ajustes.
      </InfoCard>
      <InfoCard title="Ten a mano el paso donde ocurrió">
        Por ejemplo: compra, venta, perfil, inventario o login.
      </InfoCard>
      <InfoCard title="Describe qué esperabas">
        Una frase clara nos ayuda más que un mensaje técnico.
      </InfoCard>
      <InfoCard title="Prueba Recargar">
        Si fue un problema de conexión, puede resolverse al intentar de nuevo.
      </InfoCard>
    </div>
  );
}

function ContactContent() {
  return (
    <div className="space-y-3">
      <a
        href="https://wa.me/573000000000?text=Hola%20Caf%C3%A9Smart%2C%20necesito%20ayuda."
        className="flex items-center gap-3 rounded-[18px] border border-[#dfe6f4] bg-[#fbfcff] p-4 text-left dark:border-slate-700 dark:bg-slate-800"
      >
        <MessageCircle className="text-[#2448bd] dark:text-blue-200" size={20} />
        <span>
          <span className="block text-sm font-black text-slate-950 dark:text-slate-100">WhatsApp</span>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-300">Respuesta rápida</span>
        </span>
      </a>
      <a
        href="mailto:soporte@cafesmart.com?subject=Soporte%20Caf%C3%A9Smart"
        className="flex items-center gap-3 rounded-[18px] border border-[#dfe6f4] bg-[#fbfcff] p-4 text-left dark:border-slate-700 dark:bg-slate-800"
      >
        <Mail className="text-[#2448bd] dark:text-blue-200" size={20} />
        <span>
          <span className="block text-sm font-black text-slate-950 dark:text-slate-100">Correo</span>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-300">soporte@cafesmart.com</span>
        </span>
      </a>
    </div>
  );
}

function ReportForm({
  form,
  errors,
  statusMessage,
  statusTone,
  isSubmitting,
  limitNotice,
  setLimitNotice,
  updateField,
  onSubmit,
}: {
  form: SupportForm;
  errors: SupportErrors;
  statusMessage: string | null;
  statusTone: 'success' | 'error' | null;
  isSubmitting: boolean;
  limitNotice: string | null;
  setLimitNotice: (message: string) => void;
  updateField: <Key extends keyof SupportForm>(
    field: Key,
    value: SupportForm[Key],
  ) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="space-y-4" noValidate onSubmit={onSubmit}>
      {limitNotice ? (
        <div className="rounded-[14px] border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 dark:border-amber-400/60 dark:bg-amber-500/15 dark:text-amber-100">
          {limitNotice}
        </div>
      ) : null}
      <SupportField id="support-name" label="Nombre" error={errors.nombre}>
        <input
          id="support-name"
          type="text"
          autoComplete="name"
          value={form.nombre}
          maxLength={SUPPORT_NAME_MAX}
          onChange={(event) => {
            if (event.target.value.length >= SUPPORT_NAME_MAX) {
              setLimitNotice('Llegaste al máximo permitido.');
            }
            updateField(
              'nombre',
              sanitizeLimitedText(event.target.value, SUPPORT_NAME_MAX),
            );
          }}
          placeholder="Ej. Laura Gómez"
          className={getFieldClass(Boolean(errors.nombre))}
        />
        <p className="mt-1 text-right text-xs font-bold text-slate-500 dark:text-slate-300">
          {form.nombre.length}/{SUPPORT_NAME_MAX}
        </p>
      </SupportField>
      <SupportField id="support-email" label="Correo electrónico" error={errors.correo}>
        <input
          id="support-email"
          type="email"
          autoComplete="email"
          value={form.correo}
          onChange={(event) => updateField('correo', event.target.value)}
          placeholder="ejemplo@correo.com"
          className={getFieldClass(Boolean(errors.correo))}
        />
      </SupportField>
      <SupportField id="support-type" label="Tipo de solicitud" error={errors.tipo}>
        <SmartSelect
          id="support-type"
          value={form.tipo}
          onChange={(event) =>
            updateField('tipo', event.target.value as SupportType)
          }
          className={errors.tipo ? 'border-red-300 bg-red-50/40 dark:border-red-400/60 dark:bg-red-500/15' : ''}
        >
          <option value="">Selecciona una opción</option>
          {supportTypes.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </SmartSelect>
      </SupportField>
      <SupportField id="support-message" label="Mensaje" error={errors.mensaje}>
        <textarea
          id="support-message"
          rows={5}
          value={form.mensaje}
          maxLength={SUPPORT_MESSAGE_MAX}
          onChange={(event) => {
            if (event.target.value.length >= SUPPORT_MESSAGE_MAX) {
              setLimitNotice('Llegaste al máximo permitido.');
            }
            updateField(
              'mensaje',
              sanitizeLimitedText(event.target.value, SUPPORT_MESSAGE_MAX),
            );
          }}
          placeholder="Ej. Estaba registrando una venta y no pude guardar."
          className={`${getFieldClass(Boolean(errors.mensaje))} min-h-[130px] py-3 leading-6`}
        />
        <p className="mt-1 text-right text-xs font-bold text-slate-500 dark:text-slate-300">
          {form.mensaje.length}/{SUPPORT_MESSAGE_MAX}
        </p>
      </SupportField>
      {statusMessage ? (
        <div
          className={`rounded-[15px] border px-4 py-3 text-sm font-bold ${
            statusTone === 'error'
              ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-400/60 dark:bg-red-500/15 dark:text-red-100'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/60 dark:bg-emerald-500/15 dark:text-emerald-100'
          }`}
        >
          <p>{statusMessage}</p>
          {statusTone === 'error' ? (
            <button
              type="submit"
              className="mt-3 rounded-[12px] bg-[#2448bd] px-4 py-2 text-xs font-black text-white"
            >
              Reintentar
            </button>
          ) : null}
        </div>
      ) : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[16px] bg-[#2448bd] px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={18} />}
        {isSubmitting ? 'Enviando...' : 'Enviar reporte'}
      </button>
    </form>
  );
}

function SupportField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-black text-slate-900 dark:text-slate-100">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-2 text-xs font-bold text-red-700 dark:text-red-200">{error}</p>
      ) : null}
    </div>
  );
}

function InfoCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-[18px] border border-[#e6ebf5] bg-[#fbfcff] p-4 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="text-sm font-black text-slate-950 dark:text-slate-100">{title}</h3>
      <p className="mt-1 text-sm font-semibold leading-6 text-slate-600 dark:text-slate-300">
        {children}
      </p>
    </article>
  );
}
