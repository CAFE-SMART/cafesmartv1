import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Eye,
  EyeOff,
  Loader,
  Users,
  Store,
  Settings,
  HelpCircle,
  MessageCircle,
  X,
} from 'lucide-react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { FormattedPhoneInput } from '../components/FormattedPhoneInput';
import { RegisterProgress } from '../components/register/RegisterProgress';
import { useRegisterForm } from '../hooks/useRegisterForm';
import {
  getPasswordStrength,
  type RegisterLocationState,
  type TipoOrg,
} from '../utils/registerValidators';
import { getGooglePrefillFromIdToken } from '../utils/googleProfile';

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const isGoogleAuthEnabled = Boolean(
    (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim(),
  );
  const [googleLoading, setGoogleLoading] = useState(false);
  const [supportPanel, setSupportPanel] = useState<'help' | 'contact' | null>(null);
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

  useEffect(() => {
    setSupportPanel(null);
  }, [step]);

  const tiposOrg: { value: TipoOrg; label: string; desc: string; icon: React.ReactNode }[] = [
    {
      value: 'COOPERATIVA',
      label: 'Cooperativa',
      desc: 'Gestion de multiples productores.',
      icon: <Users size={22} />,
    },
    {
      value: 'COMPRAVENTA',
      label: 'Compraventa',
      desc: 'Punto de acopio y comercio.',
      icon: <Store size={22} />,
    },
    {
      value: 'OTRO',
      label: 'Personalizado',
      desc: 'Configurable segun sus necesidades.',
      icon: <Settings size={22} />,
    },
  ];

  const colorByType: Record<TipoOrg, string> = {
    COOPERATIVA: 'bg-blue-100 text-blue-700',
    COMPRAVENTA: 'bg-amber-100 text-amber-700',
    OTRO: 'bg-rose-100 text-rose-700',
  };

  const supportContent = useMemo(() => {
    if (step === 1) {
      return {
        badge: 'Ayuda del registro',
        title: 'Configuración inicial',
        description:
          'En este paso solo defines el negocio. Luego completas los datos del administrador.',
        quickTip: 'Escribe el nombre del negocio y elige el tipo correspondiente.',
        secondTip:
          'Si no aplica cooperativa o compraventa, usa la opción personalizada.',
        contactTitle: '¿Se trabó el inicio?',
        contactDescription:
          'Si tienes dudas con esta pantalla, contacta soporte y sigue con tu registro.',
      };
    }

    return {
      badge: 'Ayuda del registro',
      title: 'Datos de acceso',
      description:
        'Este paso corresponde al administrador y no cambia la configuración del negocio.',
      quickTip:
        'Completa nombre, apellidos, teléfono, correo y contraseña para terminar el registro.',
      secondTip:
        hasGoogleFlow
          ? 'Si llegaste con Google, revisa los datos autocompletados y solo corrige lo necesario.'
          : 'Revisa que el correo esté bien escrito y que las contraseñas coincidan antes de guardar.',
      contactTitle: '¿Algo falla con tu cuenta?',
      contactDescription:
        'Si hay problema con correo, contraseña o validación, soporte puede ayudarte sin salir de esta pantalla.',
    };
  }, [hasGoogleFlow, step]);

  const progressPercent = step === 1 ? 50 : 100;
  const passwordStrength = getPasswordStrength(password);
  const hasStartedConfirming = confirmPassword.length > 0;
  const passwordsMatch = password.length > 0 && confirmPassword === password;

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

  const handleHelpClick = () => {
    setSupportPanel((currentPanel) => (currentPanel === 'help' ? null : 'help'));
  };

  const handleContactClick = () => {
    setSupportPanel((currentPanel) => (currentPanel === 'contact' ? null : 'contact'));
  };

  const supportPanelId = supportPanel === 'help' ? 'register-support-help' : 'register-support-contact';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-800">
      <header className="flex flex-col gap-3 bg-gray-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <button
          type="button"
          onClick={handleHeaderBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
        >
          <ArrowLeft size={18} /> {step === 1 ? 'Volver al ingreso' : 'Volver al negocio'}
        </button>

        <button
          type="button"
          onClick={goToLogin}
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:text-slate-900"
        >
          Cancelar registro
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 pb-36 sm:pb-28">
        <div className="w-full max-w-[520px]">
          <RegisterProgress step={step} totalSteps={2} progressPercent={progressPercent} />

          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="bg-red-50 text-red-600 border border-red-200 p-3 rounded-xl mb-6 text-sm flex items-start gap-2"
            >
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {step === 1 && (
            <section aria-labelledby="register-business-title">
              <h2 id="register-business-title" className="text-2xl font-bold text-[#0f172a] mb-1">
                Informacion del Negocio
              </h2>
              <p className="text-gray-500 mb-6 text-sm">
                Comencemos configurando la identidad de su establecimiento cafetero.
              </p>

              <div className="mb-6">
                <label htmlFor="register-business-name" className="block text-sm font-bold text-slate-700 mb-2">
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
                  placeholder="Ej: Cooperativa El Cafetal"
                  autoComplete="organization"
                  aria-invalid={Boolean(stepOneErrors.nombreOrganizacion)}
                  aria-describedby={
                    stepOneErrors.nombreOrganizacion ? 'register-business-name-error' : undefined
                  }
                  className={`block w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] focus:outline-none transition-all text-gray-700 placeholder-gray-400 ${
                    stepOneErrors.nombreOrganizacion
                      ? 'border-red-300 bg-red-50/40'
                      : 'border-gray-200'
                  }`}
                />
                {stepOneErrors.nombreOrganizacion && (
                  <p id="register-business-name-error" className="mt-2 text-xs font-medium text-red-600">
                    {stepOneErrors.nombreOrganizacion}
                  </p>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-bold text-slate-700 mb-3" id="register-business-type-label">
                  Tipo de negocio
                </label>
                <div
                  role="radiogroup"
                  aria-labelledby="register-business-type-label"
                  aria-describedby={
                    stepOneErrors.tipoOrganizacion ? 'register-business-type-error' : undefined
                  }
                  className="grid grid-cols-3 gap-3"
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
                        className={`w-full min-h-[122px] rounded-xl border px-2 py-3 text-center transition-all ${
                          selected
                            ? 'border-[#1e3a8a] bg-blue-50/60 shadow-sm'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="mx-auto flex justify-center">
                          <div
                            className={`h-10 w-10 rounded-xl flex items-center justify-center ${colorByType[t.value]}`}
                          >
                            {t.icon}
                          </div>
                        </div>
                        <p className="mt-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#0f172a]">
                          {t.label}
                        </p>
                        <p className="mt-1 hidden text-[10px] leading-4 text-slate-500 sm:block">
                          {t.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
                {stepOneErrors.tipoOrganizacion && (
                  <p id="register-business-type-error" className="mt-2 text-xs font-medium text-red-600">
                    {stepOneErrors.tipoOrganizacion}
                  </p>
                )}
              </div>

              {tipoOrganizacion === 'OTRO' && (
                <div className="mb-6">
                  <label htmlFor="register-business-type-other" className="block text-sm font-bold text-slate-700 mb-2">
                    Especifica el tipo
                  </label>
                  <input
                    id="register-business-type-other"
                    name="businessTypeOther"
                    type="text"
                    value={otroTipoDetalle}
                    onChange={(e) => {
                      setOtroTipoDetalle(e.target.value);
                      setStepOneErrors((prev) => ({ ...prev, otroTipoDetalle: undefined }));
                    }}
                    placeholder="Ej: Exportadora, Trilladora"
                    aria-invalid={Boolean(stepOneErrors.otroTipoDetalle)}
                    aria-describedby={
                      stepOneErrors.otroTipoDetalle ? 'register-business-type-other-error' : undefined
                    }
                    className={`block w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] focus:outline-none transition-all text-gray-700 placeholder-gray-400 ${
                      stepOneErrors.otroTipoDetalle ? 'border-red-300 bg-red-50/40' : 'border-gray-200'
                    }`}
                  />
                  {stepOneErrors.otroTipoDetalle && (
                    <p id="register-business-type-other-error" className="mt-2 text-xs font-medium text-red-600">
                      {stepOneErrors.otroTipoDetalle}
                    </p>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={goToStep2}
                className="w-full py-3.5 px-4 rounded-xl text-white font-semibold bg-[#1e3a8a] hover:bg-[#1e3a8a]/90 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
              >
                Siguiente paso <ArrowRight size={18} />
              </button>
            </section>
          )}

          {step === 2 && (
            <section aria-labelledby="register-admin-title">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <h2 id="register-admin-title" className="text-2xl font-bold text-[#0f172a]">
                  Datos del Administrador
                </h2>
                <span className="text-xs font-bold px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg whitespace-nowrap mt-1">
                  PASO 2 DE 2
                </span>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center gap-3 mb-6 mt-4">
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
                      <p id="register-admin-name-error" className="mt-2 text-xs font-medium text-red-600">
                        {stepTwoErrors.nombre}
                      </p>
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
                      <p id="register-admin-lastname-error" className="mt-2 text-xs font-medium text-red-600">
                        {stepTwoErrors.apellidos}
                      </p>
                    )}
                  </div>
                </div>

                <FormattedPhoneInput
                    id="register-admin-phone"
                    label="Telefono"
                    value={telefono}
                    onChange={(value) => {
                      setTelefono(value);
                      setStepTwoErrors((prev) => ({ ...prev, telefono: undefined }));
                    }}
                    error={stepTwoErrors.telefono}
                    hint="Escribe solo los 10 digitos del celular. Nosotros agregamos +57 y los espacios."
                    className="text-slate-700"
                  />

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
                    <p id="register-admin-email-error" className="mt-2 text-xs font-medium text-red-600">
                      {stepTwoErrors.correo}
                    </p>
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
                    <p id="register-admin-password-error" className="mt-2 text-xs font-medium text-red-600">
                      {stepTwoErrors.password}
                    </p>
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
                    <p id="register-admin-password-confirm-error" className="mt-2 text-xs font-medium text-red-600">
                      {stepTwoErrors.confirmPassword}
                    </p>
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

                  {!hasGoogleFlow && isGoogleAuthEnabled && (
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
                            width={320}
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

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 sm:bottom-6 sm:justify-end sm:px-6">
        <div className="pointer-events-auto relative flex items-end gap-3">
          {supportPanel && (
            <div
              id={supportPanelId}
              role="dialog"
              aria-modal="false"
              aria-labelledby="register-support-title"
              className="fixed left-4 right-4 bottom-20 z-50 max-h-[62vh] overflow-hidden rounded-[24px] border border-white/80 bg-white/95 shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:absolute sm:bottom-full sm:left-auto sm:right-0 sm:mb-3 sm:w-[min(92vw,23rem)] sm:max-h-none"
            >
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.18em] text-[#102d92]">
                    {supportContent.badge}
                  </p>
                  <h3 id="register-support-title" className="mt-1 text-lg font-black text-slate-900">
                    {supportPanel === 'help' ? supportContent.title : supportContent.contactTitle}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSupportPanel(null)}
                  className="rounded-full bg-slate-100 p-2 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-900"
                  aria-label="Cerrar ayuda"
                >
                  <X size={16} />
                </button>
              </div>

              {supportPanel === 'help' ? (
                <div className="space-y-3 overflow-y-auto px-5 py-4 text-sm text-slate-600">
                  <p className="leading-6">{supportContent.description}</p>
                  <p className="rounded-2xl bg-slate-50 px-4 py-3 leading-6">{supportContent.quickTip}</p>
                  <p className="rounded-2xl border border-slate-100 bg-white px-4 py-3 leading-6 shadow-sm">{supportContent.secondTip}</p>
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto px-5 py-4 text-sm text-slate-600">
                  <p className="leading-6">{supportContent.contactDescription}</p>
                  <div className="grid gap-3">
                    <a
                      href="mailto:soporte@cafesmart.com"
                      className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-center font-bold text-[#102d92] shadow-sm"
                    >
                      Enviar correo
                    </a>
                    <a
                      href="tel:+573000000000"
                      className="rounded-2xl border border-slate-100 bg-white px-4 py-3 text-center font-bold text-[#102d92] shadow-sm"
                    >
                      Llamar soporte
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col items-end gap-2">
            <p className="px-1 text-xs font-medium text-slate-500">
              Ayuda rápida del registro
            </p>
            <div className="flex items-center gap-2 rounded-full border border-white/70 bg-white/90 px-2 py-2 shadow-[0_18px_40px_rgba(15,23,42,0.14)] backdrop-blur-xl">
            <button
              type="button"
              onClick={handleHelpClick}
              aria-expanded={supportPanel === 'help'}
              aria-controls="register-support-help"
              className={`flex h-11 w-11 items-center justify-center rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9cb8ff] focus-visible:ring-offset-2 sm:h-12 sm:w-12 ${
                supportPanel === 'help'
                  ? 'bg-[#dbe7ff] text-[#102d92] shadow-[0_10px_20px_rgba(16,45,146,0.18)]'
                  : 'bg-[#eef1ff] text-[#102d92] hover:bg-[#dde1ff]'
              }`}
              aria-label="Abrir ayuda"
            >
              <HelpCircle size={20} />
            </button>
            <button
              type="button"
              onClick={handleContactClick}
              aria-expanded={supportPanel === 'contact'}
              aria-controls="register-support-contact"
              className={`flex h-11 w-11 items-center justify-center rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9cb8ff] focus-visible:ring-offset-2 sm:h-12 sm:w-12 ${
                supportPanel === 'contact'
                  ? 'bg-[#dbe7ff] text-[#102d92] shadow-[0_10px_20px_rgba(16,45,146,0.18)]'
                  : 'bg-[#eef1ff] text-[#102d92] hover:bg-[#dde1ff]'
              }`}
              aria-label="Abrir contacto"
            >
              <MessageCircle size={20} />
            </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}






