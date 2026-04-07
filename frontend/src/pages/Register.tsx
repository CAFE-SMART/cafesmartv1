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
} from 'lucide-react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
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
  const isGoogleAuthEnabled = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);
  const [googleLoading, setGoogleLoading] = useState(false);
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
    window.alert('Si necesitas ayuda con el registro, comunicate con la persona encargada del sistema.');
  };

  const handleContactClick = () => {
    window.alert('Si el problema continua, comunicate con la persona encargada o con soporte interno.');
  };

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

      <main className="flex-1 flex flex-col items-center px-4 pb-8">
        <div className="w-full max-w-[520px]">
          <RegisterProgress step={step} totalSteps={2} progressPercent={progressPercent} />

          {error && (
            <div className="bg-red-50 text-red-600 border border-red-200 p-3 rounded-xl mb-6 text-sm flex items-start gap-2">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {step === 1 && (
            <section>
              <h2 className="text-2xl font-bold text-[#0f172a] mb-1">
                Informacion del Negocio
              </h2>
              <p className="text-gray-500 mb-8 text-sm">
                Comencemos configurando la identidad de su establecimiento cafetero.
              </p>

              <div className="mb-6">
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  Nombre del negocio
                </label>
                <input
                  type="text"
                  value={nombreOrganizacion}
                  onChange={(e) => {
                    setNombreOrganizacion(e.target.value);
                    setStepOneErrors((prev) => ({ ...prev, nombreOrganizacion: undefined }));
                  }}
                  placeholder="Ej: Cooperativa El Cafetal"
                  className={`block w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] focus:outline-none transition-all text-gray-700 placeholder-gray-400 ${
                    stepOneErrors.nombreOrganizacion
                      ? 'border-red-300 bg-red-50/40'
                      : 'border-gray-200'
                  }`}
                />
                {stepOneErrors.nombreOrganizacion && (
                  <p className="mt-2 text-xs font-medium text-red-600">
                    {stepOneErrors.nombreOrganizacion}
                  </p>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-bold text-slate-700 mb-3">
                  Tipo de negocio
                </label>
                <div className="space-y-3">
                  {tiposOrg.map((t) => {
                    const selected = tipoOrganizacion === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => {
                          setTipoOrganizacion(t.value);
                          setStepOneErrors((prev) => ({ ...prev, tipoOrganizacion: undefined }));
                        }}
                        className={`
                          w-full flex items-center gap-4 px-4 py-4 rounded-xl border-2 text-left transition-all
                          ${
                            selected
                              ? 'border-[#1e3a8a] bg-blue-50/60 shadow-sm'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }
                        `}
                      >
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colorByType[t.value]}`}
                        >
                          {t.icon}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[#0f172a] text-sm">{t.label}</p>
                          <p className="text-xs text-gray-500">{t.desc}</p>
                        </div>

                        <div
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            selected ? 'border-[#1e3a8a] bg-[#0f172a]' : 'border-gray-300'
                          }`}
                        >
                          {selected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {stepOneErrors.tipoOrganizacion && (
                  <p className="mt-2 text-xs font-medium text-red-600">
                    {stepOneErrors.tipoOrganizacion}
                  </p>
                )}
              </div>

              {tipoOrganizacion === 'OTRO' && (
                <div className="mb-6">
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Especifica el tipo
                  </label>
                  <input
                    type="text"
                    value={otroTipoDetalle}
                    onChange={(e) => {
                      setOtroTipoDetalle(e.target.value);
                      setStepOneErrors((prev) => ({ ...prev, otroTipoDetalle: undefined }));
                    }}
                    placeholder="Ej: Exportadora, Trilladora"
                    className={`block w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] focus:outline-none transition-all text-gray-700 placeholder-gray-400 ${
                      stepOneErrors.otroTipoDetalle ? 'border-red-300 bg-red-50/40' : 'border-gray-200'
                    }`}
                  />
                  {stepOneErrors.otroTipoDetalle && (
                    <p className="mt-2 text-xs font-medium text-red-600">
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
                Siguiente Paso <ArrowRight size={18} />
              </button>
            </section>
          )}

          {step === 2 && (
            <section>
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <h2 className="text-2xl font-bold text-[#0f172a]">
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
                    <label className="mb-2 block text-sm font-bold text-slate-700">Nombre</label>
                    <input
                      type="text"
                      value={nombre}
                      onChange={(e) => {
                        setNombre(e.target.value);
                        setStepTwoErrors((prev) => ({ ...prev, nombre: undefined }));
                      }}
                      placeholder="Ej. Juan"
                      className={`block w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] focus:outline-none transition-all placeholder-gray-400 ${
                        stepTwoErrors.nombre
                          ? 'border-red-300 bg-red-50/40 text-gray-700'
                          : 'text-gray-700 border-gray-200'
                      }`}
                      required
                    />
                    {stepTwoErrors.nombre && (
                      <p className="mt-2 text-xs font-medium text-red-600">
                        {stepTwoErrors.nombre}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-bold text-slate-700">Apellidos</label>
                    <input
                      type="text"
                      value={apellidos}
                      onChange={(e) => {
                        setApellidos(e.target.value);
                        setStepTwoErrors((prev) => ({ ...prev, apellidos: undefined }));
                      }}
                      placeholder="Ej. Perez Gomez"
                      className={`block w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] focus:outline-none transition-all placeholder-gray-400 ${
                        stepTwoErrors.apellidos
                          ? 'border-red-300 bg-red-50/40 text-gray-700'
                          : 'text-gray-700 border-gray-200'
                      }`}
                      required
                    />
                    {stepTwoErrors.apellidos && (
                      <p className="mt-2 text-xs font-medium text-red-600">
                        {stepTwoErrors.apellidos}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Telefono
                  </label>
                  <input
                    type="tel"
                    value={telefono}
                    onChange={(e) => {
                      setTelefono(e.target.value);
                      setStepTwoErrors((prev) => ({ ...prev, telefono: undefined }));
                    }}
                    placeholder="+57 300 123 4567"
                    className={`block w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] focus:outline-none transition-all text-gray-700 placeholder-gray-400 ${
                      stepTwoErrors.telefono ? 'border-red-300 bg-red-50/40' : 'border-gray-200'
                    }`}
                    required
                  />
                  {stepTwoErrors.telefono && (
                    <p className="mt-2 text-xs font-medium text-red-600">
                      {stepTwoErrors.telefono}
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-bold text-slate-700">Correo electronico</label>
                  <input
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
                    className={`block w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] focus:outline-none transition-all placeholder-gray-400 ${
                      stepTwoErrors.correo
                        ? 'border-red-300 bg-red-50/40 text-gray-700'
                        : 'text-gray-700 border-gray-200'
                    }`}
                    required
                  />
                  {isCheckingEmail && !stepTwoErrors.correo && (
                    <p className="mt-2 text-xs font-medium text-slate-500">
                      Validando correo...
                    </p>
                  )}
                  {stepTwoErrors.correo && (
                    <p className="mt-2 text-xs font-medium text-red-600">
                      {stepTwoErrors.correo}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setStepTwoErrors((prev) => ({ ...prev, password: undefined }));
                      }}
                      placeholder="************"
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
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                      ) : (
                        <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600 transition-colors" />
                      )}
                    </button>
                  </div>
                  {stepTwoErrors.password && (
                    <p className="mt-2 text-xs font-medium text-red-600">
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
                  <label className="block text-sm font-bold text-slate-700 mb-2">
                    Confirma tu contraseña
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setStepTwoErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                    }}
                    placeholder="Vuelve a escribir tu contraseña"
                    className={`block w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] focus:outline-none transition-all text-gray-700 placeholder-gray-400 ${
                      stepTwoErrors.confirmPassword
                        ? 'border-red-300 bg-red-50/40'
                        : 'border-gray-200'
                    }`}
                    required
                    minLength={6}
                  />
                  {stepTwoErrors.confirmPassword && (
                    <p className="mt-2 text-xs font-medium text-red-600">
                      {stepTwoErrors.confirmPassword}
                    </p>
                  )}
                  {!stepTwoErrors.confirmPassword && hasStartedConfirming && (
                    <p
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
                            width="100%"
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

      <footer className="p-4 flex items-center justify-center gap-4 text-sm text-gray-500 sm:gap-6">
        <p className="text-xs text-slate-400 font-medium">
          Necesitas ayuda con el registro?
        </p>
      </footer>
      <div className="flex items-center justify-center gap-8 pb-8">
        <button
          type="button"
          onClick={handleHelpClick}
          className="flex flex-col items-center gap-1 text-gray-500 transition-colors hover:text-[#1e3a8a]"
        >
          <HelpCircle size={20} />
          <span className="text-xs font-medium">Ayuda</span>
        </button>
        <button
          type="button"
          onClick={handleContactClick}
          className="flex flex-col items-center gap-1 text-gray-500 transition-colors hover:text-[#1e3a8a]"
        >
          <MessageCircle size={20} />
          <span className="text-xs font-medium">Contacto</span>
        </button>
      </div>
    </div>
  );
}






