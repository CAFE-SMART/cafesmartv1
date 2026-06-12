import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  Check,
  CircleHelp,
  Clock,
  Eye,
  EyeOff,
  Headset,
  Info,
  Loader,
  Mail,
  Menu,
  Phone,
  Settings,
  ShieldCheck,
  Store,
  Users,
  X,
} from 'lucide-react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { AppFeedbackMessage } from '../components/AppFeedbackMessage';
import { RegisterProgress } from '../components/register/RegisterProgress';
import { useRegisterForm } from '../hooks/useRegisterForm';
import {
  getPasswordChecks,
  getPasswordStrength,
  BUSINESS_DESCRIPTION_MAX_LENGTH,
  BUSINESS_NAME_MAX_LENGTH,
  normalizeBusinessDescriptionInput,
  normalizeBusinessNameInput,
  normalizeHumanNameInput,
  PERSON_LASTNAME_MAX_LENGTH,
  PERSON_NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  type RegisterLocationState,
  type TipoOrg,
} from '../utils/registerValidators';
import { getGooglePrefillFromIdToken } from '../utils/googleProfile';
import { formatNationalPhone, getPhoneDigits } from '../utils/formatPhone';
import {
  fieldHelpTextClass,
  fieldInputClass,
  fieldLabelClass,
  fieldTextareaClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../styles/uiClasses';

type BusinessType = {
  value: TipoOrg;
  label: string;
  desc: string;
  icon: React.ReactNode;
};

const businessTypes: BusinessType[] = [
  {
    value: 'COMPRAVENTA',
    label: 'Compraventa',
    desc: 'Compras cafe para revenderlo y obtener ganancias.',
    icon: <Store size={19} />,
  },
  {
    value: 'COOPERATIVA',
    label: 'Cooperativa',
    desc: 'Recibes cafe de productores y lo vendes por ellos.',
    icon: <Users size={19} />,
  },
  {
    value: 'PERSONALIZADO',
    label: 'Personalizado',
    desc: 'Otro tipo de negocio cafetero.',
    icon: <Settings size={19} />,
  },
];

const colorByType: Record<TipoOrg, string> = {
  COOPERATIVA: 'bg-[#eef4ff] text-[#2f5ec4] dark:bg-blue-500/20 dark:text-blue-100',
  COMPRAVENTA: 'bg-[#fff5d8] text-[#b58214] dark:bg-amber-500/20 dark:text-amber-100',
  PERSONALIZADO: 'bg-[#fff0f2] text-[#d24861] dark:bg-rose-500/20 dark:text-rose-100',
};

const LOGIN_DRAFT_STORAGE_KEY = 'cafesmart:login-draft:v1';
const REGISTER_DRAFT_STORAGE_KEY = 'cafesmart:register-draft:v1';
const REGISTER_DRAFT_TTL_MS = 1000 * 60 * 60 * 24;

type RegisterDraft = NonNullable<RegisterLocationState['registerDraft']>;

function readRegisterDraft(): RegisterDraft | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(REGISTER_DRAFT_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const draft = JSON.parse(raw) as RegisterDraft & { savedAt?: number };
    if (
      draft.authMode !== 'register' ||
      typeof draft.savedAt !== 'number' ||
      Date.now() - draft.savedAt > REGISTER_DRAFT_TTL_MS
    ) {
      window.localStorage.removeItem(REGISTER_DRAFT_STORAGE_KEY);
      return null;
    }

    return draft;
  } catch {
    window.localStorage.removeItem(REGISTER_DRAFT_STORAGE_KEY);
    return null;
  }
}

function saveRegisterDraft(draft: RegisterDraft) {
  if (typeof window === 'undefined') {
    return;
  }

  const hasProgress = Boolean(
    draft.nombreOrganizacion?.trim() ||
      draft.descripcionOrganizacion?.trim() ||
      draft.tipoOrganizacion ||
      draft.otroTipoDetalle?.trim() ||
      draft.nombre?.trim() ||
      draft.apellidos?.trim() ||
      draft.telefono?.trim() ||
      draft.correo?.trim(),
  );

  if (!hasProgress) {
    window.localStorage.removeItem(REGISTER_DRAFT_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    REGISTER_DRAFT_STORAGE_KEY,
    JSON.stringify({
      ...draft,
      authMode: 'register',
      savedAt: Date.now(),
    }),
  );
}

function clearRegisterDraft() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(REGISTER_DRAFT_STORAGE_KEY);
  }
}

export default function Register() {
  const navigate = useNavigate();
  const location = useLocation();
  const isGoogleAuthEnabled = Boolean(
    (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim(),
  );
  const [googleLoading, setGoogleLoading] = useState(false);
  const [supportModal, setSupportModal] = useState<'help' | 'contact' | null>(
    null,
  );
  const [recoveredDraft] = useState(() => readRegisterDraft());
  const initialRouteState = useMemo(
    () => {
      const routeState = (location.state ?? null) as RegisterLocationState | null;
      if (routeState?.googleToken || routeState?.registerDraft) {
        return routeState;
      }

      return recoveredDraft
        ? ({
            ...routeState,
            registerDraft: recoveredDraft,
          } as RegisterLocationState)
        : routeState;
    },
    [location.state, recoveredDraft],
  );
  const [googleRouteState, setGoogleRouteState] =
    useState<RegisterLocationState>(() => initialRouteState ?? {});

  useEffect(() => {
    if (initialRouteState?.googleToken) {
      setGoogleRouteState(initialRouteState);
    }
  }, [initialRouteState]);

  const hasGoogleFlow = Boolean(googleRouteState.googleToken);
  const {
    step,
    nombreOrganizacion,
    setNombreOrganizacion,
    descripcionOrganizacion,
    setDescripcionOrganizacion,
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
  } = useRegisterForm({
    hasGoogleFlow,
    routeState: googleRouteState,
    navigate,
  });

  useEffect(() => {
    window.localStorage.removeItem(LOGIN_DRAFT_STORAGE_KEY);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      saveRegisterDraft({
        authMode: 'register',
        currentStep: step === 1 ? 1 : 2,
        nombreOrganizacion,
        descripcionOrganizacion,
        tipoOrganizacion: tipoOrganizacion || undefined,
        otroTipoDetalle,
        nombre,
        apellidos,
        telefono,
        correo,
      });
    }, 650);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    apellidos,
    correo,
    descripcionOrganizacion,
    nombre,
    nombreOrganizacion,
    otroTipoDetalle,
    step,
    telefono,
    tipoOrganizacion,
  ]);

  useEffect(() => {
    const saveCurrentDraft = () => {
      saveRegisterDraft({
        authMode: 'register',
        currentStep: step === 1 ? 1 : 2,
        nombreOrganizacion,
        descripcionOrganizacion,
        tipoOrganizacion: tipoOrganizacion || undefined,
        otroTipoDetalle,
        nombre,
        apellidos,
        telefono,
        correo,
      });
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveCurrentDraft();
      }
    };

    window.addEventListener('beforeunload', saveCurrentDraft);
    window.addEventListener('blur', saveCurrentDraft);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      saveCurrentDraft();
      window.removeEventListener('beforeunload', saveCurrentDraft);
      window.removeEventListener('blur', saveCurrentDraft);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    apellidos,
    correo,
    descripcionOrganizacion,
    nombre,
    nombreOrganizacion,
    otroTipoDetalle,
    step,
    telefono,
    tipoOrganizacion,
  ]);

  const progressPercent = step === 1 ? 50 : 100;
  const passwordStrength = getPasswordStrength(password);
  const passwordChecks = useMemo(() => getPasswordChecks(password), [password]);
  const hasStartedConfirming = confirmPassword.length > 0;
  const passwordsMatch = password.length > 0 && confirmPassword === password;
  const passwordStrengthTone =
    passwordStrength.score <= 3
        ? 'text-amber-600'
        : passwordStrength.score === 4
          ? 'text-sky-600'
          : 'text-emerald-600';
  const [passwordLimitWarningVisible, setPasswordLimitWarningVisible] =
    useState(false);
  const [passwordLimitWarningExiting, setPasswordLimitWarningExiting] =
    useState(false);

  const showPasswordLimitWarning = () => {
    setPasswordLimitWarningVisible(true);
    setPasswordLimitWarningExiting(false);
  };

  useEffect(() => {
    if (!passwordLimitWarningVisible) {
      return;
    }

    const fadeTimer = window.setTimeout(() => {
      setPasswordLimitWarningExiting(true);
    }, 3400);
    const clearTimer = window.setTimeout(() => {
      setPasswordLimitWarningVisible(false);
      setPasswordLimitWarningExiting(false);
    }, 3800);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(clearTimer);
    };
  }, [passwordLimitWarningVisible]);

  const handleGoogleRegisterSuccess = (
    credentialResponse: CredentialResponse,
  ) => {
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
    clearRegisterDraft();
    navigate('/login', { replace: true });
  };

  const handleHeaderBack = () => {
    if (step === 1) {
      goToLogin();
      return;
    }

    goBackToStep1();
  };

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-[#111827] dark:bg-slate-950 dark:text-slate-100">
      <main className="mx-auto min-h-screen w-full max-w-[430px] bg-[#f7f8fb] dark:bg-slate-950">
        {step === 1 ? (
          <section
            className="flex min-h-screen flex-col"
            aria-labelledby="register-business-title"
          >
            <RegisterHeader
              title="Crear cuenta"
              onBack={handleHeaderBack}
              labelledBy="register-business-title"
            />

            <div className="flex-1 px-4 pb-[calc(env(safe-area-inset-bottom)+96px)] pt-5">
              <RegisterProgress
                step={step}
                totalSteps={2}
                progressPercent={progressPercent}
              />

              <h2 className="mt-4 text-[1.32rem] font-black leading-tight tracking-normal text-[#111827] dark:text-slate-100">
                Comencemos configurando tu negocio
              </h2>
              <p className="mt-2 text-sm font-medium leading-5 text-[#667085] dark:text-slate-300">
                Cuéntanos cómo opera tu negocio para preparar el sistema a tu
                medida.
              </p>



              {error ? (
                <ToastNotification
                  message="Revisa los campos resaltados."
                  onDismiss={() => setStepOneErrors({})}
                />
              ) : null}


              <div className="mt-5">
                <TextInput
                  id="register-business-name"
                  label="Nombre del negocio"
                  value={nombreOrganizacion}
                  onChange={(value) => {
                    setNombreOrganizacion(normalizeBusinessNameInput(value));
                    setStepOneErrors((prev) => ({
                      ...prev,
                      nombreOrganizacion: undefined,
                    }));
                  }}
                  placeholder="Ej: Cafe Los Alpes"
                  autoComplete="organization"
                  error={stepOneErrors.nombreOrganizacion}
                  maxLength={BUSINESS_NAME_MAX_LENGTH}
                  showCounter
                />
              </div>

              <div className="mt-6">
                <p className={`${fieldLabelClass} mb-3 text-sm`}>
                  Tipo de negocio
                </p>
                <div
                  className="grid grid-cols-1 gap-3"
                  role="radiogroup"
                  aria-label="Tipo de negocio"
                >
                  {businessTypes.map((type) => (
                    <BusinessTypeCard
                      key={type.value}
                      type={type}
                      selected={tipoOrganizacion === type.value}
                      onSelect={() => {
                        setTipoOrganizacion(type.value);
                        setStepOneErrors((prev) => ({
                          ...prev,
                          tipoOrganizacion: undefined,
                        }));
                      }}
                    />
                  ))}
                </div>
                {stepOneErrors.tipoOrganizacion ? (
                  <FieldError message={stepOneErrors.tipoOrganizacion} />
                ) : null}
              </div>

              <div className="mt-4">
                <TextareaInput
                  id="register-business-description"
                  label="Describe cómo opera tu negocio. (Opcional)"
                  value={descripcionOrganizacion}
                  onChange={(value) => {
                    setDescripcionOrganizacion(
                      normalizeBusinessDescriptionInput(value),
                    );
                    setStepOneErrors((prev) => ({
                      ...prev,
                      descripcionOrganizacion: undefined,
                    }));
                  }}
                  placeholder="Ej: Laboratorio de finca que evalúa muestras de café y registra calidad."
                  error={stepOneErrors.descripcionOrganizacion}
                  maxLength={BUSINESS_DESCRIPTION_MAX_LENGTH}
                  showCounter
                />
              </div>
            </div>

            <RegisterFooter
              primaryLabel="Siguiente paso"
              onPrimary={goToStep2}
              icon={<ArrowRight size={16} />}
              onHelp={() => setSupportModal('help')}
              onContact={() => setSupportModal('contact')}
            />
          </section>
        ) : (
          <section
            className="flex min-h-screen flex-col"
            aria-labelledby="register-admin-title"
          >
            <RegisterHeader
              title="Crear cuenta"
              onBack={handleHeaderBack}
              labelledBy="register-admin-title"
            />

            <div className="flex-1 px-4 pb-[calc(env(safe-area-inset-bottom)+96px)] pt-5">
              <RegisterProgress
                step={step}
                totalSteps={2}
                progressPercent={progressPercent}
              />

              <h2 className="mt-4 text-[1.32rem] font-black leading-tight tracking-normal text-[#111827] dark:text-slate-100">
                Paso 2: Datos del administrador
              </h2>
              <p className="mt-2 text-sm font-medium leading-5 text-[#667085] dark:text-slate-300">
                Crea la cuenta principal para operar Café Smart con seguridad.

              </p>

              {error ? (
                <ToastNotification message="Revisa los campos resaltados." onDismiss={()=>setStepTwoErrors({})} />
              ) : null}

              <div className="mt-5 rounded-[22px] border border-[#e6ebf3] bg-white p-4 shadow-[0_18px_44px_rgba(15,23,42,0.07)] dark:border-slate-700 dark:bg-slate-900">
                <div className="mb-5 flex items-start gap-4 rounded-[18px] border border-[#d9e5fb] bg-[#f1f6ff] px-4 py-4 dark:border-blue-500/30 dark:bg-blue-500/10">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#274ab8] text-white shadow-[0_10px_22px_rgba(39,74,184,0.22)]">
                    <ShieldCheck size={23} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-black text-[#10224d] dark:text-blue-100">
                      Cuenta administradora
                    </span>
                    <span className="mt-1 block text-sm font-medium leading-5 text-[#45607f] dark:text-slate-300">
                      Gestionará usuarios, compras e inventario del sistema.

                    </span>
                  </span>
                </div>

                {hasGoogleFlow ? (
                  <p className="mb-5 rounded-[14px] border border-[#d9e5fb] bg-[#f8fbff] px-4 py-3 text-sm font-semibold leading-5 text-[#355070] dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-100">
                      Google completó tus datos. Revísalos y termina el registro.

                  </p>
                ) : null}

                <form onSubmit={handleSubmit} noValidate className="space-y-5">
                  <section className="space-y-3">
                    <SectionHeader label="Datos personales" />
                    <div className="grid grid-cols-2 gap-3">
                      <TextInput
                        id="register-admin-name"
                        label="Nombre"
                        value={nombre}
                        onChange={(value) => {
                          setNombre(normalizeHumanNameInput(value));
                          setStepTwoErrors((prev) => ({
                            ...prev,
                            nombre: undefined,
                          }));
                        }}
                        placeholder="Ej: Juan"
                        autoComplete="given-name"
                        error={stepTwoErrors.nombre}
                        maxLength={PERSON_NAME_MAX_LENGTH}
                        showCounter
                        compactLabel
                      />

                      <TextInput
                        id="register-admin-lastname"
                        label="Apellidos"
                        value={apellidos}
                        onChange={(value) => {
                          setApellidos(normalizeHumanNameInput(value).slice(0, PERSON_LASTNAME_MAX_LENGTH));
                          setStepTwoErrors((prev) => ({
                            ...prev,
                            apellidos: undefined,
                          }));
                        }}
                        placeholder="Ej: Perez Gomez"
                        autoComplete="family-name"
                        error={stepTwoErrors.apellidos}
                        maxLength={PERSON_LASTNAME_MAX_LENGTH}
                        showCounter
                        compactLabel
                      />
                    </div>
                  </section>

                  <section className="space-y-3">
                    <SectionHeader label="Contacto" />
                    <PhoneInput
                      id="register-admin-phone"
                      label="Teléfono"
                      value={telefono}
                      onChange={(value) => {
                        setTelefono(formatNationalPhone(value));
                        setStepTwoErrors((prev) => ({
                          ...prev,
                          telefono: undefined,
                        }));
                      }}
                      error={stepTwoErrors.telefono}
                    />

                    <div>
                      <TextInput
                        id="register-admin-email"
                        label="Correo electrónico"
                        value={correo}
                        onChange={(value) => {
                          setCorreo(value);
                          setStepTwoErrors((prev) => ({
                            ...prev,
                            correo: undefined,
                          }));
                        }}
                        onBlur={async () => {
                          const emailExistsError =
                            await validateEmailAvailability(correo);
                          if (emailExistsError) {
                            setStepTwoErrors((prev) => ({
                              ...prev,
                              correo: emailExistsError,
                            }));
                          }
                        }}
                        placeholder="admin@empresa.com"
                        autoComplete="email"
                        error={stepTwoErrors.correo}
                        compactLabel
                      />
                      {isCheckingEmail && !stepTwoErrors.correo ? (
                      <p className={fieldHelpTextClass}>
                        Validando correo...
                      </p>
                      ) : null}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <SectionHeader label="Seguridad" />
                    <div>
                      <label
                        htmlFor="register-admin-password"
                        className={`${fieldLabelClass} text-xs font-black`}
                      >
                        Contraseña
                      </label>
                      <div className="relative">
                        <input
                          id="register-admin-password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(event) => {
                            if (event.target.value.length >= PASSWORD_MAX_LENGTH) {
                              showPasswordLimitWarning();
                            }
                            setPassword(event.target.value.slice(0, PASSWORD_MAX_LENGTH));
                            setStepTwoErrors((prev) => ({
                              ...prev,
                              password: undefined,
                            }));
                          }}
                          maxLength={PASSWORD_MAX_LENGTH}
                          placeholder="Crea una contraseña"
                          autoComplete="new-password"
                          aria-describedby={
                            stepTwoErrors.password
                              ? 'register-admin-password-error register-admin-password-limit-warning'
                              : passwordLimitWarningVisible
                                ? 'register-admin-password-limit-warning'
                                : undefined
                          }
                          onKeyDown={(event) => {
                            if (
                              password.length >= PASSWORD_MAX_LENGTH &&
                              event.key.length === 1 &&
                              !event.metaKey &&
                              !event.ctrlKey &&
                              !event.altKey
                            ) {
                              showPasswordLimitWarning();
                            }
                          }}
                          className={`${fieldInputClass} register-credential-input min-h-[54px] rounded-[14px] px-4 pr-11 caret-[#274ab8] shadow-[0_8px_20px_rgba(15,23,42,0.045)] placeholder:text-[#7b8798] selection:bg-blue-200 selection:text-slate-950 dark:caret-blue-200 dark:selection:bg-blue-500 dark:selection:text-white ${
                            stepTwoErrors.password
                              ? 'border-rose-400 bg-rose-50/70 text-rose-950 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 dark:border-rose-400/70 dark:bg-rose-500/15 dark:text-rose-100 dark:focus:border-rose-300 dark:focus:ring-rose-400/25'
                              : ''
                          }`}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-transparent p-1 text-slate-500 shadow-none transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                          onClick={() => setShowPassword(!showPassword)}
                          aria-label={
                            showPassword
                              ? 'Ocultar contraseña'
                              : 'Mostrar contraseña'
                          }
                        >
                          {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                      {stepTwoErrors.password ? (
                        <FieldError
                          id="register-admin-password-error"
                          message={stepTwoErrors.password}
                        />
                      ) : null}
                      {passwordLimitWarningVisible ? (
                        <CharacterLimitNotice
                          id="register-admin-password-limit-warning"
                          maxLength={PASSWORD_MAX_LENGTH}
                          exiting={passwordLimitWarningExiting}
                        />
                      ) : null}
                      <div className="mt-2 flex items-center justify-end">
                        <span
                          className={`text-xs font-bold ${
                            password.length >= PASSWORD_MAX_LENGTH
                              ? 'text-amber-600 dark:text-amber-300'
                              : 'text-[#64748b] dark:text-slate-300'
                          }`}
                        >
                          {password.length}/{PASSWORD_MAX_LENGTH}
                        </span>
                      </div>

                      <PasswordRequirementCard
                        checks={passwordChecks}
                        score={passwordStrength.score}
                        label={passwordStrength.label}
                        tone={passwordStrengthTone}
                      />
                    </div>

                    <PasswordInput
                      id="register-admin-password-confirm"
                      label="Confirma tu contraseña"
                      value={confirmPassword}
                      onChange={(value) => {
                        setConfirmPassword(value.slice(0, PASSWORD_MAX_LENGTH));
                        setStepTwoErrors((prev) => ({
                          ...prev,
                          confirmPassword: undefined,
                        }));
                      }}
                      placeholder="Vuelve a escribir tu contraseña"
                      autoComplete="new-password"
                      error={stepTwoErrors.confirmPassword}
                      maxLength={PASSWORD_MAX_LENGTH}
                      showPassword={showPassword}
                      onTogglePassword={() => setShowPassword(!showPassword)}
                    />

                    {!stepTwoErrors.confirmPassword && hasStartedConfirming ? (
                      <p
                        className={`text-xs font-semibold ${
                          passwordsMatch ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'
                        }`}
                      >
                        {passwordsMatch
                          ? 'Las contraseñas coinciden.'
                          : 'Las contraseñas no coinciden.'}


                      </p>
                    ) : null}
                  </section>

                  <button
                    type="submit"
                    className={`${primaryButtonClass} min-h-[52px] w-full rounded-full shadow-[0_16px_30px_rgba(40,75,193,0.22)] hover:bg-[#203fa8] hover:shadow-[0_18px_34px_rgba(40,75,193,0.26)] active:scale-[0.985] dark:hover:bg-blue-500`}
                  >
                    Crear cuenta
                  </button>

                  {!hasGoogleFlow && isGoogleAuthEnabled ? (
                    <div className="space-y-3 pt-1">
                      <Divider label="O continua con" />
                      {googleLoading ? (
                        <div className="rounded-[12px] border border-[#dbe4ff] bg-[#f5f8ff] px-4 py-4 text-center dark:border-slate-700 dark:bg-slate-950">
                          <Loader
                            size={18}
                            className="mx-auto animate-spin text-[#274ab8]"
                          />
                          <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                            Validando Google...
                          </p>
                        </div>
                      ) : (
                        <div className="group relative mx-auto flex h-11 w-full max-w-[360px] items-center justify-center overflow-hidden rounded-lg focus-within:ring-4 focus-within:ring-[#274ab8]/15 dark:focus-within:ring-blue-400/25">
                          <button
                            type="button"
                            tabIndex={-1}
                            aria-hidden="true"
                            className={`${secondaryButtonClass} pointer-events-none absolute inset-0 z-0 h-11 w-full rounded-lg text-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:group-hover:border-blue-400/70 dark:group-hover:bg-blue-950/35`}
                          >
                            <span
                              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-transparent text-base font-black leading-none text-[#4285f4]"
                              aria-hidden="true"
                            >
                              G
                            </span>
                            <span>Continuar con Google</span>
                          </button>
                          <div className="absolute inset-0 z-10 opacity-0">
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
                        </div>
                      )}
                    </div>
                  ) : null}
                </form>
              </div>

              <RegisterLinks
                onHelp={() => setSupportModal('help')}
                onContact={() => setSupportModal('contact')}
              />
            </div>
          </section>
        )}
      </main>

      {supportModal ? (
        <SupportModal
          type={supportModal}
          onClose={() => setSupportModal(null)}
        />
      ) : null}
    </div>
  );
}

function RegisterHeader({
  title,
  onBack,
  labelledBy,
}: {
  title: string;
  onBack: () => void;
  labelledBy: string;
}) {
  return (
    <header className="border-b border-[#e6ebf3] bg-[#f7f8fb] px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
      <div className="relative flex min-h-[28px] items-center justify-center">
        <button
          type="button"
          onClick={onBack}
          className="absolute left-0 inline-flex h-8 w-8 items-center justify-center rounded-full text-[#536178] transition hover:bg-[#eef2f8] hover:text-[#111827] focus:outline-none focus:ring-4 focus:ring-[#274ab8]/15 dark:bg-slate-800 dark:text-blue-100 dark:hover:bg-slate-700 dark:hover:text-white dark:focus:ring-blue-400/25"
          aria-label="Volver"
        >
          <ArrowLeft size={16} />
        </button>
        <h1
          id={labelledBy}
          className="text-center text-xs font-black text-[#111827] dark:text-slate-100"
        >
          {title}
        </h1>
      </div>
    </header>
  );
}

function BusinessTypeCard({
  type,
  selected,
  onSelect,
}: {
  type: BusinessType;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-[14px] border px-4 py-4 text-left shadow-sm transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-[#274ab8]/15 active:scale-[0.985] dark:focus:ring-blue-400/25 ${
        selected
          ? 'border-[#274ab8] bg-[#f3f7ff] shadow-[0_12px_28px_rgba(39,74,184,0.13),0_0_0_1px_rgba(39,74,184,0.16)] dark:border-blue-400 dark:bg-blue-500/15 dark:shadow-[0_14px_30px_rgba(37,99,235,0.18)]'
          : 'border-[#dfe5f1] bg-white hover:-translate-y-0.5 hover:border-[#cbd6e8] hover:shadow-[0_12px_24px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800'
      }`}
      role="radio"
      aria-checked={selected}
    >
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] transition-all duration-200 ${
            selected
              ? 'bg-[#274ab8] text-white shadow-[0_10px_22px_rgba(39,74,184,0.22)] dark:bg-blue-500'
              : colorByType[type.value]
          }`}
        >
          {type.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-black text-[#111827] dark:text-slate-100">
            {type.label}
          </span>
          <span className="mt-1 block text-[11px] font-medium leading-4 text-[#73829a] dark:text-slate-300">
            {type.desc}
          </span>
        </span>
        <span
          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
            selected
              ? 'scale-100 border-[#274ab8] bg-[#274ab8] text-white dark:border-blue-400 dark:bg-blue-500'
              : 'scale-95 border-[#c8d2e2] bg-white text-transparent dark:border-slate-600 dark:bg-slate-950'
          }`}
          aria-hidden="true"
        >
          <Check size={13} strokeWidth={3} />
        </span>
      </div>
    </button>
  );
}

function TextInput({
  id,
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  type = 'text',
  autoComplete,
  error,
  compactLabel = false,
  maxLength,
  showCounter = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void | Promise<void>;
  placeholder: string;
  type?: string;
  autoComplete?: string;
  error?: string;
  compactLabel?: boolean;
  maxLength?: number;
  showCounter?: boolean;
}) {
  const errorId = `${id}-error`;
  const counterId = `${id}-counter`;
  const limitWarningId = `${id}-limit-warning`;
  const [limitWarningVisible, setLimitWarningVisible] = useState(false);
  const [limitWarningExiting, setLimitWarningExiting] = useState(false);
  const describedBy = [
    error ? errorId : null,
    showCounter && maxLength ? counterId : null,
    limitWarningVisible && maxLength ? limitWarningId : null,
  ]
    .filter(Boolean)
    .join(' ');
  const showLimitWarning = () => {
    if (!maxLength) {
      return;
    }

    setLimitWarningVisible(true);
    setLimitWarningExiting(false);
  };

  useEffect(() => {
    if (!limitWarningVisible) {
      return;
    }

    const fadeTimer = window.setTimeout(() => {
      setLimitWarningExiting(true);
    }, 3400);
    const clearTimer = window.setTimeout(() => {
      setLimitWarningVisible(false);
      setLimitWarningExiting(false);
    }, 3800);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(clearTimer);
    };
  }, [limitWarningVisible]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label
          htmlFor={id}
          className={`${fieldLabelClass} ${
            compactLabel ? 'text-xs font-black' : 'text-sm font-semibold'
          }`}
        >
          {label}
        </label>
        {showCounter && maxLength ? (
          <span
            id={counterId}
            className={`text-xs font-bold ${
              value.length >= maxLength ? 'text-amber-600 dark:text-amber-300' : 'text-[#64748b] dark:text-slate-300'
            }`}
          >
            {value.length}/{maxLength}
          </span>
        ) : null}
      </div>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(event) => {
          if (maxLength && event.target.value.length >= maxLength) {
            showLimitWarning();
          }

          onChange(
            maxLength
              ? event.target.value.slice(0, maxLength)
              : event.target.value,
          );
        }}
        onKeyDown={(event) => {
          if (
            maxLength &&
            value.length >= maxLength &&
            event.key.length === 1 &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.altKey
          ) {
            showLimitWarning();
          }
        }}
        onBlur={() => void onBlur?.()}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        aria-describedby={describedBy || undefined}
        className={`${fieldInputClass} register-credential-input min-h-[54px] rounded-[14px] px-4 caret-[#274ab8] shadow-[0_8px_20px_rgba(15,23,42,0.045)] placeholder:text-[#7b8798] selection:bg-blue-200 selection:text-slate-950 dark:caret-blue-200 dark:selection:bg-blue-500 dark:selection:text-white ${
          error
            ? 'border-rose-400 bg-rose-50/70 text-rose-950 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 dark:border-rose-400/70 dark:bg-rose-500/15 dark:text-rose-100 dark:focus:border-rose-300 dark:focus:ring-rose-400/25'
            : ''
        }`}
      />
      {limitWarningVisible && maxLength ? (
        <CharacterLimitNotice
          id={limitWarningId}
          maxLength={maxLength}
          exiting={limitWarningExiting}
        />
      ) : null}
      {error ? <FieldError id={errorId} message={error} /> : null}
    </div>
  );
}

function TextareaInput({
  id,
  label,
  helpText,
  value,
  onChange,
  placeholder,
  error,
  maxLength,
  showCounter = false,
}: {
  id: string;
  label: string;
  helpText?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
  maxLength?: number;
  showCounter?: boolean;
}) {
  const errorId = `${id}-error`;
  const counterId = `${id}-counter`;
  const helpId = helpText ? `${id}-help` : undefined;
  const limitWarningId = `${id}-limit-warning`;
  const [limitWarningVisible, setLimitWarningVisible] = useState(false);
  const [limitWarningExiting, setLimitWarningExiting] = useState(false);
  const describedBy = [
    helpId,
    error ? errorId : null,
    showCounter && maxLength ? counterId : null,
    limitWarningVisible && maxLength ? limitWarningId : null,
  ]
    .filter(Boolean)
    .join(' ');

  const showLimitWarning = () => {
    if (!maxLength) return;
    setLimitWarningVisible(true);
    setLimitWarningExiting(false);
  };

  useEffect(() => {
    if (!limitWarningVisible) return;

    const fadeTimer = window.setTimeout(() => {
      setLimitWarningExiting(true);
    }, 3400);
    const clearTimer = window.setTimeout(() => {
      setLimitWarningVisible(false);
      setLimitWarningExiting(false);
    }, 3800);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(clearTimer);
    };
  }, [limitWarningVisible]);

  return (
    <div>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <label
            htmlFor={id}
            className={`${fieldLabelClass} text-sm font-semibold`}
          >
            {label}
          </label>
          {helpText ? (
            <p id={helpId} className={fieldHelpTextClass}>
              {helpText}
            </p>
          ) : null}
        </div>
        {showCounter && maxLength ? (
          <span
            id={counterId}
            className={`shrink-0 text-xs font-bold ${
              value.length >= maxLength
                ? 'text-amber-600 dark:text-amber-300'
                : 'text-[#64748b] dark:text-slate-300'
            }`}
          >
            {value.length}/{maxLength}
          </span>
        ) : null}
      </div>
      <textarea
        id={id}
        name={id}
        value={value}
        onChange={(event) => {
          if (maxLength && event.target.value.length >= maxLength) {
            showLimitWarning();
          }

          onChange(
            maxLength
              ? event.target.value.slice(0, maxLength)
              : event.target.value,
          );
        }}
        onKeyDown={(event) => {
          if (
            maxLength &&
            value.length >= maxLength &&
            event.key.length === 1 &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.altKey
          ) {
            showLimitWarning();
          }
        }}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={3}
        aria-describedby={describedBy || undefined}
        className={`${fieldTextareaClass} register-credential-input min-h-[92px] resize-none rounded-[14px] px-4 py-3 caret-[#274ab8] shadow-[0_8px_20px_rgba(15,23,42,0.045)] placeholder:text-[#7b8798] selection:bg-blue-200 selection:text-slate-950 dark:caret-blue-200 dark:selection:bg-blue-500 dark:selection:text-white ${
          error
            ? 'border-rose-400 bg-rose-50/70 text-rose-950 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 dark:border-rose-400/70 dark:bg-rose-500/15 dark:text-rose-100 dark:focus:border-rose-300 dark:focus:ring-rose-400/25'
            : ''
        }`}
      />
      {limitWarningVisible && maxLength ? (
        <CharacterLimitNotice
          id={limitWarningId}
          maxLength={maxLength}
          exiting={limitWarningExiting}
        />
      ) : null}
      {error ? <FieldError id={errorId} message={error} /> : null}
    </div>
  );
}

function PasswordInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  error,
  maxLength,
  showPassword,
  onTogglePassword,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete?: string;
  error?: string;
  maxLength?: number;
  showPassword: boolean;
  onTogglePassword: () => void;
}) {
  const errorId = `${id}-error`;

  return (
    <div>
      <label
        htmlFor={id}
        className={`${fieldLabelClass} text-xs font-black`}
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(event) => {
            onChange(
              maxLength
                ? event.target.value.slice(0, maxLength)
                : event.target.value,
            );
          }}
          placeholder={placeholder}
          autoComplete={autoComplete}
          maxLength={maxLength}
          aria-describedby={error ? errorId : undefined}
          className={`${fieldInputClass} register-credential-input min-h-[54px] rounded-[14px] px-4 pr-11 caret-[#274ab8] shadow-[0_8px_20px_rgba(15,23,42,0.045)] placeholder:text-[#7b8798] selection:bg-blue-200 selection:text-slate-950 dark:caret-blue-200 dark:selection:bg-blue-500 dark:selection:text-white ${
            error
              ? 'border-rose-400 bg-rose-50/70 text-rose-950 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 dark:border-rose-400/70 dark:bg-rose-500/15 dark:text-rose-100 dark:focus:border-rose-300 dark:focus:ring-rose-400/25'
              : ''
          }`}
        />
        <button
          type="button"
          className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border-0 bg-transparent p-1 text-slate-500 shadow-none transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400/40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          onClick={onTogglePassword}
          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      {error ? <FieldError id={errorId} message={error} /> : null}
    </div>
  );
}

function CharacterLimitNotice({
  id,
  maxLength,
  exiting,
}: {
  id?: string;
  maxLength: number;
  exiting: boolean;
}) {
  return (
    <AppFeedbackMessage
      id={id}
      variant="warning"
      description={`Llegaste al máximo de ${maxLength} caracteres.`}
      className={`mt-2 ${
        exiting ? '-translate-y-1 opacity-0' : 'translate-y-0 opacity-100'
      }`}
    />
  );
}

function PhoneInput({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const errorId = `${id}-error`;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const caretDigitIndex = useRef<number | null>(null);
  const formattedValue = formatNationalPhone(value);

  useEffect(() => {
    const input = inputRef.current;
    if (!input || caretDigitIndex.current === null) {
      return;
    }

    const nextPosition = getCaretPositionForDigits(
      formattedValue,
      caretDigitIndex.current,
    );
    input.setSelectionRange(nextPosition, nextPosition);
    caretDigitIndex.current = null;
  }, [formattedValue]);

  return (
    <div>
      <label
        htmlFor={id}
        className={`${fieldLabelClass} text-xs font-black`}
      >
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 bg-transparent text-sm font-black text-[#102d92] dark:text-blue-200">
          +57
        </span>
        <input
          ref={inputRef}
          id={id}
          name={id}
          type="tel"
          inputMode="numeric"
          value={formattedValue}
          onChange={(event) => {
            const selectionStart =
              event.currentTarget.selectionStart ?? event.currentTarget.value.length;
            caretDigitIndex.current = getPhoneDigits(
              event.currentTarget.value.slice(0, selectionStart),
            ).length;
            onChange(event.currentTarget.value);
          }}
          placeholder="300 123 4567"
          autoComplete="tel-national"
          maxLength={12}
          aria-describedby={error ? errorId : undefined}
          className={`${fieldInputClass} register-credential-input min-h-[54px] rounded-[14px] px-4 pl-[4.15rem] caret-[#274ab8] shadow-[0_8px_20px_rgba(15,23,42,0.045)] placeholder:text-[#7b8798] selection:bg-blue-200 selection:text-slate-950 dark:caret-blue-200 dark:selection:bg-blue-500 dark:selection:text-white ${
            error
              ? 'border-rose-400 bg-rose-50/70 text-rose-950 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 dark:border-rose-400/70 dark:bg-rose-500/15 dark:text-rose-100 dark:focus:border-rose-300 dark:focus:ring-rose-400/25'
              : ''
          }`}
        />
      </div>
      {error ? <FieldError id={errorId} message={error} /> : null}
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-px flex-1 bg-[#edf1f7] dark:bg-slate-700" />
      <p className="shrink-0 text-[10px] font-black uppercase tracking-[0.14em] text-[#475569] dark:text-slate-300">
        {label}
      </p>
      <span className="h-px flex-1 bg-[#edf1f7] dark:bg-slate-700" />
    </div>
  );
}

function PasswordRequirementCard({
  checks,
  score,
  label,
  tone,
}: {
  checks: ReturnType<typeof getPasswordChecks>;
  score: number;
  label: string;
  tone: string;
}) {
  const requirements = [
    { active: checks.minLength && checks.maxLength, label: '8 a 32 caracteres' },
    { active: checks.hasUpper, label: 'Una mayúscula' },
    { active: checks.hasLower, label: 'Una minúscula' },
    { active: checks.hasNumber, label: 'Un número' },
  ];

  return (
    <div className="mt-3 rounded-[15px] border border-[#e8edf6] bg-[#fbfcff] px-3.5 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.035)] dark:border-slate-700 dark:bg-slate-950">
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 text-xs font-black text-[#344054] dark:text-slate-200">
          Seguridad:
          <span className={`ml-1 ${tone}`}>{label}</span>
        </p>
        <div
          className="h-1.5 w-[74px] shrink-0 overflow-hidden rounded-full bg-[#e6ebf3] dark:bg-slate-700"
          aria-hidden="true"
        >
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              score <= 2
                ? 'bg-slate-300'
                : score === 3
                  ? 'bg-amber-500'
                  : score === 4
                    ? 'bg-sky-500'
                    : 'bg-emerald-500'
            } ${
              score <= 0
                ? 'w-0'
                : score === 1
                  ? 'w-1/5'
                  : score === 2
                    ? 'w-2/5'
                    : score === 3
                      ? 'w-3/5'
                      : score === 4
                        ? 'w-4/5'
                        : 'w-full'
            }`}
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
        {requirements.map((requirement) => (
          <PasswordRequirementItem
            key={requirement.label}
            active={requirement.active}
            label={requirement.label}
          />
        ))}
      </div>
    </div>
  );
}

function PasswordRequirementItem({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  return (
    <span
      className={`inline-flex min-w-0 items-center gap-1.5 text-[11px] font-bold leading-4 transition ${
        active ? 'text-[#047857] dark:text-emerald-300' : 'text-[#7b8798] dark:text-slate-300'
      }`}
    >
      <span
        className={`inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border ${
          active
            ? 'border-emerald-500 bg-emerald-500 text-white dark:border-emerald-400 dark:bg-emerald-500'
            : 'border-[#cbd5e1] bg-white text-transparent dark:border-slate-600 dark:bg-slate-900'
        }`}
        aria-hidden="true"
      >
        <Check size={9} strokeWidth={3} />
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}

function getCaretPositionForDigits(value: string, digitCount: number) {
  if (digitCount <= 0) {
    return 0;
  }

  let seenDigits = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (/\d/.test(value[index])) {
      seenDigits += 1;
      if (seenDigits === digitCount) {
        return index + 1;
      }
    }
  }

  return value.length;
}

function RegisterFooter({
  primaryLabel,
  onPrimary,
  icon,
  onHelp,
  onContact,
}: {
  primaryLabel: string;
  onPrimary: () => void;
  icon: React.ReactNode;
  onHelp: () => void;
  onContact: () => void;
}) {
  return (
    <footer className="mt-6 border-t border-[#e6ebf3] bg-[#f7f8fb]/95 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/95">
      <button
        type="button"
        onClick={onPrimary}
        className={`${primaryButtonClass} min-h-[52px] w-full rounded-full shadow-[0_16px_30px_rgba(40,75,193,0.22)] hover:bg-[#203fa8] hover:shadow-[0_18px_34px_rgba(40,75,193,0.26)] active:scale-[0.985] active:shadow-[0_10px_20px_rgba(40,75,193,0.18)] dark:hover:bg-blue-500`}
      >
        {primaryLabel}
        {icon}
      </button>

      <RegisterLinks onHelp={onHelp} onContact={onContact} />
    </footer>
  );
}

function RegisterLinks({
  onHelp,
  onContact,
}: {
  onHelp: () => void;
  onContact: () => void;
}) {
  return (
    <div className="pt-4 text-center">
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={onHelp}
          className={`${secondaryButtonClass} min-h-9 rounded-full px-4 text-xs shadow-sm active:scale-[0.97]`}
        >
          <CircleHelp size={14} aria-hidden="true" />
          Obtener ayuda
        </button>
        <button
          type="button"
          onClick={onContact}
          className={`${secondaryButtonClass} min-h-9 rounded-full border-transparent px-3 text-xs active:scale-[0.97]`}
        >
          <Headset size={14} aria-hidden="true" />
          Contacto
        </button>
      </div>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-[#e3e8f0] dark:bg-slate-700" />
      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#93a1b6] dark:text-slate-400">
        {label}
      </span>
      <div className="h-px flex-1 bg-[#e3e8f0] dark:bg-slate-700" />
    </div>
  );
}

function FieldError({ id, message }: { id?: string; message: string }) {
  return (
    <p
      id={id}
      role="alert"
      className="mt-1.5 rounded-[10px] border border-rose-200 bg-rose-50/80 px-3 py-2 text-xs font-semibold leading-5 text-rose-700 dark:border-rose-400/40 dark:bg-rose-500/15 dark:text-rose-100"
    >
      {message}
    </p>
  );
}

function ToastNotification({
  message,
  onDismiss,
  type = 'error',
}: {
  message: string;
  onDismiss?: () => void;
  type?: 'error' | 'info' | 'warning';
}) {
  const [fadeOut, setFadeOut] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const t1 = window.setTimeout(() => setFadeOut(true), 2500);
    const t2 = window.setTimeout(() => setHidden(true), 3000);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  if (hidden) return null;

  return (
    <AppFeedbackMessage
      variant={type === 'error' ? 'warning' : type}
      description={message}
      className={`transform backdrop-blur-sm transition-all duration-500 ease-out ${
        fadeOut ? 'translate-y-1 opacity-0' : 'translate-y-0 opacity-100'
      } ${onDismiss ? 'cursor-pointer hover:opacity-80' : ''}`}
      onClick={onDismiss}
    />
  );
}


function SupportModal({
  type,
  onClose,
}: {
  type: 'help' | 'contact';
  onClose: () => void;
}) {
  const isHelp = type === 'help';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-5"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-support-title"
        className={`flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-[20px] border border-[#e2e8f0] bg-white p-5 shadow-[0_20px_50px_rgba(15,23,42,0.20)] animate-[cafesmartFadeScale_220ms_ease-out_both] sm:p-6 dark:border-slate-700 dark:bg-slate-900 ${
          isHelp ? 'max-w-[480px]' : 'max-w-[480px] sm:max-w-[540px]'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`flex items-start justify-between gap-4 ${isHelp ? 'mb-6' : 'mb-4'}`}>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#2563eb] dark:text-blue-300">
              Soporte
            </p>
            <h2
              id="register-support-title"
              className={`${isHelp ? 'mt-3 text-3xl' : 'mt-2 text-2xl'} font-black leading-tight text-[#0f172a] dark:text-slate-100`}
            >
              {isHelp ? 'Ayuda básica' : 'Contacto'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#334155] transition hover:bg-[#eef2f8] hover:text-[#0f172a] focus:outline-none focus:ring-4 focus:ring-[#2563eb]/15 active:scale-95 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white dark:focus:ring-blue-400/25"
            aria-label="Cerrar modal"
          >
            <X size={24} strokeWidth={2.4} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {isHelp ? (
            <HelpModalContent />
          ) : (
            <ContactModalContent />
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className={`${isHelp ? 'mt-7 min-h-[54px]' : 'mt-4 min-h-[48px]'} shrink-0 w-full rounded-[12px] bg-[#2563eb] px-4 text-base font-black text-white shadow-[0_14px_28px_rgba(37,99,235,0.22)] transition-all hover:bg-[#1d4ed8] focus:outline-none focus:ring-4 focus:ring-blue-400/25 active:scale-[0.985] dark:bg-blue-600 dark:hover:bg-blue-500`}
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

function HelpModalContent() {
  const steps = [
    {
      number: '1',
      title: 'Escribe el nombre del negocio',
      text: 'Usa el nombre exacto con el que lo usas diariamente.',
    },
    {
      number: '2',
      title: 'Selecciona el tipo de negocio',
      text: 'Elige la opción que mejor describa tu operación cafetera.',
    },
    {
      number: '3',
      title: 'Pulsa Siguiente paso',
      text: 'Continuarás con los datos del administrador.',
    },
  ];

  return (
    <div>
      <div className="mb-6 flex items-start gap-4">
        <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#eef2ff] text-[#1d4ed8] dark:bg-blue-500/20 dark:text-blue-100">
          <CircleHelp size={28} fill="currentColor" className="text-[#1d4ed8] dark:text-blue-100" aria-hidden="true" />
        </span>
        <p className="pt-1 text-base font-medium leading-7 text-[#475569] dark:text-slate-300">
          Sigue estos pasos para completar el registro de tu negocio.
        </p>
      </div>

      <div className="space-y-0" aria-label="Pasos de Ayuda básica">
        {steps.map((step, index) => (
          <div key={step.number}>
            {/* Row layout: ONLY 2 columns (icon/number + text) */}
            <div className="grid grid-cols-[3rem_1fr] items-center gap-3 py-3">
              {/* Left column: ONLY numbered circle */}
              <div className="flex items-center justify-center">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#eef2ff] text-sm font-black leading-none text-[#1d4ed8] dark:bg-blue-500/20 dark:text-blue-100">
                  {step.number}
                </span>
              </div>


              {/* Right column: title + description */}
              <span>
                <span className="block text-sm font-black leading-5 text-[#0f172a] dark:text-slate-100">
                  {step.title}
                </span>
                <span className="mt-1 block text-sm font-medium leading-5 text-[#475569] dark:text-slate-300">
                  {step.text}
                </span>
              </span>
            </div>

            {/* Divider aligns with text area (right column), not icons */}
            {index < steps.length - 1 ? (
              <div className="grid grid-cols-[3rem_1fr] gap-3">
                <div />
                <div className="h-px bg-[#e2e8f0] dark:bg-slate-700" />
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <InfoNotice text="Si tienes dudas durante el proceso, puedes comunicarte con soporte." />
    </div>
  );
}

function ContactModalContent() {
  const contactItems = [
    {
      icon: <Mail size={25} />,
      title: 'Correo electrónico',
      text: 'soporte@cafesmart.com',
    },
    {
      icon: <Phone size={25} />,
      title: 'Teléfono',
      text: '+57 300 000 0000',
    },
    {
      icon: <Clock size={25} />,
      title: 'Horario de atención',
      text: 'Lunes a Viernes\n8:00 a.m. - 6:00 p.m.',
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eef2ff] text-[#1d4ed8] dark:bg-blue-500/20 dark:text-blue-100">
          <Headset size={24} aria-hidden="true" />
        </span>
        <p className="pt-0.5 text-sm font-medium leading-6 text-[#475569] dark:text-slate-300">
          Si tienes problemas con el registro, puedes comunicarte con nuestro
          equipo de soporte.
        </p>
      </div>

      <div className="rounded-[12px] border border-[#e2e8f0] bg-white px-4 shadow-sm dark:border-slate-700 dark:bg-slate-950">
        {contactItems.map((item, index) => (
          <div key={item.title}>
            <div className="grid grid-cols-[2.25rem_1fr] items-start gap-3 py-3">
              <span
                className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#eef2ff] text-[#1d4ed8] dark:bg-blue-500/20 dark:text-blue-100"
                aria-hidden="true"
              >
                {item.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black leading-5 text-[#0f172a] dark:text-slate-100">
                  {item.title}
                </span>
                <span className="mt-0.5 block max-w-full whitespace-pre-line break-words text-sm font-semibold leading-5 text-[#2563eb] dark:text-blue-200">
                  {item.text}
                </span>
              </span>
            </div>
            {index < contactItems.length - 1 ? (
              <div className="grid grid-cols-[2.25rem_1fr] gap-3">
                <div />
                <div className="h-px bg-[#e2e8f0] dark:bg-slate-700" />
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <InfoNotice text="Te responderemos a la brevedad posible. Gracias por tu paciencia." compact />
    </div>
  );
}

function InfoNotice({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <div
      className={`${compact ? 'mt-4 gap-2.5 px-3 py-3 text-xs leading-5' : 'mt-6 gap-3 px-4 py-4 text-sm leading-6'} flex items-center rounded-[12px] bg-[#f1f5ff] font-medium text-[#475569] dark:bg-blue-500/10 dark:text-slate-300`}
    >
      <Info size={compact ? 18 : 24} className="shrink-0 text-[#1d4ed8] dark:text-blue-100" aria-hidden="true" />
      <span>{text}</span>
    </div>
  );
}
