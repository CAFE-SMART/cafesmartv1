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
import { useRegisterForm } from '../hooks/useRegisterForm';
import {
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
  const passwordStrength = getPasswordStrength(password);
  const hasStartedConfirming = confirmPassword.length > 0;
  const passwordsMatch = password.length > 0 && confirmPassword === password;

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
            <section aria-labelledby="register-business-title" className="min-h-screen bg-[#f3f4f6]">
              <div className="border-b border-slate-200 px-4 py-4">
                <div className="relative flex min-h-[34px] items-center justify-center">
                <button
                  type="button"
                  onClick={handleHeaderBack}
                    className="absolute left-0 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
                  aria-label="Volver al ingreso"
                >
                  <ArrowLeft size={18} />
                </button>
                  <h1 id="register-business-title" className="text-center text-[1.92rem] font-semibold text-[#111827]">
                  Crear cuenta
                </h1>
                </div>
              </div>

              <div className="px-4 pt-5">
                <RegisterProgress step={step} totalSteps={2} progressPercent={progressPercent} />

                <h2 className="mb-7 mt-2 text-[2.15rem] font-semibold leading-[1.15] tracking-[-0.02em] text-[#111827]">
                  Comencemos configurando tu negocio
                </h2>

                {error ? (
                  <InlineGuidedError
                    message={getRegisterGlobalGuidance(error)}
                    className="mb-6"
                  />
                ) : null}

                <div className="mb-7">
                  <label htmlFor="register-business-name" className="mb-2.5 block text-[0.9rem] font-black uppercase tracking-[0.08em] text-[#1f2937]">
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
                    className={`block w-full rounded-2xl border px-4 py-3.5 text-[1.08rem] text-[#111827] placeholder:text-[#9ca3af] focus:border-[#274397] focus:outline-none focus:ring-2 focus:ring-[#274397]/15 ${
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

                <div className="mb-8">
                  <label className="mb-3 block text-[0.9rem] font-black uppercase tracking-[0.08em] text-[#1f2937]" id="register-business-type-label">
                    Tipo de negocio
                  </label>
                <div
                  role="radiogroup"
                  aria-labelledby="register-business-type-label"
                  aria-describedby={
                    stepOneErrors.tipoOrganizacion ? 'register-business-type-error' : undefined
                  }
                    className="grid grid-cols-1 gap-3.5"
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
                          className={`w-full rounded-[16px] border px-4 py-4 text-left transition-all ${
                          selected
                              ? 'border-[#2f4da2] bg-[#f5f8ff] shadow-[0_0_0_1px_rgba(47,77,162,0.08)]'
                              : 'border-[#d6dbe3] bg-white hover:border-[#c7cfdb]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0">
                            <div
                                className={`flex h-12 w-12 items-center justify-center rounded-xl ${colorByType[t.value]}`}
                            >
                              {t.icon}
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                              <p className="text-[1.18rem] font-medium tracking-normal text-[#111827]">
                              {t.label}
                            </p>
                              <p className="mt-1 text-[1.02rem] leading-6 text-slate-500">
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

              <div className="mt-8 border-t border-slate-200 bg-[#f3f4f6] px-4 py-4">
                <button
                  type="button"
                  onClick={goToStep2}
                  className="w-full rounded-full bg-[#28449b] px-4 py-4 text-[1.18rem] font-semibold text-white transition-colors hover:bg-[#243d8b]"
                >
                  <span className="inline-flex items-center gap-2">
                    Siguiente paso
                    <ArrowRight size={18} />
                  </span>
                </button>

                <div className="pb-3 pt-5 text-center">
                  <p className="text-[0.95rem] font-medium text-slate-500">¿Necesitas ayuda con el registro?</p>
                  <div className="mt-2 flex items-center justify-center gap-6">
                    <button
                      type="button"
                      onClick={() => setSupportModal('help')}
                      className="inline-flex items-center gap-1.5 text-[1rem] font-medium text-slate-600 transition-colors hover:text-[#28449b]"
                    >
                      <CircleHelp size={15} />
                      Ayuda
                    </button>
                    <button
                      type="button"
                      onClick={() => setSupportModal('contact')}
                      className="inline-flex items-center gap-1.5 text-[1rem] font-medium text-slate-600 transition-colors hover:text-[#28449b]"
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
            <section aria-labelledby="register-admin-title">
              <div className="relative mb-6 flex min-h-[40px] items-center justify-center">
                <button
                  type="button"
                  onClick={handleHeaderBack}
                  className="absolute left-0 inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
                  aria-label="Volver al negocio"
                >
                  <ArrowLeft size={18} />
                </button>
                <h2 id="register-admin-title" className="text-2xl font-bold text-[#0f172a] text-center">
                  Crear cuenta
                </h2>
              </div>

              <RegisterProgress step={step} totalSteps={2} progressPercent={progressPercent} />
                 <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center gap-3 mb-6">
                <div className="bg-[#1e3a8a] text-white p-1.5 rounded-lg flex-shrink-0">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
                    <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
                  </svg>
                </div>
                <p className="text-sm text-blue-900 font-medium">
                  Este usuario sera el administrador del sistema
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {hasGoogleFlow && (
                  <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    Google completo nombre, apellidos y correo. Solo revisalos y termina el registro.
                  </p>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="register-admin-name" className="mb-2 block text-sm font-bold text-slate-700">
                      Nombre
                    </label>
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
                      className={`block w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] focus:outline-none transition-all placeholder-gray-400 ${
                        stepTwoErrors.nombre
                          ? 'border-red-300 bg-red-50/40 text-gray-700'
                          : 'text-gray-700 border-gray-200'
                      }`}
                      required
                    />
                    {stepTwoErrors.nombre && (
                      <InlineGuidedError
                        id="register-admin-name-error"
                        message={getRegisterFieldGuidance('nombre', stepTwoErrors.nombre)}
                        className="mt-2"
                      />
                    )}
                  </div>

                  <div>
                    <label htmlFor="register-admin-lastname" className="mb-2 block text-sm font-bold text-slate-700">
                      Apellidos
                    </label>
                    <input
                      id="register-admin-lastname"
                      name="lastName"
                      type="text"
                      value={apellidos}
                      onChange={(e) => {
                        setApellidos(e.target.value);
                        setStepTwoErrors((prev) => ({ ...prev, apellidos: undefined }));
                      }}
                      placeholder="Ej. Perez Gomez"
                      autoComplete="family-name"
                      aria-invalid={Boolean(stepTwoErrors.apellidos)}
                      aria-describedby={
                        stepTwoErrors.apellidos ? 'register-admin-lastname-error' : undefined
                      }
                      className={`block w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] focus:outline-none transition-all placeholder-gray-400 ${
                        stepTwoErrors.apellidos
                          ? 'border-red-300 bg-red-50/40 text-gray-700'
                          : 'text-gray-700 border-gray-200'
                      }`}
                      required
                    />
                    {stepTwoErrors.apellidos && (
                      <InlineGuidedError
                        id="register-admin-lastname-error"
                        message={getRegisterFieldGuidance('apellidos', stepTwoErrors.apellidos)}
                        className="mt-2"
                      />
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="register-admin-phone" className="block text-sm font-bold text-slate-700 mb-2">
                    Telefono
                  </label>
                  <input
                    id="register-admin-phone"
                    name="phone"
                    type="tel"
                    value={telefono}
                    onChange={(e) => {
                      setTelefono(e.target.value);
                      setStepTwoErrors((prev) => ({ ...prev, telefono: undefined }));
                    }}
                    placeholder="+57 300 123 4567"
                    autoComplete="tel"
                    aria-invalid={Boolean(stepTwoErrors.telefono)}
                    aria-describedby={stepTwoErrors.telefono ? 'register-admin-phone-error' : undefined}
                    className={`block w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] focus:outline-none transition-all text-gray-700 placeholder-gray-400 ${
                      stepTwoErrors.telefono ? 'border-red-300 bg-red-50/40' : 'border-gray-200'
                    }`}
                    required
                  />
                  {stepTwoErrors.telefono && (
                    <InlineGuidedError
                      id="register-admin-phone-error"
                      message={getRegisterFieldGuidance('telefono', stepTwoErrors.telefono)}
                      className="mt-2"
                    />
                  )}
                </div>

                <div>
                  <label htmlFor="register-admin-email" className="mb-2 block text-sm font-bold text-slate-700">
                    Correo electronico
                  </label>
                  <input
                    id="register-admin-email"
                    name="email"
                    type="email"
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
                    className={`block w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] focus:outline-none transition-all placeholder-gray-400 ${
                      stepTwoErrors.correo
                        ? 'border-red-300 bg-red-50/40 text-gray-700'
                        : 'text-gray-700 border-gray-200'
                    }`}
                    required
                  />
                  {isCheckingEmail && !stepTwoErrors.correo && (
                    <p id="register-admin-email-status" className="mt-2 text-xs font-medium text-slate-500">
                      Validando correo...
                    </p>
                  )}
                  {stepTwoErrors.correo && (
                    <InlineGuidedError
                      id="register-admin-email-error"
                      message={getRegisterFieldGuidance('correo', stepTwoErrors.correo)}
                      className="mt-2"
                    />
                  )}
                </div>

                <div>
                  <label htmlFor="register-admin-password" className="block text-sm font-bold text-slate-700 mb-2">
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="register-admin-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setStepTwoErrors((prev) => ({ ...prev, password: undefined }));
                      }}
                      placeholder="************"
                      autoComplete={hasGoogleFlow ? 'new-password' : 'new-password'}
                      aria-invalid={Boolean(stepTwoErrors.password)}
                      aria-describedby={stepTwoErrors.password ? 'register-admin-password-error' : undefined}
                      className={`block w-full px-4 pr-10 py-3 border rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] focus:outline-none transition-all text-gray-700 placeholder-gray-400 text-lg tracking-wider ${
                        stepTwoErrors.password ? 'border-red-300 bg-red-50/40' : 'border-gray-200'
                      }`}
                      required
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
                    <InlineGuidedError
                      id="register-admin-password-error"
                      message={getRegisterFieldGuidance('password', stepTwoErrors.password)}
                      className="mt-2"
                    />
                  )}
                  <div className="mt-3 space-y-2">
                    <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          passwordStrength.score <= 1
                            ? 'bg-red-500'
                            : passwordStrength.score === 2
                              ? 'bg-orange-500'
                              : passwordStrength.score === 3
                                ? 'bg-yellow-500'
                                : 'bg-emerald-500'
                        }`}
                        style={{ width: `${(passwordStrength.score / 4) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-600">
                      Seguridad: <strong>{passwordStrength.label}</strong>
                    </p>
                    <p className="text-xs text-slate-500">
                      Requisitos: mínimo 6 caracteres, una minúscula, una mayúscula y un
                      número recomendado.
                    </p>
                  </div>
                </div>

                <div>
                  <label htmlFor="register-admin-password-confirm" className="block text-sm font-bold text-slate-700 mb-2">
                    Confirma tu contraseña
                  </label>
                  <input
                    id="register-admin-password-confirm"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setStepTwoErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                    }}
                    placeholder="Vuelve a escribir tu contraseña"
                    autoComplete="new-password"
                    aria-invalid={Boolean(stepTwoErrors.confirmPassword)}
                    aria-describedby={
                      stepTwoErrors.confirmPassword
                        ? 'register-admin-password-confirm-error'
                        : hasStartedConfirming
                          ? 'register-admin-password-confirm-status'
                          : undefined
                    }
                    className={`block w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] focus:outline-none transition-all text-gray-700 placeholder-gray-400 ${
                      stepTwoErrors.confirmPassword
                        ? 'border-red-300 bg-red-50/40'
                        : 'border-gray-200'
                    }`}
                    required
                    minLength={6}
                  />
                  {stepTwoErrors.confirmPassword && (
                    <InlineGuidedError
                      id="register-admin-password-confirm-error"
                      message={getRegisterFieldGuidance(
                        'confirmPassword',
                        stepTwoErrors.confirmPassword,
                      )}
                      className="mt-2"
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
                    className="w-full py-3.5 px-4 rounded-xl text-white font-semibold transition-all flex items-center justify-center gap-2 bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 shadow-md hover:shadow-lg"
                  >
                    Crear cuenta
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <line x1="19" y1="8" x2="19" y2="14" />
                      <line x1="22" y1="11" x2="16" y2="11" />
                    </svg>
                  </button>

                  {!hasGoogleFlow && isGoogleAuthEnabled && !isAndroidApp && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-center">
                      <p className="mb-3 text-xs font-medium text-slate-600">
                        Si prefieres, tambien puedes continuar con Google desde aqui.
                      </p>

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






