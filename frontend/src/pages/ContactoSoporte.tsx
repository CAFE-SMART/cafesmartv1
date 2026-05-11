import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Bug,
  ChevronDown,
  Headset,
  HelpCircle,
  LifeBuoy,
  LoaderCircle,
  Mail,
  MessageCircle,
  Send,
  Sparkles,
} from 'lucide-react';
import { AppBottomNav } from '../components/AppBottomNav';
import { AccessibleModal } from '../components/AccessibleModal';
import { CafeSmartErrorState } from '../components/CafeSmartErrorState';
import { useUser } from '../context/UserContext';
import API_URL from '../config/api';

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

function ariaInvalid(active: boolean) {
  return { 'aria-invalid': active ? 'true' : 'false' } as const;
}

const supportTypes: Array<{
  value: SupportType;
  label: string;
  description: string;
  badge: string;
}> = [
  {
    value: 'Problema tecnico',
    label: 'Problema técnico',
    description: 'Algo no carga, no guarda o no responde.',
    badge: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  {
    value: 'Duda general',
    label: 'Duda general',
    description: 'Necesitas orientación para usar Café Smart.',
    badge: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  {
    value: 'Reporte de error',
    label: 'Reporte de error',
    description: 'Encontraste un comportamiento inesperado.',
    badge: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  {
    value: 'Sugerencia',
    label: 'Sugerencia',
    description: 'Tienes una idea para mejorar el sistema.',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    value: 'Otro',
    label: 'Otro',
    description: 'Tu caso no encaja en las opciones anteriores.',
    badge: 'bg-slate-50 text-slate-700 border-slate-200',
  },
];

const contactCards = [
  {
    id: 'whatsapp',
    title: 'WhatsApp',
    description: 'Habla con soporte rápidamente',
    icon: MessageCircle,
    href: 'https://wa.me/573000000000?text=Hola%20Caf%C3%A9%20Smart%2C%20necesito%20ayuda.',
    action: 'Abrir WhatsApp',
  },
  {
    id: 'correo',
    title: 'Correo',
    description: 'Envíanos tus dudas o reportes',
    icon: Mail,
    href: 'mailto:soporte@cafesmart.com?subject=Soporte%20Caf%C3%A9%20Smart',
    action: 'Escribir correo',
  },
  {
    id: 'faq',
    title: 'FAQ / Ayuda',
    description: 'Consulta preguntas frecuentes',
    icon: HelpCircle,
    href: '#preguntas-frecuentes',
    action: 'Ver preguntas',
  },
  {
    id: 'reporte',
    title: 'Reportar problema',
    description: 'Ayúdanos a mejorar Café Smart',
    icon: Bug,
    href: '#formulario-soporte',
    action: 'Reportar problema',
  },
];

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function getFieldClass(hasError: boolean) {
  return `mt-2 block min-h-[52px] w-full rounded-[16px] border bg-white px-4 text-base font-semibold text-slate-950 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#2448bd] focus:ring-4 focus:ring-[#2448bd]/12 ${
    hasError ? 'border-rose-300 bg-rose-50/40' : 'border-[#dce4f2]'
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
    throw new Error('No pudimos enviar tu mensaje. Inténtalo nuevamente.');
  }
}

export default function ContactoSoporte() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [form, setForm] = useState<SupportForm>(() => ({
    nombre: user?.name ?? '',
    correo: user?.email ?? '',
    tipo: '',
    mensaje: '',
  }));
  const [errors, setErrors] = useState<SupportErrors>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const selectedType = useMemo(
    () => supportTypes.find((item) => item.value === form.tipo),
    [form.tipo],
  );

  const updateField = <Key extends keyof SupportForm>(
    field: Key,
    value: SupportForm[Key],
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setStatusMessage(null);
  };

  const validateForm = () => {
    const nextErrors: SupportErrors = {};

    if (!form.nombre.trim()) {
      nextErrors.nombre = 'Este campo es necesario para saber cómo llamarte.';
    }

    if (!form.correo.trim()) {
      nextErrors.correo = 'Escribe el correo donde quieres recibir respuesta.';
    } else if (!isValidEmail(form.correo)) {
      nextErrors.correo = 'Por favor escribe un correo válido.';
    }

    if (!form.tipo) {
      nextErrors.tipo = 'Elige el tipo de solicitud para atenderte mejor.';
    }

    if (!form.mensaje.trim()) {
      nextErrors.mensaje =
        'Cuéntanos qué pasó o qué necesitas. Una frase breve es suficiente.';
    } else if (form.mensaje.trim().length < 12) {
      nextErrors.mensaje =
        'Agrega un poco más de contexto para poder ayudarte mejor.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatusMessage(null);

    if (!validateForm()) {
      setStatusMessage('Parece que algunos datos necesitan corrección.');
      return;
    }

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
        location:
          typeof window !== 'undefined' ? window.location.pathname : undefined,
      });
      setShowSuccess(true);
    } catch (error) {
      setStatusMessage('No pudimos enviar tu mensaje. Inténtalo nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm({
      nombre: user?.name ?? '',
      correo: user?.email ?? '',
      tipo: '',
      mensaje: '',
    });
    setErrors({});
    setStatusMessage(null);
    setShowSuccess(false);
  };

  return (
    <div className="min-h-screen bg-[#f4f6fb] px-4 pb-[150px] pt-5 text-slate-950">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="relative overflow-hidden rounded-[24px] border border-[#dfe6f4] bg-white px-5 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.08)]">
          <button
            type="button"
            onClick={() => navigate('/ajustes')}
            className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-[#d9e1f0] bg-white px-4 text-sm font-black text-[#2448bd] transition hover:bg-[#f6f8ff] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#2448bd]/20"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver
          </button>

          <div className="grid gap-5 md:grid-cols-[1.1fr_0.9fr] md:items-end">
            <div>
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#edf3ff] text-[#2448bd]">
                <Headset className="h-7 w-7" aria-hidden="true" />
              </div>
              <h1 className="mt-4 text-[2rem] font-black leading-tight tracking-normal text-[#0f172a] sm:text-[2.6rem]">
                ¿Necesitas ayuda?
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                Estamos aquí para ayudarte con cualquier duda, problema o
                sugerencia.
              </p>
            </div>

            <aside className="rounded-[18px] border border-[#e5ebf7] bg-[#f8faff] p-4">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#2448bd] shadow-sm">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </span>
                <p className="text-sm leading-6 text-slate-600">
                  Describe lo que ocurre con palabras simples. Te responderemos
                  con pasos claros para resolverlo.
                </p>
              </div>
            </aside>
          </div>
        </header>

        <section aria-labelledby="contacto-rapido-title">
          <h2
            id="contacto-rapido-title"
            className="text-sm font-black uppercase tracking-[0.14em] text-slate-500"
          >
            Contacto rápido
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {contactCards.map((card) => {
              const Icon = card.icon;
              return (
                <a
                  key={card.id}
                  href={card.href}
                  className="group rounded-[20px] border border-[#dfe6f4] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[#b9c8ee] hover:shadow-[0_18px_36px_rgba(36,72,189,0.10)] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#2448bd]/20"
                  aria-label={`${card.action}: ${card.description}`}
                >
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#edf3ff] text-[#2448bd] transition group-hover:bg-[#2448bd] group-hover:text-white">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="mt-4 block text-lg font-black text-slate-950">
                    {card.title}
                  </span>
                  <span className="mt-1 block text-sm leading-5 text-slate-600">
                    {card.description}
                  </span>
                </a>
              );
            })}
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <section
            id="preguntas-frecuentes"
            aria-labelledby="faq-title"
            className="rounded-[24px] border border-[#dfe6f4] bg-white p-5 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-[15px] bg-[#edf3ff] text-[#2448bd]">
                <LifeBuoy className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 id="faq-title" className="text-xl font-black text-slate-950">
                  Antes de escribirnos
                </h2>
                <p className="text-sm text-slate-500">
                  Algunas respuestas rápidas para continuar sin esperar.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <article className="rounded-[18px] border border-[#e6ebf5] bg-[#fbfcff] p-4">
                <h3 className="font-black text-slate-900">
                  No puedo guardar una compra
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Revisa que tengas conexión y que los campos obligatorios estén
                  completos. Si el problema sigue, envíanos el mensaje desde el
                  formulario.
                </p>
              </article>
              <article className="rounded-[18px] border border-[#e6ebf5] bg-[#fbfcff] p-4">
                <h3 className="font-black text-slate-900">
                  Los datos no se actualizan
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Intenta volver a la pantalla de inicio o refrescar la
                  aplicación. Tus registros guardados permanecen en el sistema.
                </p>
              </article>
              <article className="rounded-[18px] border border-[#e6ebf5] bg-[#fbfcff] p-4">
                <h3 className="font-black text-slate-900">
                  Necesito explicar un caso especial
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Selecciona “Otro” y cuéntanos el contexto. Te ayudaremos a
                  encontrar el mejor camino.
                </p>
              </article>
            </div>
          </section>

          <section
            id="formulario-soporte"
            aria-labelledby="support-form-title"
            className="rounded-[24px] border border-[#dfe6f4] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.07)]"
          >
            <div className="flex items-start gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[#edf3ff] text-[#2448bd]">
                <Send className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2
                  id="support-form-title"
                  className="text-xl font-black leading-tight text-slate-950"
                >
                  Cuéntanos cómo podemos ayudarte
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Te responderemos con una guía clara. No necesitas usar palabras
                  técnicas.
                </p>
              </div>
            </div>

            <form className="mt-5 space-y-5" noValidate onSubmit={handleSubmit}>
              <SupportField
                id="support-name"
                label="Nombre"
                hint="Así sabremos cómo dirigirnos a ti."
                error={errors.nombre}
              >
                <input
                  id="support-name"
                  type="text"
                  autoComplete="name"
                  value={form.nombre}
                  onChange={(event) => updateField('nombre', event.target.value)}
                  placeholder="Ej: Laura Gómez"
                  {...ariaInvalid(Boolean(errors.nombre))}
                  aria-label="Nombre"
                  title="Nombre"
                  aria-describedby="support-name-hint support-name-error"
                  className={getFieldClass(Boolean(errors.nombre))}
                />
              </SupportField>

              <SupportField
                id="support-email"
                label="Correo electrónico"
                hint="Te responderemos a este correo."
                error={errors.correo}
              >
                <input
                  id="support-email"
                  type="email"
                  autoComplete="email"
                  value={form.correo}
                  onChange={(event) => updateField('correo', event.target.value)}
                  placeholder="ejemplo@correo.com"
                  {...ariaInvalid(Boolean(errors.correo))}
                  aria-label="Correo electrónico"
                  title="Correo electrónico"
                  aria-describedby="support-email-hint support-email-error"
                  className={getFieldClass(Boolean(errors.correo))}
                />
              </SupportField>

              <SupportField
                id="support-type"
                label="Tipo de solicitud"
                hint="Esto nos ayuda a priorizar y responder mejor."
                error={errors.tipo}
              >
                <div className="relative">
                  <select
                    id="support-type"
                    value={form.tipo}
                    onChange={(event) =>
                      updateField('tipo', event.target.value as SupportType)
                    }
                    {...ariaInvalid(Boolean(errors.tipo))}
                    aria-label="Tipo de solicitud"
                    title="Tipo de solicitud"
                    aria-describedby="support-type-hint support-type-error"
                    className={`${getFieldClass(Boolean(errors.tipo))} appearance-none pr-12`}
                  >
                    <option value="">Selecciona una opción</option>
                    {supportTypes.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500"
                    aria-hidden="true"
                  />
                </div>
                {selectedType ? (
                  <p
                    className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${selectedType.badge}`}
                  >
                    {selectedType.description}
                  </p>
                ) : null}
              </SupportField>

              <SupportField
                id="support-message"
                label="Mensaje"
                hint="Cuéntanos qué pasó, qué estabas intentando hacer o qué te gustaría mejorar."
                error={errors.mensaje}
              >
                <textarea
                  id="support-message"
                  rows={5}
                  value={form.mensaje}
                  onChange={(event) =>
                    updateField('mensaje', event.target.value)
                  }
                  placeholder="Ej: Estaba registrando una venta y no pude guardar el cliente."
                  {...ariaInvalid(Boolean(errors.mensaje))}
                  aria-label="Mensaje"
                  title="Mensaje"
                  aria-describedby="support-message-hint support-message-error"
                  className={`${getFieldClass(Boolean(errors.mensaje))} min-h-[140px] py-3 leading-6`}
                />
              </SupportField>

              {statusMessage ? (
                <p
                  role="alert"
                  aria-live="assertive"
                  className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold leading-6 text-rose-700"
                >
                  {statusMessage}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#2448bd] px-5 text-base font-black text-white shadow-[0_16px_30px_rgba(36,72,189,0.22)] transition hover:bg-[#1d3da3] focus:outline-none focus-visible:ring-4 focus-visible:ring-[#2448bd]/25 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? (
                  <>
                    <LoaderCircle
                      className="h-5 w-5 animate-spin"
                      aria-hidden="true"
                    />
                    Enviando mensaje…
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5" aria-hidden="true" />
                    Enviar mensaje
                  </>
                )}
              </button>
            </form>
          </section>
        </div>
      </main>

      {showSuccess ? (
        <AccessibleModal
          title="Mensaje enviado con éxito"
          description="Recibirás una respuesta lo antes posible."
          onClose={() => setShowSuccess(false)}
          className="border-0 bg-transparent p-0 shadow-none"
        >
          <CafeSmartErrorState
            variant="success"
            title="Mensaje enviado con éxito"
            message="Recibirás una respuesta lo antes posible. Gracias por ayudarnos a mejorar CaféSmart."
            primaryLabel="Volver al inicio"
            secondaryLabel="Enviar otro mensaje"
            onPrimary={() => navigate('/inicio')}
            onSecondary={resetForm}
            info="Tu solicitud quedó registrada para que soporte pueda revisarla."
          />
        </AccessibleModal>
      ) : null}

      <AppBottomNav />
    </div>
  );
}

function SupportField({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-black text-slate-900">
        {label} <span className="text-rose-600">*</span>
      </label>
      <p id={`${id}-hint`} className="mt-1 text-sm leading-5 text-slate-500">
        {hint}
      </p>
      {children}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          aria-live="polite"
          className="mt-2 text-sm font-semibold leading-5 text-rose-700"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
