import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Loader,
  Lock,
  Mail,
  Phone,
  User,
  UserPlus,
  Users,
  Store,
  Settings,
  CircleHelp,
  Headset,
  X,
} from 'lucide-react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import {
  createGuidedError,
  InlineGuidedError,
  type GuidedErrorMessage,
} from '../components/forms/GuidedError';
import { RegisterProgress } from '../components/register/RegisterProgress';
import { CafeSmartLogo } from '../components/CafeSmartLogo';
import { useRegisterForm } from '../hooks/useRegisterForm';
import {
  EMAIL_REGEX,
  getPasswordChecks,
  getPasswordStrength,
  type RegisterLocationState,
  type TipoOrg,
} from '../utils/registerValidators';
import { getGooglePrefillFromIdToken } from '../utils/googleProfile';

type RegisterField =
  | 'nombreOrganizacion'
  | 'tipoOrganizacion'
  | 'otroTipoDetalle'
  | 'nombre'
  | 'apellidos'
  | 'telefono'
  | 'correo'
  | 'password'
  | 'confirmPassword';

function SimpleFieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={id} className="mt-2 text-sm font-semibold leading-5 text-red-600">
      {message}
    </p>
  );
}

function formatColombianMobileInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  const first = digits.slice(0, 3);
  const second = digits.slice(3, 6);
  const third = digits.slice(6, 10);

  return [first, second, third].filter(Boolean).join(' ');
}

function passwordRequirementClass(isMet: boolean) {
  return isMet ? 'text-emerald-700' : 'text-slate-500';
}

function SectionTitle({ children, icon }: { children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[#2563eb]">
        {icon}
      </span>
      <p className="text-[1.18rem] font-extrabold tracking-normal text-slate-900">
        {children}
      </p>
    </div>
  );
}

function fieldStateClass(hasError: boolean, isValid: boolean) {
  if (hasError) return 'border-red-300 bg-white text-gray-800 shadow-[0_10px_22px_rgba(248,113,113,0.14)]';
  if (isValid) return 'border-emerald-400 bg-white text-gray-800 shadow-[0_10px_22px_rgba(52,211,153,0.12)]';
  return 'border-white bg-white text-gray-800 shadow-[0_10px_22px_rgba(15,23,42,0.08)]';
}

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const googleButtonWidth =
    typeof window !== 'undefined'
      ? String(Math.min(360, Math.max(240, window.innerWidth - 64)))
      : '320';
  const isGoogleAuthEnabled = Boolean(
    (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim(),
  );
  const isAndroidApp = Capacitor.getPlatform() === 'android';
  const [googleLoading, setGoogleLoading] = useState(false);
  const [supportModal, setSupportModal] = useState<'help' | 'contact' | null>(null);
  const initialRouteState = useMemo(
    () => ((location.state ?? null) as RegisterLocationState | null),
    [location.state],
  );
  const [googleRouteState, setGoogleRouteState] = useState<RegisterLocationState>(
    () => initialRouteState ?? {},
  );

  useEffect(() => {
    if (initialRouteState?.googleToken) {
      setGoogleRouteState(initialRouteState);
    }
  }, [initialRouteState]);

  const hasGoogleFlow = Boolean(googleRouteState.googleToken);
  const googlePrefill = googleRouteState.googlePrefill;
  const {
    step,
    nombreOrganizacion,
    setNombreOrganizacion,
    tipoOrganizacion,
    setTipoOrganizacion,
    otroTipoDetalle,
    setOtroTipoDetalle,
    stepOneErrors,
    setStepOneErrors,
    nombre,
    setNombre,
    apellidos,
    setApellidos,
    telefono,
    setTelefono,
    correo,
    setCorreo,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    setShowPassword,
    stepTwoErrors,
    setStepTwoErrors,
    isCheckingEmail,
    error,
    goToStep2,
    goBackToStep1,
    handleSubmit,
    validateEmailAvailability,
  } = useRegisterForm({ hasGoogleFlow, routeState: googleRouteState, navigate });

  const tiposOrg: { value: TipoOrg; label: string; desc: string; icon: React.ReactNode }[] = [
    {
      value: 'COMPRAVENTA',
      label: 'Compraventa',
      desc: 'Compras cafe para revenderlo y obtener ganancias.',
      icon: <Store size={22} />,
    },
    {
      value: 'COOPERATIVA',
      label: 'Cooperativa',
      desc: 'Recibes cafe de productores y lo vendes por ellos.',
      icon: <Users size={22} />,
    },
    {
      value: 'PERSONALIZADO',
      label: 'Personalizado',
      desc: 'Otro tipo de negocio cafetero',
      icon: <Settings size={22} />,
    },
  ];

  const colorByType: Record<TipoOrg, string> = {
    COOPERATIVA: 'bg-blue-100 text-blue-700',
    COMPRAVENTA: 'bg-amber-100 text-amber-700',
    PERSONALIZADO: 'bg-rose-100 text-rose-700',
  };

  const progressPercent = step === 1 ? 50 : 100;
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const isStepOneComplete =
    nombreOrganizacion.trim().replace(/\s+/g, ' ').length >= 2 && Boolean(tipoOrganizacion);
  const passwordStrength = getPasswordStrength(password);
  const passwordChecks = getPasswordChecks(password);
  const hasStartedConfirming = confirmPassword.length > 0;
  const passwordsMatch = password.length > 0 && confirmPassword === password;
  const isNombreValid = nombre.trim().length > 0;
  const isApellidosValid = apellidos.trim().length > 0;
  const isTelefonoValid = /^3\d{9}$/.test(telefono.replace(/\D/g, ''));
  const isCorreoValid = EMAIL_REGEX.test(correo.trim());
  const isPasswordValid =
    passwordChecks.minLength &&
    passwordChecks.hasUpper &&
    passwordChecks.hasLower &&
    passwordChecks.hasNumber;

  useEffect(() => {
    const progressTimer = window.setTimeout(() => {
      setAnimatedProgress(progressPercent);
    }, 40);

    return () => window.clearTimeout(progressTimer);
  }, [progressPercent]);

  const getRegisterFieldGuidance = (field: RegisterField, message: string): GuidedErrorMessage => {
    if (field === 'nombreOrganizacion') {
      return createGuidedError(
        message,
        'Falta el nombre.',
        'No sabemos cómo se llama tu negocio.',
        'Escribe el nombre de tu empresa.',
      );
    }

    if (field === 'tipoOrganizacion') {
      return createGuidedError(
        message,
        'Falta el tipo.',
        'Cuéntanos a qué se dedica el negocio.',
        'Elige cooperativa, compraventa u otro.',
      );
    }

    if (field === 'otroTipoDetalle') {
      return createGuidedError(
        message,
        'Falta especificar.',
        'Queremos conocer más sobre tu actividad.',
        'Describe muy brevemente a qué te dedicas.',
      );
    }

    if (field === 'nombre') {
      return createGuidedError(
        message,
        'Falta el nombre.',
        'No sabemos cómo llamarte.',
        'Escribe el nombre del administrador.',
      );
    }

    if (field === 'apellidos') {
      return createGuidedError(
        message,
        'Faltan tus apellidos.',
        'Es importante registrarlos por seguridad.',
        'Escribe tus apellidos.',
      );
    }

    if (field === 'telefono') {
      return createGuidedError(
        message,
        'Revisa el teléfono.',
        'Parece que falta algún número.',
        'Ingresa un celular válido.',
      );
    }

    if (field === 'correo') {
      return createGuidedError(
        message,
        'Revisa tu correo.',
        'O no está bien escrito, o alguien ya lo usa.',
        'Corrige y verifica el correo.',
      );
    }

    if (field === 'password') {
      return createGuidedError(
        message,
        'La contraseña es débil.',
        'Usa al menos 6 letras, incluyendo mayúscula y minúscula.',
        'Mejora tu contraseña.',
      );
    }

    return createGuidedError(
      message,
      'Las contraseñas son distintas.',
      'Asegúrate de escribir la misma en ambos campos.',
      'Repite la contraseña.',
    );
  };

  const getRegisterGlobalGuidance = (message: string) =>
    createGuidedError(
      message,
      'Problema registrando.',
      'Algo salió mal validando tus datos.',
      'Revisa lo que marcamos en rojo e intenta de nuevo.',
    );

  const handleGoogleRegisterSuccess = (credentialResponse: CredentialResponse) => {
    const idToken = credentialResponse?.credential;

    if (!idToken) {
      setGoogleLoading(false);
      return;
    }

    setGoogleRouteState({
      googleToken: idToken,
      googlePrefill: getGooglePrefillFromIdToken(idToken),
    });
    setGoogleLoading(false);
  };

  const handleGoogleRegisterError = () => {
    setGoogleLoading(false);
  };

  const goToLogin = () => {
    setGoogleLoading(false);
    setGoogleRouteState({});
    navigate('/login', { replace: true });
  };

  const handleHeaderBack = () => {
    if (step === 1) {
      goToLogin();
      return;
    }

    goBackToStep1();
  };

  const closeSupportModal = () => {
    setSupportModal(null);
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex flex-col font-sans text-gray-900">
      <main className="flex-1 flex flex-col items-center px-0 pb-0">
        <div className="w-full max-w-[520px]">
          {step === 1 && (
            <section
              aria-labelledby="register-business-title"
              className="flex h-[100dvh] min-h-screen flex-col overflow-hidden bg-[#f3f4f6]"
            >
              <div className="shrink-0 border-b border-slate-200 px-4 py-3">
                <div className="relative flex min-h-[34px] items-center justify-center">
                <button
                  type="button"
                  onClick={handleHeaderBack}
                    className="absolute left-0 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
                  aria-label="Volver al ingreso"
                >
                  <ArrowLeft size={18} />
                </button>
                  <h1 id="register-business-title" className="text-center text-[1.78rem] font-semibold text-[#111827]">
                  Crear cuenta
                </h1>
                </div>
                <CafeSmartLogo size="sm" compact className="mt-3" />
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4">
                <div className="mb-6">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-[0.95rem] font-bold text-slate-700">Paso 1: Información del negocio</p>
                    <p className="text-[0.95rem] font-black text-[#4f46e5]">1 de 2</p>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-[#4f46e5] transition-[width] duration-500 ease-in-out"
                      style={{ width: `${animatedProgress}%` }}
                    />
                  </div>
                </div>

                <h2 className="mb-5 text-[1.92rem] font-semibold leading-[1.12] tracking-[-0.02em] text-[#111827]">
                  Comencemos configurando tu negocio
                </h2>

                {error ? (
                  <InlineGuidedError
                    message={getRegisterGlobalGuidance(error)}
                    className="mb-6"
                  />
                ) : null}

                <div className="mb-5">
                  <label htmlFor="register-business-name" className="mb-2 block text-[0.82rem] font-black uppercase tracking-[0.08em] text-[#1f2937]">
                    Nombre del negocio
                  </label>
                  <input
                    id="register-business-name"
                    name="businessName"
                    type="text"
                    value={nombreOrganizacion}
                    onChange={(e) => {
                      setNombreOrganizacion(e.target.value);
                      setStepOneErrors((prev) => ({ ...prev, nombreOrganizacion: undefined }));
                    }}
                    placeholder="Ej: Café Los Alpes"
                    autoComplete="organization"
                    aria-invalid={Boolean(stepOneErrors.nombreOrganizacion)}
                    aria-describedby={
                      stepOneErrors.nombreOrganizacion ? 'register-business-name-error' : undefined
                    }
                    className={`block min-h-[52px] w-full rounded-2xl border px-4 py-3 text-[1.02rem] text-[#111827] placeholder:text-[#9ca3af] focus:border-[#274397] focus:outline-none focus:ring-2 focus:ring-[#274397]/15 ${
                      stepOneErrors.nombreOrganizacion
                        ? 'border-red-300 bg-red-50/50'
                        : 'border-[#e5e7eb] bg-[#f8fafc]'
                    }`}
                  />
                  {stepOneErrors.nombreOrganizacion && (
                    <InlineGuidedError
                      id="register-business-name-error"
                      message={getRegisterFieldGuidance(
                        'nombreOrganizacion',
                        stepOneErrors.nombreOrganizacion,
                      )}
                      className="mt-2"
                    />
                  )}
                </div>

                <div>
                  <label className="mb-3 block text-[0.82rem] font-black uppercase tracking-[0.08em] text-[#1f2937]" id="register-business-type-label">
                    Tipo de negocio
                  </label>
                <div
                  role="radiogroup"
                  aria-labelledby="register-business-type-label"
                  aria-describedby={
                    stepOneErrors.tipoOrganizacion ? 'register-business-type-error' : undefined
                  }
                    className="grid grid-cols-1 gap-3"
                >
                  {tiposOrg.map((t) => {
                    const selected = tipoOrganizacion === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => {
                          setTipoOrganizacion(t.value);
                          setStepOneErrors((prev) => ({ ...prev, tipoOrganizacion: undefined }));
                        }}
                          className={`w-full rounded-[16px] border px-4 py-3 text-left transition-all ${
                          selected
                              ? 'border-[#2f4da2] bg-[#f5f8ff] shadow-[0_0_0_1px_rgba(47,77,162,0.08)]'
                              : 'border-[#d6dbe3] bg-white hover:border-[#c7cfdb]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            <div
                                className={`flex h-11 w-11 items-center justify-center rounded-xl ${colorByType[t.value]}`}
                            >
                              {t.icon}
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                              <p className="text-[1.08rem] font-semibold tracking-normal text-[#111827]">
                              {t.label}
                            </p>
                              <p className="mt-1 text-[0.96rem] leading-5 text-slate-500">
                              {t.desc}
                            </p>
                          </div>
                          <div
                              className={`flex h-7 w-7 items-center justify-center rounded-full border transition-all ${
                              selected
                                ? 'border-[#1d4ed8] bg-[#1d4ed8] text-white'
                                  : 'border-slate-300 bg-white text-transparent'
                            }`}
                            aria-hidden="true"
                          >
                            <Check size={14} strokeWidth={3} />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {stepOneErrors.tipoOrganizacion && (
                  <InlineGuidedError
                    id="register-business-type-error"
                    message={getRegisterFieldGuidance(
                      'tipoOrganizacion',
                      stepOneErrors.tipoOrganizacion,
                    )}
                    className="mt-2"
                  />
                )}
                </div>
              </div>

              <div className="shrink-0 border-t border-slate-200 bg-[#f3f4f6]/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_24px_rgba(15,23,42,0.08)] backdrop-blur">
                <button
                  type="button"
                  onClick={goToStep2}
                  disabled={!isStepOneComplete}
                  className={`w-full rounded-full px-4 py-4 text-[1.08rem] font-bold text-white shadow-[0_12px_24px_rgba(30,64,175,0.24)] transition-all duration-200 ease-in-out active:scale-[0.98] ${
                    isStepOneComplete
                      ? 'bg-[#1d4ed8] hover:bg-[#1e40af] active:shadow-[0_8px_18px_rgba(30,64,175,0.28)]'
                      : 'bg-[#1d4ed8]/45 shadow-none'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    Siguiente paso
                    <ArrowRight size={18} />
                  </span>
                </button>

                <div className="pt-3 text-center">
                  <p className="text-[0.86rem] font-medium text-slate-500">¿Necesitas ayuda con el registro?</p>
                  <div className="mt-2 flex items-center justify-center gap-6">
                    <button
                      type="button"
                      onClick={() => setSupportModal('help')}
                      className="inline-flex items-center gap-1.5 text-[0.96rem] font-semibold text-slate-600 transition-colors hover:text-[#28449b]"
                    >
                      <CircleHelp size={15} />
                      Ayuda
                    </button>
                    <button
                      type="button"
                      onClick={() => setSupportModal('contact')}
                      className="inline-flex items-center gap-1.5 text-[0.96rem] font-semibold text-slate-600 transition-colors hover:text-[#28449b]"
                    >
                      <Headset size={15} />
                      Contacto
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {step === 2 && (
            <section
              aria-labelledby="register-admin-title"
              className="min-h-screen bg-[#f3f4f6] px-4 pb-[calc(32px+env(safe-area-inset-bottom))] pt-3"
            >
              <div className="relative mb-3 flex min-h-[40px] items-center justify-center">
                <button
                  type="button"
                  onClick={handleHeaderBack}
                  className="absolute left-0 inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-white hover:text-gray-900 hover:shadow-sm"
                  aria-label="Volver al negocio"
                >
                  <ArrowLeft size={18} />
                </button>
                <h2 id="register-admin-title" className="text-center text-[1.9rem] font-semibold text-[#111827]">
                  Crear cuenta
                </h2>
              </div>
              <CafeSmartLogo size="sm" compact className="mb-4" />

              <div className="mb-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[1rem] font-semibold text-slate-600">
                    Paso 2: Datos del administrador
                  </p>
                  <p className="text-sm font-black text-[#1e3a8a]">2 de 2</p>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-blue-100">
                  <div
                    className="h-full rounded-full bg-[#2563eb] transition-[width] duration-500 ease-in-out"
                    style={{ width: `${animatedProgress}%` }}
                  />
                </div>
              </div>

              <div className="mb-5 flex items-center gap-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4 shadow-[0_12px_26px_rgba(30,58,138,0.1)]">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#2563eb] text-white shadow-[0_10px_18px_rgba(37,99,235,0.22)]">
                  <User size={25} strokeWidth={2.2} />
                </div>
                <div className="min-w-0">
                  <p className="text-[1.05rem] font-black leading-5 text-[#2563eb]">
                    Cuenta administradora
                  </p>
                  <p className="mt-1 text-[0.95rem] leading-5 text-slate-600">
                    Gestiona usuarios, compras e inventario.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {hasGoogleFlow && (
                  <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    Google completo nombre, apellidos y correo. Solo revisalos y termina el registro.
                  </p>
                )}

                <SectionTitle icon={<User size={20} strokeWidth={2.2} />}>Datos personales</SectionTitle>
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label htmlFor="register-admin-name" className="mb-2 block text-sm font-bold text-slate-700">
                      Nombre
                    </label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                      <input
                        id="register-admin-name"
                        name="firstName"
                        type="text"
                        value={nombre}
                        onChange={(e) => {
                          setNombre(e.target.value);
                          setStepTwoErrors((prev) => ({ ...prev, nombre: undefined }));
                        }}
                        placeholder="Ej. Juan"
                        autoComplete="given-name"
                        aria-invalid={Boolean(stepTwoErrors.nombre)}
                        aria-describedby={stepTwoErrors.nombre ? 'register-admin-name-error' : undefined}
                        className={`block min-h-[52px] w-full rounded-xl border py-3 pl-12 pr-4 text-base transition-all placeholder-gray-400 focus:border-[#1e3a8a] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 ${fieldStateClass(
                          Boolean(stepTwoErrors.nombre),
                          isNombreValid,
                        )}`}
                      />
                    </div>
                    {stepTwoErrors.nombre && (
                      <SimpleFieldError
                        id="register-admin-name-error"
                        message={stepTwoErrors.nombre}
                      />
                    )}
                  </div>

                  <div>
                    <label htmlFor="register-admin-lastname" className="mb-2 block text-sm font-bold text-slate-700">
                      Apellidos
                    </label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                      <input
                        id="register-admin-lastname"
                        name="lastName"
                        type="text"
                        value={apellidos}
                        onChange={(e) => {
                          setApellidos(e.target.value);
                          setStepTwoErrors((prev) => ({ ...prev, apellidos: undefined }));
                        }}
                        placeholder="Ej. Pérez Gómez"
                        autoComplete="family-name"
                        aria-invalid={Boolean(stepTwoErrors.apellidos)}
                        aria-describedby={
                          stepTwoErrors.apellidos ? 'register-admin-lastname-error' : undefined
                        }
                        className={`block min-h-[52px] w-full rounded-xl border py-3 pl-12 pr-4 text-base transition-all placeholder-gray-400 focus:border-[#1e3a8a] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 ${fieldStateClass(
                          Boolean(stepTwoErrors.apellidos),
                          isApellidosValid,
                        )}`}
                      />
                    </div>
                    {stepTwoErrors.apellidos && (
                      <SimpleFieldError
                        id="register-admin-lastname-error"
                        message={stepTwoErrors.apellidos}
                      />
                    )}
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <SectionTitle icon={<Phone size={20} strokeWidth={2.2} />}>Contacto</SectionTitle>
                </div>
                <div>
                  <label htmlFor="register-admin-phone" className="block text-sm font-bold text-slate-700 mb-2">
                    Número de celular
                  </label>
                  <div
                    className={`flex min-h-[52px] w-full items-center overflow-hidden rounded-xl border bg-white shadow-[0_10px_22px_rgba(15,23,42,0.08)] transition-all focus-within:border-[#1e3a8a] focus-within:ring-2 focus-within:ring-[#1e3a8a]/20 ${
                      stepTwoErrors.telefono
                        ? 'border-red-300'
                        : isTelefonoValid
                          ? 'border-emerald-400'
                          : 'border-white'
                    }`}
                  >
                    <span className="flex min-h-[52px] items-center border-r border-slate-200 bg-slate-50 px-5 text-base font-black text-[#1e3a8a]">
                      +57
                    </span>
                    <input
                      id="register-admin-phone"
                      name="phone"
                      type="tel"
                      inputMode="numeric"
                      value={formatColombianMobileInput(telefono)}
                      onChange={(e) => {
                        setTelefono(e.target.value.replace(/\D/g, '').slice(0, 10));
                        setStepTwoErrors((prev) => ({ ...prev, telefono: undefined }));
                      }}
                      placeholder="300 123 4567"
                      autoComplete="tel-national"
                      aria-invalid={Boolean(stepTwoErrors.telefono)}
                      aria-describedby={stepTwoErrors.telefono ? 'register-admin-phone-error' : undefined}
                      className="min-w-0 flex-1 bg-transparent px-5 py-3 text-base text-gray-700 placeholder-gray-400 outline-none"
                    />
                  </div>
                  {stepTwoErrors.telefono && (
                    <SimpleFieldError
                      id="register-admin-phone-error"
                      message={stepTwoErrors.telefono}
                    />
                  )}
                </div>

                <div>
                  <label htmlFor="register-admin-email" className="mb-2 block text-sm font-bold text-slate-700">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      id="register-admin-email"
                      name="email"
                      type="text"
                      inputMode="email"
                      value={correo}
                      onChange={(e) => {
                        setCorreo(e.target.value);
                        setStepTwoErrors((prev) => ({ ...prev, correo: undefined }));
                      }}
                      onBlur={async () => {
                        const emailExistsError = await validateEmailAvailability(correo);
                        if (emailExistsError) {
                          setStepTwoErrors((prev) => ({ ...prev, correo: emailExistsError }));
                        }
                      }}
                      placeholder="admin@empresa.com"
                      autoComplete="email"
                      aria-invalid={Boolean(stepTwoErrors.correo)}
                      aria-describedby={
                        stepTwoErrors.correo
                          ? 'register-admin-email-error'
                          : isCheckingEmail
                            ? 'register-admin-email-status'
                            : undefined
                      }
                      className={`block min-h-[52px] w-full rounded-xl border py-3 pl-12 pr-4 text-base transition-all placeholder-gray-400 focus:border-[#1e3a8a] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 ${fieldStateClass(
                        Boolean(stepTwoErrors.correo),
                        isCorreoValid,
                      )}`}
                    />
                  </div>
                  {isCheckingEmail && !stepTwoErrors.correo && (
                    <p id="register-admin-email-status" className="mt-2 text-xs font-medium text-slate-500">
                      Validando correo...
                    </p>
                  )}
                  {stepTwoErrors.correo && (
                    <SimpleFieldError
                      id="register-admin-email-error"
                      message={stepTwoErrors.correo}
                    />
                  )}
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <SectionTitle icon={<Lock size={20} strokeWidth={2.2} />}>Seguridad</SectionTitle>
                </div>
                <div>
                  <label htmlFor="register-admin-password" className="block text-sm font-bold text-slate-700 mb-2">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      id="register-admin-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setStepTwoErrors((prev) => ({ ...prev, password: undefined }));
                      }}
                      placeholder="Crea una contraseña segura"
                      autoComplete={hasGoogleFlow ? 'new-password' : 'new-password'}
                      aria-invalid={Boolean(stepTwoErrors.password)}
                      aria-describedby={stepTwoErrors.password ? 'register-admin-password-error' : undefined}
                      className={`block min-h-[52px] w-full rounded-xl border py-3 pl-12 pr-11 text-base transition-all placeholder-gray-400 focus:border-[#1e3a8a] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 ${fieldStateClass(
                        Boolean(stepTwoErrors.password),
                        isPasswordValid,
                      )}`}
                      minLength={6}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                      )}
                    </button>
                  </div>
                  {stepTwoErrors.password && (
                    <SimpleFieldError
                      id="register-admin-password-error"
                      message={stepTwoErrors.password}
                    />
                  )}
                  <div className="mt-3">
                    <div className="flex items-center gap-3">
                      <p className="shrink-0 text-sm font-extrabold text-slate-800">
                        Seguridad: <strong className="text-orange-600">{passwordStrength.label}</strong>
                      </p>
                      <div className="grid flex-1 grid-cols-3 gap-2">
                        {[1, 2, 3].map((level) => (
                          <span
                            key={level}
                            className={`h-1.5 rounded-full ${
                              passwordStrength.score >= level + 1
                                ? level === 3
                                  ? 'bg-emerald-500'
                                  : level === 2
                                    ? 'bg-amber-400'
                                    : 'bg-orange-500'
                                : 'bg-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm font-medium">
                      {[
                        ['Mínimo 6 caracteres', passwordChecks.minLength],
                        ['Una mayúscula', passwordChecks.hasUpper],
                        ['Una minúscula', passwordChecks.hasLower],
                        ['Un número', passwordChecks.hasNumber],
                      ].map(([label, isMet]) => (
                        <p
                          key={label as string}
                          className={`flex items-center gap-2 ${passwordRequirementClass(Boolean(isMet))}`}
                        >
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                              isMet
                                ? 'border-emerald-500 bg-emerald-500 text-white'
                                : 'border-slate-300 bg-white text-slate-300'
                            }`}
                          >
                            <Check size={12} strokeWidth={3} />
                          </span>
                          {label as string}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="register-admin-password-confirm" className="block text-sm font-bold text-slate-700 mb-2">
                    Confirmar contraseña
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      id="register-admin-password-confirm"
                      name="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setStepTwoErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                      }}
                      placeholder="Repite la contraseña"
                      autoComplete="new-password"
                      aria-invalid={Boolean(stepTwoErrors.confirmPassword)}
                      aria-describedby={
                        stepTwoErrors.confirmPassword
                          ? 'register-admin-password-confirm-error'
                          : hasStartedConfirming
                            ? 'register-admin-password-confirm-status'
                            : undefined
                      }
                        className={`block min-h-[52px] w-full rounded-xl border py-3 pl-12 pr-11 text-base transition-all placeholder-gray-400 focus:border-[#1e3a8a] focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 ${fieldStateClass(
                        Boolean(stepTwoErrors.confirmPassword),
                        passwordsMatch,
                      )}`}
                      minLength={6}
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                      )}
                    </button>
                  </div>
                  {stepTwoErrors.confirmPassword && (
                    <SimpleFieldError
                      id="register-admin-password-confirm-error"
                      message={stepTwoErrors.confirmPassword}
                    />
                  )}
                  {!stepTwoErrors.confirmPassword && hasStartedConfirming && (
                    <p
                      id="register-admin-password-confirm-status"
                      className={`mt-2 text-xs font-medium ${
                        passwordsMatch ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {passwordsMatch
                        ? 'Las contraseñas coinciden.'
                        : 'Las contraseñas no coinciden.'}
                    </p>
                  )}
                  {hasGoogleFlow && (
                    <p className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-800">
                      Google no comparte tu contraseña con esta aplicación. Escribe aquí
                      la misma que recuerdas de Google o crea una nueva para iniciar
                      sesión en Cafe Smart.
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  <button
                    type="submit"
                    className="flex min-h-[58px] w-full items-center justify-center gap-3 rounded-2xl bg-[#1d4ed8] px-4 py-4 text-[1.05rem] font-extrabold text-white shadow-[0_14px_28px_rgba(29,78,216,0.28)] transition-all hover:bg-[#1e40af] active:scale-[0.99]"
                  >
                    <UserPlus size={22} strokeWidth={2.4} />
                    Crear cuenta
                  </button>
                  {!hasGoogleFlow && isGoogleAuthEnabled && !isAndroidApp && (
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center shadow-[0_8px_18px_rgba(15,23,42,0.05)]">
                      {googleLoading ? (
                        <div className="flex flex-col items-center justify-center py-2">
                          <Loader className="h-8 w-8 animate-spin text-[#1e3a8a]" />
                          <p className="mt-2 text-sm font-medium text-slate-700">
                            Conectando con Google...
                          </p>
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          <GoogleLogin
                            onSuccess={(response) => {
                              setGoogleLoading(true);
                              handleGoogleRegisterSuccess(response);
                            }}
                            onError={handleGoogleRegisterError}
                            text="continue_with"
                            theme="outline"
                            size="large"
                            width={googleButtonWidth}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </form>
            </section>
          )}
        </div>
      </main>

      {step === 1 && supportModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="register-support-modal-title"
            className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.24)]"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.78rem] font-semibold uppercase tracking-[0.08em] text-[#28449b]">
                  Soporte de registro
                </p>
                <h3 id="register-support-modal-title" className="mt-1 text-[1.2rem] font-semibold text-slate-900">
                  {supportModal === 'help' ? 'Ayuda básica' : 'Contacto'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeSupportModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
                aria-label="Cerrar modal"
              >
                <X size={16} />
              </button>
            </div>

            {supportModal === 'help' ? (
              <div className="space-y-3 text-[0.95rem] text-slate-600">
                <p>1. Escribe el nombre del negocio tal como lo usas diariamente.</p>
                <p>2. Selecciona el tipo que mejor describa tu operación cafetera.</p>
                <p>3. Pulsa Siguiente paso para continuar con los datos del administrador.</p>
              </div>
            ) : (
              <div className="space-y-3 text-[0.95rem] text-slate-600">
                <p>Si tienes problemas con el registro, puedes comunicarte por:</p>
                <p>Correo: soporte@cafesmart.com</p>
                <p>Teléfono: +57 300 000 0000</p>
              </div>
            )}

            <button
              type="button"
              onClick={closeSupportModal}
              className="mt-5 w-full rounded-xl bg-[#28449b] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#233b86]"
            >
              Entendido
            </button>
          </div>
        </div>
      ) : null}

    </div>
  );
}






