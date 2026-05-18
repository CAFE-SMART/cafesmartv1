import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
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
  BUSINESS_NAME_MAX_LENGTH,
  getPasswordChecks,
  getPasswordStrength,
  sanitizeBusinessNameInput,
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
                  error={stepOneErrors.nombreOrganizacion}
                />
                <p className="mt-1 text-right text-[0.62rem] font-semibold text-slate-400">
                  {nombreOrganizacion.length}/{BUSINESS_NAME_MAX_LENGTH}
                </p>
              </div>

              <div className="mt-6">
                <p className="mb-3 text-[10px] font-black uppercase tracking-[0.08em] text-[#1f2937]">
                  TIPO DE NEGOCIO
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

            <div className="flex-1 px-4 pb-5 pt-5">
              <RegisterProgress
                step={step}
                totalSteps={2}
                progressPercent={progressPercent}
              />

              {error ? <AlertBanner message={error} className="mb-4" /> : null}

              <div className="mb-5 flex items-start gap-3 rounded-[12px] border border-[#d9e5fb] bg-[#f1f6ff] px-4 py-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#274ab8] text-white">
                  <Info size={14} />
                </span>
                <p className="text-sm font-semibold leading-5 text-[#355070]">
                  Este usuario será el administrador del sistema.
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
                      setNombre(value);
                      setStepTwoErrors((prev) => ({
                        ...prev,
                        nombre: undefined,
                      }));
                    }}
                    placeholder="Ej: Juan"
                    autoComplete="given-name"
                    error={stepTwoErrors.nombre}
                    compactLabel
                  />

                  <TextInput
                    id="register-admin-lastname"
                    label="Apellidos"
                    value={apellidos}
                    onChange={(value) => {
                      setApellidos(value);
                      setStepTwoErrors((prev) => ({
                        ...prev,
                        apellidos: undefined,
                      }));
                    }}
                    placeholder="Ej: Perez Gomez"
                    autoComplete="family-name"
                    error={stepTwoErrors.apellidos}
                    compactLabel
                  />
                </div>

                  <TextInput
                    id="register-admin-phone"
                    label="Teléfono"
                  value={telefono}
                  onChange={(value) => {
                    setTelefono(value);
                    setStepTwoErrors((prev) => ({
                      ...prev,
                      telefono: undefined,
                    }));
                  }}
                  placeholder="+57 300 123 4567"
                  autoComplete="tel"
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
                    error={stepTwoErrors.correo}
                    compactLabel
                  />
                  {isCheckingEmail && !stepTwoErrors.correo ? (
                    <p className="mt-2 text-xs font-semibold text-[#64748b]">
                      Validando correo...
                    </p>
                  ) : null}
                </div>

                <div>
                  <label
                    htmlFor="register-admin-password"
                    className="mb-2 block text-xs font-black text-[#344054]"
                  >
                    Contrase&ntilde;a
                  </label>
                  <div
                    className={`flex min-h-[50px] items-center rounded-[10px] border bg-white px-4 transition ${
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
                        setPassword(event.target.value);
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
                  {showPasswordRequirements ? (
                    <PasswordRequirements
                      checks={passwordChecks}
                      score={passwordStrength.score}
                    />
                  ) : null}
                </div>

                <TextInput
                  id="register-admin-password-confirm"
                  label="Confirma tu contraseña"
                  value={confirmPassword}
                  onChange={(value) => {
                    setConfirmPassword(value);
                    setStepTwoErrors((prev) => ({
                      ...prev,
                      confirmPassword: undefined,
                    }));
                  }}
                  placeholder="Vuelve a escribir tu contraseña"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
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

                <button
                  type="submit"
                  className="inline-flex min-h-[48px] w-full items-center justify-center rounded-full bg-[#284bc1] px-4 text-sm font-black text-white shadow-[0_14px_26px_rgba(40,75,193,0.18)] transition hover:bg-[#203fa8]"
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
      className={`w-full rounded-[13px] border px-4 py-4 text-left transition ${
        selected
          ? 'border-[#274ab8] bg-[#f6f8ff] shadow-[0_0_0_1px_rgba(39,74,184,0.10)]'
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
              ? 'border-[#274ab8] bg-[#274ab8] text-white'
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
  error,
  compactLabel = false,
  maxLength,
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
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className={`mb-2 block font-black text-[#344054] ${
          compactLabel ? 'text-xs' : 'text-[10px] uppercase tracking-[0.08em]'
        }`}
      >
        {label}
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
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        className={`block min-h-[50px] w-full rounded-[10px] border px-4 text-sm font-semibold text-slate-900 outline-none transition placeholder:text-[#a8b4c5] ${
          error
            ? 'border-rose-300 bg-rose-50/50'
            : 'border-[#dfe5f1] bg-white focus:border-[#274ab8] focus:ring-2 focus:ring-[#274ab8]/10'
        }`}
      />
      {error ? <FieldError message={error} /> : null}
    </div>
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
        className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#284bc1] px-4 text-sm font-black text-white shadow-[0_14px_26px_rgba(40,75,193,0.18)] transition hover:bg-[#203fa8]"
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
      <p className="text-[11px] font-medium text-[#73829a]">
        &iquest;Necesitas ayuda con el registro?
      </p>
      <div className="mt-2 flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={onHelp}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#536178] transition hover:text-[#274ab8]"
        >
          <CircleHelp size={13} />
          Ayuda
        </button>
        <button
          type="button"
          onClick={onContact}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#536178] transition hover:text-[#274ab8]"
        >
          <Headset size={13} />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-support-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-[430px] overflow-y-auto rounded-[14px] border border-[#e6ebf3] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.24)]"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#274ab8]">
              Soporte
            </p>
            <h2
              id="register-support-title"
              className="mt-1 text-lg font-black text-[#111827]"
            >
              {type === 'help' ? 'Ayuda básica' : 'Contacto'}
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
          <div className="space-y-2 text-sm leading-6 text-[#536178]">
            <p>1. Escribe el nombre real del negocio.</p>
            <p>2. Elige el tipo de operación cafetera.</p>
            <p>3. Pulsa Siguiente paso.</p>
          </div>
        ) : (
          <div className="space-y-2 text-sm leading-6 text-[#536178]">
            <p>Correo: soporte@cafesmart.com</p>
            <p>Teléfono: +57 300 000 0000</p>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-5 min-h-[44px] w-full rounded-full bg-[#284bc1] px-4 text-sm font-black text-white transition hover:bg-[#203fa8]"
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
      <ul
        className="mt-2 space-y-1 pl-1"
        aria-label="Requisitos de contraseña"
      >
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
