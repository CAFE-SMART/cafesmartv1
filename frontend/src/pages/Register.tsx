import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CircleHelp,
  Eye,
  EyeOff,
  Headset,
  Info,
  Loader,
  Settings,
  Store,
  Users,
  X,
} from 'lucide-react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { RegisterProgress } from '../components/register/RegisterProgress';
import { useRegisterForm } from '../hooks/useRegisterForm';
import {
  ADMIN_LASTNAME_MAX_LENGTH,
  ADMIN_NAME_MAX_LENGTH,
  BUSINESS_NAME_MAX_LENGTH,
  CUSTOM_BUSINESS_TYPE_MAX_LENGTH,
  EMAIL_MAX_LENGTH,
  getPasswordChecks,
  getPasswordStrength,
  PASSWORD_MAX_LENGTH,
  REGISTER_PHONE_MAX_LENGTH,
  sanitizeAdminNameInput,
  sanitizeBusinessNameInput,
  sanitizeRegisterPhoneInput,
  type RegisterLocationState,
  type TipoOrg,
} from '../utils/registerValidators';
import { getGooglePrefillFromIdToken } from '../utils/googleProfile';

type BusinessType = {
  value: TipoOrg;
  label: string;
  desc: string;
  icon: React.ReactNode;
};

const businessTypes: BusinessType[] = [
  {
    value: 'COMPRAVENTA',
    label: 'COMPRAVENTA',
    desc: 'Compras cafe para revenderlo y obtener ganancias.',
    icon: <Store size={19} />,
  },
  {
    value: 'COOPERATIVA',
    label: 'COOPERATIVA',
    desc: 'Recibes cafe de productores y lo vendes por ellos.',
    icon: <Users size={19} />,
  },
  {
    value: 'PERSONALIZADO',
    label: 'PERSONALIZADO',
    desc: 'Otro tipo de negocio cafetero.',
    icon: <Settings size={19} />,
  },
];

const colorByType: Record<TipoOrg, string> = {
  COOPERATIVA: 'bg-[#eef4ff] text-[#2f5ec4]',
  COMPRAVENTA: 'bg-[#fff5d8] text-[#b58214]',
  PERSONALIZADO: 'bg-[#fff0f2] text-[#d24861]',
};

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
  const [passwordFocused, setPasswordFocused] = useState(false);
  const initialRouteState = useMemo(
    () => (location.state ?? null) as RegisterLocationState | null,
    [location.state],
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
    emailConflict,
    setEmailConflict,
  } = useRegisterForm({
    hasGoogleFlow,
    routeState: googleRouteState,
    navigate,
  });

  const progressPercent = step === 1 ? 50 : 100;
  const passwordChecks = getPasswordChecks(password);
  const passwordStrength = getPasswordStrength(password);
  const showPasswordRequirements = passwordFocused || password.length > 0;
  const hasStartedConfirming = confirmPassword.length > 0;
  const passwordsMatch = password.length > 0 && confirmPassword === password;

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
        {emailConflict ? (
          <EmailConflictView
            data={emailConflict}
            onBackToRegister={() => setEmailConflict(null)}
            onGoToLogin={goToLogin}
          />
        ) : step === 1 ? (
          <section
            className="flex min-h-screen flex-col"
            aria-labelledby="register-business-title"
          >
            <RegisterHeader
              title="Crear cuenta"
              onBack={handleHeaderBack}
              labelledBy="register-business-title"
            />

            <div className="flex-1 px-4 pt-5">
              <RegisterProgress
                step={step}
                totalSteps={2}
                progressPercent={progressPercent}
              />

              <h2 className="mt-2 text-[1.28rem] font-black leading-tight tracking-normal text-[#111827]">
                Comencemos configurando tu negocio
              </h2>

              {error ? <AlertBanner message={error} className="mt-4" /> : null}

              <div className="mt-6">
                <TextInput
                  id="register-business-name"
                  label="NOMBRE DEL NEGOCIO"
                  value={nombreOrganizacion}
                  onChange={(value) => {
                    setNombreOrganizacion(sanitizeBusinessNameInput(value));
                    setStepOneErrors((prev) => ({
                      ...prev,
                      nombreOrganizacion: undefined,
                    }));
                  }}
                  placeholder="Ej: Cafe Los Alpes"
                  autoComplete="organization"
                  maxLength={BUSINESS_NAME_MAX_LENGTH}
                  required
                  helpText="Solo letras, espacios y hasta 5 números."
                  error={stepOneErrors.nombreOrganizacion}
                />
                <p className="mt-1 text-right text-[0.62rem] font-semibold text-slate-400">
                  {nombreOrganizacion.length}/{BUSINESS_NAME_MAX_LENGTH}
                </p>
              </div>

              <div className="mt-6">
                <p className="mb-3 text-[10px] font-black uppercase tracking-[0.08em] text-[#1f2937]">
                  TIPO DE NEGOCIO <RequiredMark />
                </p>
                <div className="grid grid-cols-1 gap-3">
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
                    label="DESCRIPCION"
                    value={otroTipoDetalle}
                    onChange={(value) => {
                      setOtroTipoDetalle(
                        value.slice(0, CUSTOM_BUSINESS_TYPE_MAX_LENGTH),
                      );
                      setStepOneErrors((prev) => ({
                        ...prev,
                        otroTipoDetalle: undefined,
                      }));
                    }}
                    placeholder="Ej: Trilla, laboratorio o finca"
                    maxLength={CUSTOM_BUSINESS_TYPE_MAX_LENGTH}
                    required
                    helpText="Cuéntanos qué tipo de operación manejas."
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

            <div className="flex-1 px-4 pb-5 pt-5">
              <RegisterProgress
                step={step}
                totalSteps={2}
                progressPercent={progressPercent}
              />

              {error ? <AlertBanner message={error} className="mb-4" /> : null}

              <div className="mb-5 flex items-start gap-3 rounded-[12px] border border-[#d9e5fb] bg-[#f1f6ff] px-4 py-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1D4ED8] text-white">
                  <Info size={14} />
                </span>
                <p className="text-sm font-semibold leading-5 text-[#355070]">
                  Este usuario administrará el negocio, el inventario y los
                  reportes. Usa datos reales para recuperar el acceso si lo
                  necesitas.
                </p>
              </div>

              {hasGoogleFlow ? (
                <p className="mb-5 rounded-[12px] border border-[#d9e5fb] bg-[#f1f6ff] px-4 py-3 text-sm font-semibold text-[#355070]">
                  Google completó tus datos. Revísalos y termina el registro.
                </p>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <TextInput
                    id="register-admin-name"
                    label="Nombre"
                    value={nombre}
                    onChange={(value) => {
                      setNombre(
                        sanitizeAdminNameInput(value, ADMIN_NAME_MAX_LENGTH),
                      );
                      setStepTwoErrors((prev) => ({
                        ...prev,
                        nombre: undefined,
                      }));
                    }}
                    placeholder="Ej: Laura"
                    autoComplete="given-name"
                    maxLength={ADMIN_NAME_MAX_LENGTH}
                    required
                    helpText="Solo letras."
                    error={stepTwoErrors.nombre}
                    compactLabel
                  />

                  <TextInput
                    id="register-admin-lastname"
                    label="Apellidos"
                    value={apellidos}
                    onChange={(value) => {
                      setApellidos(
                        sanitizeAdminNameInput(
                          value,
                          ADMIN_LASTNAME_MAX_LENGTH,
                        ),
                      );
                      setStepTwoErrors((prev) => ({
                        ...prev,
                        apellidos: undefined,
                      }));
                    }}
                    placeholder="Ej: Perez Gomez"
                    autoComplete="family-name"
                    maxLength={ADMIN_LASTNAME_MAX_LENGTH}
                    required
                    helpText="Solo letras y espacios."
                    error={stepTwoErrors.apellidos}
                    compactLabel
                  />
                </div>

                <TextInput
                  id="register-admin-phone"
                  label="Teléfono"
                  value={telefono}
                  onChange={(value) => {
                    setTelefono(sanitizeRegisterPhoneInput(value));
                    setStepTwoErrors((prev) => ({
                      ...prev,
                      telefono: undefined,
                    }));
                  }}
                  placeholder="3001234567"
                  autoComplete="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={REGISTER_PHONE_MAX_LENGTH}
                  required
                  helpText="10 dígitos, debe empezar por 3."
                  error={stepTwoErrors.telefono}
                  compactLabel
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
                    maxLength={EMAIL_MAX_LENGTH}
                    required
                    helpText="Usaremos este correo para iniciar sesión."
                    error={stepTwoErrors.correo}
                    compactLabel
                  />
                  {isCheckingEmail && !stepTwoErrors.correo ? (
                    <p className="mt-2 text-xs font-semibold text-[#64748b]">
                      Validando correo...
                    </p>
                  ) : null}
                </div>

                {!hasGoogleFlow ? (
                  <>
                    <div>
                      <label
                        htmlFor="register-admin-password"
                        className="mb-2 block text-xs font-black text-[#344054]"
                      >
                        Contrase&ntilde;a <RequiredMark />
                      </label>
                      <div
                        className={`flex min-h-[50px] items-center rounded-[10px] border bg-white px-4 transition ${
                          stepTwoErrors.password
                            ? 'border-rose-300 bg-rose-50/50'
                            : 'border-[#dfe5f1] focus-within:border-[#1D4ED8] focus-within:ring-2 focus-within:ring-[#274ab8]/10'
                        }`}
                      >
                        <input
                          id="register-admin-password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(event) => {
                            setPassword(
                              event.target.value.slice(0, PASSWORD_MAX_LENGTH),
                            );
                            setStepTwoErrors((prev) => ({
                              ...prev,
                              password: undefined,
                            }));
                          }}
                          onFocus={() => setPasswordFocused(true)}
                          onBlur={() => setPasswordFocused(false)}
                          placeholder="********"
                          autoComplete="new-password"
                          className="min-w-0 flex-1 bg-transparent py-3 text-sm font-semibold text-slate-900 outline-none placeholder:text-[#a8b4c5]"
                          required
                          minLength={6}
                          maxLength={PASSWORD_MAX_LENGTH}
                        />
                        <button
                          type="button"
                          className="ml-3 shrink-0 text-[#9aa8bc] transition-colors hover:text-[#536178]"
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
                        <FieldError message={stepTwoErrors.password} />
                      ) : null}
                      {!stepTwoErrors.password && showPasswordRequirements ? (
                        <PasswordRequirements
                          checks={passwordChecks}
                          score={passwordStrength.score}
                        />
                      ) : null}
                      {!stepTwoErrors.password && !showPasswordRequirements ? (
                        <p className="mt-1.5 text-[0.68rem] font-semibold leading-4 text-[#73829a]">
                          Mínimo 6 caracteres con mayúscula, minúscula y número.
                        </p>
                      ) : null}
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
                      maxLength={PASSWORD_MAX_LENGTH}
                      required
                      helpText="Debe ser igual a la contraseña anterior."
                      error={stepTwoErrors.confirmPassword}
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
                  </>
                ) : null}

                <button
                  type="submit"
                  className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-[#1D4ED8] px-4 text-sm font-black text-white shadow-[0_14px_26px_rgba(40,75,193,0.18)] transition hover:bg-[#1e40af]"
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
                          className="mx-auto animate-spin text-[#1D4ED8]"
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
    <header className="border-b border-[#e6ebf3] bg-[#f7f8fb] px-4 py-4">
      <div className="relative flex min-h-[36px] items-center justify-center">
        <button
          type="button"
          onClick={onBack}
          className="absolute left-0 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition hover:bg-[#eef2f8]"
          aria-label="Volver"
        >
          <ArrowLeft size={22} />
        </button>
        <h1
          id={labelledBy}
          className="text-center text-[1.35rem] font-semibold text-slate-900"
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
      className={`w-full rounded-[13px] border px-4 py-4 text-left transition ${
        selected
          ? 'border-[#1D4ED8] bg-[#f6f8ff] shadow-[0_0_0_1px_rgba(39,74,184,0.10)]'
          : 'border-[#dfe5f1] bg-white hover:border-[#cbd6e8]'
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] ${
            colorByType[type.value]
          }`}
        >
          {type.icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-black text-[#111827]">
            {type.label}
          </span>
          <span className="mt-1 block text-[11px] font-medium leading-4 text-[#73829a]">
            {type.desc}
          </span>
        </span>
        <span
          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
            selected
              ? 'border-[#1D4ED8] bg-[#1D4ED8] text-white'
              : 'border-[#c8d2e2] text-transparent'
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
  inputMode,
  pattern,
  error,
  compactLabel = false,
  maxLength,
  required = false,
  helpText,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void | Promise<void>;
  placeholder: string;
  type?: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  pattern?: string;
  error?: string;
  compactLabel?: boolean;
  maxLength?: number;
  required?: boolean;
  helpText?: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className={`mb-2 block font-black text-[#344054] ${
          compactLabel ? 'text-xs' : 'text-[10px] uppercase tracking-[0.08em]'
        }`}
      >
        {label} {required ? <RequiredMark /> : null}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => void onBlur?.()}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        pattern={pattern}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        className={`block min-h-[50px] w-full rounded-[10px] border px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-[#a8b4c5] ${
          error
            ? 'border-rose-300 bg-rose-50/50'
            : 'border-[#dfe5f1] bg-white focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#274ab8]/10'
        }`}
      />
      {error ? <FieldError message={error} /> : null}
      {!error && helpText ? (
        <p className="mt-1.5 text-[0.68rem] font-semibold leading-4 text-[#73829a]">
          {helpText}
        </p>
      ) : null}
    </div>
  );
}

function RequiredMark() {
  return (
    <span className="text-rose-500" aria-label="obligatorio">
      *
    </span>
  );
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
    <footer className="mt-8 border-t border-[#e6ebf3] bg-[#f7f8fb] px-4 py-4">
      <button
        type="button"
        onClick={onPrimary}
        className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#1D4ED8] px-4 text-sm font-black text-white shadow-[0_14px_26px_rgba(40,75,193,0.18)] transition hover:bg-[#1e40af]"
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
    <div className="pt-5 text-center">
      <p className="text-xs font-semibold text-[#73829a]">
        ¿Necesitas ayuda?
      </p>
      <div className="mt-2.5 flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={onHelp}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#536178] transition hover:text-[#1D4ED8]"
        >
          <CircleHelp size={14} />
          Ver ayuda
        </button>
        <button
          type="button"
          onClick={onContact}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#536178] transition hover:text-[#1D4ED8]"
        >
          <Headset size={14} />
          Contactar soporte
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

function FieldError({ message }: { message: string }) {
  return <p className="mt-2 text-xs font-semibold text-rose-600">{message}</p>;
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
      className={`rounded-[12px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 ${className}`.trim()}
    >
      {message}
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
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-support-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-[400px] overflow-y-auto rounded-[24px] border border-[#e6ebf3] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.24)]"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#1D4ED8]">
              Soporte Café Smart
            </p>
            <h2
              id="register-support-title"
              className="mt-1 text-lg font-black text-[#111827]"
            >
              {type === 'help' ? 'Guía de registro' : 'Soporte técnico'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#64748b] transition hover:bg-[#f1f5f9] hover:text-[#111827]"
            aria-label="Cerrar modal"
          >
            <X size={16} />
          </button>
        </div>

        {type === 'help' ? (
          <div className="space-y-3.5 text-xs leading-5 text-[#536178]">
            <p>
              <strong>• Nombre de tu negocio:</strong> Escribe el nombre comercial con el que te conocen. Puedes usar letras, espacios y hasta 5 números.
            </p>
            <p>
              <strong>• Datos personales:</strong> Ingresa tu nombre y apellidos sin números. Tu teléfono debe ser de 10 dígitos y empezar por 3 (ej: 3150518018).
            </p>
            <p>
              <strong>• Tu clave:</strong> Elige una contraseña segura que combine letras mayúsculas, minúsculas y números para mantener tu cuenta protegida.
            </p>
          </div>
        ) : (
          <div className="space-y-4 text-xs leading-5 text-[#536178] text-center">
            <p className="text-slate-600">
              ¿Tienes algún problema o duda para registrarte? Escríbenos directamente por WhatsApp y te ayudaremos de inmediato.
            </p>
            <div className="flex flex-col items-center justify-center p-4 bg-[#f8fafc] rounded-[16px] border border-slate-100">
              <Headset className="text-[#1D4ED8] mb-2" size={24} />
              <p className="text-[0.68rem] text-slate-500 max-w-[280px]">
                Horario de atención: Lunes a Sábado - 8:00 AM a 6:00 PM
              </p>
              <a
                href="https://wa.me/573150518018"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3.5 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-xs font-bold text-white shadow-sm hover:bg-[#128C7E] transition active:scale-[0.98]"
              >
                Escribir al +57 315 051 80 18
              </a>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-6 min-h-[46px] w-full rounded-full bg-[#1D4ED8] px-4 text-sm font-black text-white transition hover:bg-[#1e40af]"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

function PasswordRequirements({
  checks,
  score,
}: {
  checks: ReturnType<typeof getPasswordChecks>;
  score: number;
}) {
  const requirements = [
    { label: '6 caracteres', done: checks.minLength },
    { label: 'Una minúscula', done: checks.hasLower },
    { label: 'Una mayúscula', done: checks.hasUpper },
    { label: 'Un número', done: checks.hasNumber },
  ];

  return (
    <div className="mt-2">
      <div className="h-1 overflow-hidden rounded-full bg-[#e7edf6]">
        <div
          className={`h-full rounded-full transition-all ${
            score <= 1
              ? 'bg-rose-400'
              : score === 2
                ? 'bg-amber-400'
                : score === 3
                  ? 'bg-sky-400'
                  : 'bg-emerald-500'
          }`}
          style={{ width: `${(score / 4) * 100}%` }}
        />
      </div>
      <ul className="mt-2 space-y-1 pl-1" aria-label="Requisitos de contraseña">
        {requirements.map((item) => (
          <li
            key={item.label}
            className={`flex items-center gap-2 text-[11px] font-semibold leading-4 transition-colors ${
              item.done ? 'text-emerald-600' : 'text-[#7c899c]'
            }`}
          >
            <span
              className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                item.done
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                  : 'border-[#cbd5e1] text-transparent'
              }`}
              aria-hidden="true"
            >
              <Check size={10} strokeWidth={3} />
            </span>
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

interface EmailConflictViewProps {
  data: {
    correo: string;
    nombreOrganizacion: string;
    tipoOrganizacion: 'COOPERATIVA' | 'COMPRAVENTA' | 'OTRO';
    otroTipoDetalle?: string;
  };
  onBackToRegister: () => void;
  onGoToLogin: () => void;
}

function EmailConflictView({ data, onBackToRegister, onGoToLogin }: EmailConflictViewProps) {
  const tipoOrganizacionTexto = useMemo(() => {
    if (data.tipoOrganizacion === 'COMPRAVENTA') return 'Compraventa';
    if (data.tipoOrganizacion === 'COOPERATIVA') return 'Cooperativa';
    return data.otroTipoDetalle || 'Otro negocio';
  }, [data]);

  return (
    <section className="flex min-h-screen flex-col px-5 pt-8 justify-between pb-8">
      <div className="space-y-6 pt-10 text-center animate-fadeIn">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-50 text-rose-500 shadow-sm">
          <AlertTriangle size={32} />
        </div>

        <div className="space-y-2">
          <h2 className="text-[1.38rem] font-black text-slate-900">
            Correo ya registrado
          </h2>
          <p className="text-sm font-medium text-slate-500">
            Esta cuenta ya tiene un negocio configurado.
          </p>
        </div>

        <div className="rounded-[22px] border border-[#e2e8f0] bg-white p-5 text-left shadow-[0_12px_32px_rgba(15,23,42,0.04)]">
          <div className="space-y-4">
            <p className="text-sm font-semibold leading-6 text-slate-700">
              La cuenta para el negocio <span className="font-extrabold text-slate-900">"{data.nombreOrganizacion}" ({tipoOrganizacionTexto})</span> ya ha sido creada anteriormente con el correo electrónico <span className="font-extrabold text-slate-900">{data.correo}</span>.
            </p>
            
            <div className="h-px bg-slate-100" />
            
            <div className="space-y-2 text-xs font-semibold text-slate-500 leading-5">
              <p>
                • Si eres el administrador o colaborador de este negocio, puedes iniciar sesión directamente con tus credenciales.
              </p>
              <p>
                • Si quieres registrar un negocio u organización diferente, debes usar un correo electrónico distinto.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-6 w-full">
        <button
          type="button"
          onClick={onGoToLogin}
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-[#1D4ED8] px-4 text-sm font-black text-white shadow-[0_14px_26px_rgba(40,75,193,0.18)] transition hover:bg-[#1e40af]"
        >
          Iniciar sesión
        </button>

        <button
          type="button"
          onClick={onBackToRegister}
          className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-black text-slate-600 transition hover:bg-[#f8fafc]"
        >
          Volver a registrar con otro correo
        </button>
      </div>
    </section>
  );
}
