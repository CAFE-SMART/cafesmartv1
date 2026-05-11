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
import { RegisterProgress } from '../components/register/RegisterProgress';
import { useRegisterForm } from '../hooks/useRegisterForm';
import {
  getPasswordChecks,
  getPasswordStrength,
  BUSINESS_NAME_MAX_LENGTH,
  PERSON_LASTNAME_MAX_LENGTH,
  PERSON_NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  type RegisterLocationState,
  type TipoOrg,
} from '../utils/registerValidators';
import { getGooglePrefillFromIdToken } from '../utils/googleProfile';
import { formatNationalPhone, getPhoneDigits } from '../utils/formatPhone';

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
  COOPERATIVA: 'bg-[#eef4ff] text-[#2f5ec4]',
  COMPRAVENTA: 'bg-[#fff5d8] text-[#b58214]',
  PERSONALIZADO: 'bg-[#fff0f2] text-[#d24861]',
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
    <div className="min-h-screen bg-[#f7f8fb] text-[#111827]">
      <main className="mx-auto min-h-screen w-full max-w-[430px] bg-[#f7f8fb]">
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

            <div className="flex-1 px-4 pb-4 pt-5">
              <RegisterProgress
                step={step}
                totalSteps={2}
                progressPercent={progressPercent}
              />

              <h2 className="mt-4 text-[1.32rem] font-black leading-tight tracking-normal text-[#111827]">
                Comencemos configurando tu negocio
              </h2>
              <p className="mt-2 text-sm font-medium leading-5 text-[#667085]">
                Cuéntanos cómo opera tu negocio para preparar el sistema a tu
                medida.
              </p>

              {error ? (
                <AlertBanner
                  message="Revisa los campos resaltados."
                  className="mt-4"
                />
              ) : null}

              <div className="mt-5">
                <TextInput
                  id="register-business-name"
                  label="Nombre del negocio"
                  value={nombreOrganizacion}
                  onChange={(value) => {
                    setNombreOrganizacion(value.slice(0, BUSINESS_NAME_MAX_LENGTH));
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
                <p className="mb-3 text-sm font-semibold text-[#344054]">
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

              {tipoOrganizacion === 'PERSONALIZADO' ? (
                <div className="mt-4">
                  <TextInput
                    id="register-business-custom"
                    label="Descripción"
                    value={otroTipoDetalle}
                    onChange={(value) => {
                      setOtroTipoDetalle(value);
                      setStepOneErrors((prev) => ({
                        ...prev,
                        otroTipoDetalle: undefined,
                      }));
                    }}
                    placeholder="Ej: Trilla, laboratorio o finca"
                    error={stepOneErrors.otroTipoDetalle}
                  />
                </div>
              ) : null}
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

            <div className="flex-1 px-4 pb-6 pt-5">
              <RegisterProgress
                step={step}
                totalSteps={2}
                progressPercent={progressPercent}
              />

              <h2 className="mt-4 text-[1.32rem] font-black leading-tight tracking-normal text-[#111827]">
                Paso 2: Datos del administrador
              </h2>
              <p className="mt-2 text-sm font-medium leading-5 text-[#667085]">
                Crea la cuenta principal para operar Café Smart con seguridad.
              </p>

              {error ? (
                <AlertBanner message="Revisa los campos resaltados." className="mt-4" />
              ) : null}

              <div className="mt-5 rounded-[22px] border border-[#e6ebf3] bg-white p-4 shadow-[0_18px_44px_rgba(15,23,42,0.07)]">
                <div className="mb-5 flex items-start gap-4 rounded-[18px] border border-[#d9e5fb] bg-[#f1f6ff] px-4 py-4">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#274ab8] text-white shadow-[0_10px_22px_rgba(39,74,184,0.22)]">
                    <ShieldCheck size={23} />
                  </span>
                  <span>
                    <span className="block text-sm font-black text-[#10224d]">
                      Cuenta administradora
                    </span>
                    <span className="mt-1 block text-sm font-medium leading-5 text-[#45607f]">
                      Gestionará usuarios, compras e inventario del sistema.
                    </span>
                  </span>
                </div>

                {hasGoogleFlow ? (
                  <p className="mb-5 rounded-[14px] border border-[#d9e5fb] bg-[#f8fbff] px-4 py-3 text-sm font-semibold leading-5 text-[#355070]">
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
                          setNombre(value.slice(0, PERSON_NAME_MAX_LENGTH));
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
                          setApellidos(value.slice(0, PERSON_LASTNAME_MAX_LENGTH));
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
                        <p className="mt-2 text-xs font-semibold text-[#64748b]">
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
                        className="mb-2 block text-xs font-black text-[#344054]"
                      >
                        Contraseña
                      </label>
                      <div
                        className={`flex h-[54px] items-center rounded-[14px] border bg-white px-4 shadow-[0_8px_20px_rgba(15,23,42,0.045)] transition ${
                          stepTwoErrors.password
                            ? 'border-rose-300 bg-rose-50/50'
                            : 'border-[#dfe5f1] focus-within:border-[#274ab8] focus-within:ring-2 focus-within:ring-[#274ab8]/10'
                        }`}
                      >
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
                          aria-invalid={Boolean(stepTwoErrors.password)}
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
                          className="h-full min-w-0 flex-1 border-0 bg-transparent py-0 text-sm font-semibold text-slate-900 outline-none placeholder:text-[#a8b4c5]"
                        />
                        <button
                          type="button"
                          className="ml-3 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#9aa8bc] transition-colors hover:bg-[#f4f6fb] hover:text-[#536178]"
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
                              ? 'text-amber-600'
                              : 'text-[#64748b]'
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

                    <TextInput
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
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      error={stepTwoErrors.confirmPassword}
                      maxLength={PASSWORD_MAX_LENGTH}
                      compactLabel
                    />

                    {!stepTwoErrors.confirmPassword && hasStartedConfirming ? (
                      <p
                        className={`text-xs font-semibold ${
                          passwordsMatch ? 'text-emerald-600' : 'text-rose-600'
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
                    className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-[#284bc1] px-4 text-sm font-black text-white shadow-[0_16px_30px_rgba(40,75,193,0.22)] transition-all duration-200 hover:bg-[#203fa8] hover:shadow-[0_18px_34px_rgba(40,75,193,0.26)] active:scale-[0.985]"
                  >
                    Crear cuenta
                  </button>

                  {!hasGoogleFlow && isGoogleAuthEnabled ? (
                    <div className="space-y-3 pt-1">
                      <Divider label="O continua con" />
                      {googleLoading ? (
                        <div className="rounded-[12px] border border-[#dbe4ff] bg-[#f5f8ff] px-4 py-4 text-center">
                          <Loader
                            size={18}
                            className="mx-auto animate-spin text-[#274ab8]"
                          />
                          <p className="mt-2 text-sm font-semibold text-slate-700">
                            Validando Google...
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
    <header className="border-b border-[#e6ebf3] bg-[#f7f8fb] px-4 py-3">
      <div className="relative flex min-h-[28px] items-center justify-center">
        <button
          type="button"
          onClick={onBack}
          className="absolute left-0 inline-flex h-8 w-8 items-center justify-center rounded-full text-[#536178] transition hover:bg-[#eef2f8] hover:text-[#111827]"
          aria-label="Volver"
        >
          <ArrowLeft size={16} />
        </button>
        <h1
          id={labelledBy}
          className="text-center text-xs font-black text-[#111827]"
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
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`w-full rounded-[14px] border px-4 py-4 text-left shadow-sm transition-all duration-200 active:scale-[0.985] ${
        selected
          ? 'border-[#274ab8] bg-[#f3f7ff] shadow-[0_12px_28px_rgba(39,74,184,0.13),0_0_0_1px_rgba(39,74,184,0.16)]'
          : 'border-[#dfe5f1] bg-white hover:-translate-y-0.5 hover:border-[#cbd6e8] hover:shadow-[0_12px_24px_rgba(15,23,42,0.06)]'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[11px] transition-all duration-200 ${
            selected
              ? 'bg-[#274ab8] text-white shadow-[0_10px_22px_rgba(39,74,184,0.22)]'
              : colorByType[type.value]
          }`}
        >
          {type.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-black text-[#111827]">
            {type.label}
          </span>
          <span className="mt-1 block text-[11px] font-medium leading-4 text-[#73829a]">
            {type.desc}
          </span>
        </span>
        <span
          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ${
            selected
              ? 'scale-100 border-[#274ab8] bg-[#274ab8] text-white'
              : 'scale-95 border-[#c8d2e2] bg-white text-transparent'
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
          className={`block text-[#344054] ${
            compactLabel ? 'text-xs font-black' : 'text-sm font-semibold'
          }`}
        >
          {label}
        </label>
        {showCounter && maxLength ? (
          <span
            id={counterId}
            className={`text-xs font-bold ${
              value.length >= maxLength ? 'text-amber-600' : 'text-[#64748b]'
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
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        className={`block min-h-[54px] w-full rounded-[14px] border px-4 text-sm font-semibold text-slate-900 shadow-[0_8px_20px_rgba(15,23,42,0.045)] outline-none transition placeholder:text-[#a8b4c5] ${
          error
            ? 'border-rose-300 bg-rose-50/50'
            : 'border-[#dfe5f1] bg-white focus:border-[#274ab8] focus:ring-2 focus:ring-[#274ab8]/10'
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
    <p
      id={id}
      role="status"
      className={`mt-2 flex items-start gap-2 rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-900 shadow-[0_8px_18px_rgba(180,83,9,0.08)] transition-all duration-300 ${
        exiting ? '-translate-y-1 opacity-0' : 'translate-y-0 opacity-100'
      }`}
    >
      <AlertTriangle
        size={14}
        className="mt-0.5 shrink-0 text-amber-600"
        aria-hidden="true"
      />
      Llegaste al máximo de {maxLength} caracteres.
    </p>
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
        className="mb-2 block text-xs font-black text-[#344054]"
      >
        {label}
      </label>
      <div
        className={`flex h-[54px] items-center overflow-hidden rounded-[14px] border bg-white shadow-[0_8px_20px_rgba(15,23,42,0.045)] transition ${
          error
            ? 'border-rose-300 bg-rose-50/50'
            : 'border-[#dfe5f1] focus-within:border-[#274ab8] focus-within:ring-2 focus-within:ring-[#274ab8]/10'
        }`}
      >
        <span className="flex h-full shrink-0 items-center border-r border-[#e5eaf3] bg-[#f8fafc] px-3 text-sm font-black text-[#274ab8]">
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
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="h-full min-w-0 flex-1 border-0 bg-transparent px-4 py-0 text-sm font-semibold text-slate-900 outline-none placeholder:text-[#a8b4c5]"
        />
      </div>
      {error ? <FieldError id={errorId} message={error} /> : null}
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-px flex-1 bg-[#edf1f7]" />
      <p className="shrink-0 text-[10px] font-black uppercase tracking-[0.14em] text-[#475569]">
        {label}
      </p>
      <span className="h-px flex-1 bg-[#edf1f7]" />
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
    <div className="mt-3 rounded-[15px] border border-[#e8edf6] bg-[#fbfcff] px-3.5 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.035)]">
      <div className="flex items-center gap-3">
        <p className="min-w-0 flex-1 text-xs font-black text-[#344054]">
          Seguridad:
          <span className={`ml-1 ${tone}`}>{label}</span>
        </p>
        <div
          className="h-1.5 w-[74px] shrink-0 overflow-hidden rounded-full bg-[#e6ebf3]"
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
            }`}
            style={{
              width: `${(score / 5) * 100}%`,
            }}
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
        active ? 'text-[#047857]' : 'text-[#7b8798]'
      }`}
    >
      <span
        className={`inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border ${
          active
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : 'border-[#cbd5e1] bg-white text-transparent'
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
    <footer className="mt-6 border-t border-[#e6ebf3] bg-[#f7f8fb]/95 px-4 py-4">
      <button
        type="button"
        onClick={onPrimary}
        className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#284bc1] px-4 text-sm font-black text-white shadow-[0_16px_30px_rgba(40,75,193,0.22)] transition-all duration-200 hover:bg-[#203fa8] hover:shadow-[0_18px_34px_rgba(40,75,193,0.26)] active:scale-[0.985] active:shadow-[0_10px_20px_rgba(40,75,193,0.18)]"
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
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-[#d9e5fb] bg-white px-4 text-xs font-black text-[#274ab8] shadow-sm transition-all hover:bg-[#f3f7ff] active:scale-[0.97]"
        >
          <CircleHelp size={14} />
          Obtener ayuda
        </button>
        <button
          type="button"
          onClick={onContact}
          className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full px-3 text-xs font-bold text-[#536178] transition hover:bg-[#eef2f8] hover:text-[#274ab8] active:scale-[0.97]"
        >
          <Headset size={14} />
          Contacto
        </button>
      </div>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-[#e3e8f0]" />
      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#93a1b6]">
        {label}
      </span>
      <div className="h-px flex-1 bg-[#e3e8f0]" />
    </div>
  );
}

function FieldError({ id, message }: { id?: string; message: string }) {
  return (
    <p
      id={id}
      role="alert"
      className="mt-2 flex items-start gap-1.5 text-xs font-semibold leading-5 text-rose-600"
    >
      <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

function AlertBanner({
  message,
  className = '',
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`flex items-center gap-2 rounded-[10px] border border-rose-200 bg-rose-50/80 px-3 py-2 text-xs font-bold leading-5 text-rose-700 ${className}`.trim()}
    >
      <AlertTriangle size={14} className="shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
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
        className={`max-h-[calc(100vh-2rem)] w-full overflow-y-auto rounded-[20px] border border-[#e2e8f0] bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.20)] animate-[cafesmartFadeScale_220ms_ease-out_both] ${
          isHelp ? 'max-w-[480px]' : 'max-w-[480px] sm:max-w-[760px]'
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-[#2563eb]">
              Soporte
            </p>
            <h2
              id="register-support-title"
              className="mt-3 text-3xl font-black leading-tight text-[#0f172a]"
            >
              {isHelp ? 'Ayuda básica' : 'Contacto'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#334155] transition hover:bg-[#eef2f8] hover:text-[#0f172a] active:scale-95"
            aria-label="Cerrar modal"
          >
            <X size={24} strokeWidth={2.4} />
          </button>
        </div>

        {isHelp ? (
          <HelpModalContent />
        ) : (
          <ContactModalContent />
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-7 min-h-[54px] w-full rounded-[12px] bg-[#2563eb] px-4 text-base font-black text-white shadow-[0_14px_28px_rgba(37,99,235,0.22)] transition-all hover:bg-[#1d4ed8] active:scale-[0.985]"
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
      icon: <Store size={25} />,
      title: 'Escribe el nombre del negocio',
      text: 'Usa el nombre exacto con el que lo usas diariamente.',
    },
    {
      number: '2',
      icon: <Menu size={27} />,
      title: 'Selecciona el tipo de negocio',
      text: 'Elige la opción que mejor describa tu operación cafetera.',
    },
    {
      number: '3',
      icon: <ArrowRight size={27} />,
      title: 'Pulsa Siguiente paso',
      text: 'Continuarás con los datos del administrador.',
    },
  ];

  return (
    <div>
      <div className="mb-6 flex items-start gap-4">
        <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#eef2ff] text-[#1d4ed8]">
          <CircleHelp size={28} fill="currentColor" className="text-[#1d4ed8]" />
        </span>
        <p className="pt-1 text-base font-medium leading-7 text-[#475569]">
          Sigue estos pasos para completar el registro de tu negocio.
        </p>
      </div>

      <div className="space-y-0">
        {steps.map((step, index) => (
          <div key={step.number}>
            <div className="grid grid-cols-[3.25rem_3.75rem_1fr] items-center gap-2 py-5">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#eef2ff] text-base font-black text-[#1d4ed8]">
                {step.number}
              </span>
              <span className="inline-flex h-11 w-11 items-center justify-center text-[#1d4ed8]">
                {step.icon}
              </span>
              <span>
                <span className="block text-sm font-black text-[#0f172a]">
                  {step.title}
                </span>
                <span className="mt-1 block text-sm font-medium leading-6 text-[#475569]">
                  {step.text}
                </span>
              </span>
            </div>
            {index < steps.length - 1 ? (
              <div className="ml-[4.3rem] h-px bg-[#e2e8f0]" />
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
      <div className="mb-7 flex items-start gap-4">
        <span className="inline-flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#eef2ff] text-[#1d4ed8]">
          <Headset size={34} />
        </span>
        <p className="pt-1 text-base font-medium leading-7 text-[#475569]">
          Si tienes problemas con el registro, puedes comunicarte con nuestro
          equipo de soporte.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {contactItems.map((item) => (
          <div
            key={item.title}
            className="flex min-h-[158px] min-w-0 flex-col items-center justify-start rounded-[12px] border border-[#e2e8f0] bg-white p-4 text-center shadow-sm"
          >
            <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#eef2ff] text-[#1d4ed8]">
              {item.icon}
            </span>
            <p className="text-sm font-black text-[#0f172a]">{item.title}</p>
            <p className="mt-2 max-w-full whitespace-pre-line break-words text-sm font-semibold leading-6 text-[#2563eb] [overflow-wrap:anywhere]">
              {item.text}
            </p>
          </div>
        ))}
      </div>

      <InfoNotice text="Te responderemos a la brevedad posible. Gracias por tu paciencia." />
    </div>
  );
}

function InfoNotice({ text }: { text: string }) {
  return (
    <div className="mt-6 flex items-center gap-3 rounded-[12px] bg-[#f1f5ff] px-4 py-4 text-sm font-medium leading-6 text-[#475569]">
      <Info size={24} className="shrink-0 text-[#1d4ed8]" />
      <span>{text}</span>
    </div>
  );
}
