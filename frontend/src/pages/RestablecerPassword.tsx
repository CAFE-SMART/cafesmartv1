import React, { FormEvent, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Lock,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppFeedbackMessage } from '../components/AppFeedbackMessage';
import { CafeSmartErrorState } from '../components/CafeSmartErrorState';
import { CafeSmartLogo } from '../components/CafeSmartLogo';
import { authService, type AuthError } from '../services/authService';
import {
  getPasswordValidationState,
  validatePasswordConfirmation,
  validatePasswordRules,
} from '../utils/passwordValidation';
import { PASSWORD_MAX_LENGTH } from '../utils/registerValidators';

type TouchedFields = {
  password: boolean;
  confirmPassword: boolean;
};

function ResetDecorations() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_5%,rgba(47,99,216,0.12),transparent_30%),linear-gradient(180deg,#ffffff_0%,#f8fbff_58%,#edf5ff_100%)]" />
      <div className="absolute -left-16 bottom-0 h-44 w-44 rounded-full bg-[#dbeafe]/80 blur-2xl" />
      <div className="absolute -right-12 top-20 h-36 w-36 rounded-full bg-[#bfdbfe]/60 blur-2xl" />
      <svg
        className="absolute inset-x-0 bottom-0 h-32 w-full text-[#bfdbfe]/70"
        viewBox="0 0 430 140"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 62C62 33 112 43 164 73C222 106 268 69 322 58C366 49 398 67 430 86V140H0V62Z"
          fill="currentColor"
        />
        <path
          d="M0 96C58 70 119 82 176 105C231 128 279 103 332 92C374 83 402 98 430 112V140H0V96Z"
          fill="#dbeafe"
          opacity="0.68"
        />
      </svg>
      <div className="absolute bottom-4 left-5 h-24 w-16 rounded-t-full border-l-4 border-[#93c5fd]/70 opacity-60" />
      <div className="absolute bottom-4 right-8 h-28 w-20 rounded-t-full border-r-4 border-[#60a5fa]/55 opacity-60" />
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  placeholder,
  visible,
  error,
  onBlur,
  onChange,
  onToggleVisibility,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  visible: boolean;
  error: string | null;
  onBlur: () => void;
  onChange: (value: string) => void;
  onToggleVisibility: () => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-xs font-black text-[#344054]">
        {label}
      </label>
      <div
        className={`flex h-[54px] items-center rounded-[14px] border bg-white px-4 shadow-[0_8px_20px_rgba(15,23,42,0.045)] transition ${
          error
            ? 'border-rose-300 bg-rose-50/60'
            : 'border-[#dfe5f1] focus-within:border-[#274ab8] focus-within:ring-2 focus-within:ring-[#274ab8]/10'
        }`}
      >
        <Lock size={18} className="mr-3 shrink-0 text-[#8aa0bd]" aria-hidden="true" />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onBlur={onBlur}
          onChange={(event) =>
            onChange(event.target.value.slice(0, PASSWORD_MAX_LENGTH))
          }
          maxLength={PASSWORD_MAX_LENGTH}
          placeholder={placeholder}
          autoComplete="new-password"
          {...(error
            ? ({ 'aria-invalid': 'true' } as const)
            : ({ 'aria-invalid': 'false' } as const))}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-full min-w-0 flex-1 border-0 bg-transparent py-0 text-sm font-semibold text-slate-900 outline-none placeholder:text-[#a8b4c5]"
        />
        <button
          type="button"
          onClick={onToggleVisibility}
          className="ml-3 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#9aa8bc] transition-colors hover:bg-[#f4f6fb] hover:text-[#536178] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#274ab8]/15"
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      {error ? (
        <AppFeedbackMessage
          id={`${id}-error`}
          variant="error"
          description={error}
          className="mt-2"
        />
      ) : null}
    </div>
  );
}

function PasswordRequirementCard({ password }: { password: string }) {
  const validation = getPasswordValidationState(password);
  const score = validation.strength.score;
  const tone =
    score <= 3 ? 'text-amber-600' : score === 4 ? 'text-sky-600' : 'text-emerald-600';
  const widthClass =
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
              : 'w-full';
  const barClass =
    score <= 2
      ? 'bg-slate-300'
      : score === 3
        ? 'bg-amber-500'
        : score === 4
          ? 'bg-sky-500'
          : 'bg-emerald-500';

  return (
    <div className="mt-3 rounded-[15px] border border-[#e8edf6] bg-white/90 px-3.5 py-3 shadow-[0_8px_18px_rgba(15,23,42,0.035)]">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-xs font-black text-[#344054]">
          Seguridad:
          <span className={`ml-1 ${tone}`}>{validation.strength.label}</span>
        </p>
        <span className="shrink-0 text-xs font-black text-slate-500">
          {password.length}/{PASSWORD_MAX_LENGTH}
        </span>
      </div>
      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#e6ebf3]"
        aria-hidden="true"
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${barClass} ${widthClass}`}
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
        {validation.requirements.map((requirement) => (
          <span
            key={requirement.label}
            className={`inline-flex min-w-0 items-center gap-1.5 text-[11px] font-bold leading-4 transition ${
              requirement.active ? 'text-[#047857]' : 'text-[#7b8798]'
            }`}
          >
            <span
              className={`inline-flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-full border ${
                requirement.active
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : 'border-[#cbd5e1] bg-white text-transparent'
              }`}
              aria-hidden="true"
            >
              <Check size={9} strokeWidth={3} />
            </span>
            <span className="min-w-0 truncate">{requirement.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function RestablecerPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token')?.trim() ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<TouchedFields>({
    password: false,
    confirmPassword: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const passwordError = useMemo(
    () => validatePasswordRules(password),
    [password],
  );
  const confirmPasswordError = useMemo(
    () => validatePasswordConfirmation(password, confirmPassword),
    [password, confirmPassword],
  );
  const isFormInvalid = Boolean(
    !token || passwordError || confirmPasswordError || isSubmitting,
  );

  const goToLogin = () => navigate('/login', { replace: true });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched({ password: true, confirmPassword: true });
    setSubmitError(null);

    if (isFormInvalid) {
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.resetPassword(token, password);
      setPassword('');
      setConfirmPassword('');
      setSuccess(true);
    } catch (error) {
      const authError = error as Partial<AuthError>;
      const message =
        authError.message ||
        'No pudimos actualizar la contraseña. Intenta solicitar un nuevo enlace.';

      if (authError.field === 'token' || authError.status === 400) {
        setFatalError('El enlace expiró o ya no es válido.');
        return;
      }

      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <CafeSmartErrorState
        fullScreen
        variant="success"
        title="Contraseña actualizada"
        message="¡Contraseña actualizada con éxito! Ya puedes iniciar sesión con tus nuevas credenciales."
        info="Tu cuenta quedó protegida con la nueva clave de acceso."
        primaryLabel="Ir a iniciar sesión"
        onPrimary={goToLogin}
      />
    );
  }

  if (!token || fatalError) {
    return (
      <CafeSmartErrorState
        fullScreen
        title="Enlace no válido"
        message={
          fatalError ?? 'El enlace de recuperación no es válido o está incompleto.'
        }
        info="Solicita un nuevo enlace de recuperación desde la pantalla de inicio de sesión."
        primaryLabel="Ir a iniciar sesión"
        onPrimary={goToLogin}
      />
    );
  }

  if (submitError) {
    return (
      <CafeSmartErrorState
        fullScreen
        title="No pudimos actualizarla"
        message={submitError}
        info="Puedes intentar nuevamente sin solicitar otro enlace si este sigue vigente."
        primaryLabel="Intentar nuevamente"
        secondaryLabel="Ir a iniciar sesión"
        onPrimary={() => setSubmitError(null)}
        onSecondary={goToLogin}
      />
    );
  }

  return (
    <main className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden px-5 py-7 text-[#07153b]">
      <ResetDecorations />
      <section className="relative z-10 w-full max-w-[430px] rounded-[28px] border border-[#e6eefb] bg-[#f8fbff]/95 px-5 py-6 shadow-[0_24px_70px_rgba(15,23,42,0.12)] backdrop-blur sm:px-7 sm:py-8">
        <button
          type="button"
          onClick={goToLogin}
          className="mb-5 inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-black text-[#1d4ed8] transition hover:bg-[#eef6ff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#1d4ed8]/15"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Volver al inicio
        </button>

        <div className="mb-7 flex justify-center">
          <CafeSmartLogo size="md" compact />
        </div>

        <div className="text-center">
          <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[24px] bg-[#eaf2ff] text-[#1d4ed8] shadow-[0_18px_38px_rgba(29,78,216,0.16)] ring-1 ring-[#bfdbfe]">
            <div className="absolute inset-[-10px] rounded-full bg-[#bfdbfe]/45 blur-xl" />
            <span className="relative">
            <Lock size={27} strokeWidth={2.4} aria-hidden="true" />
            </span>
          </div>
          <h1 className="text-[1.65rem] font-black leading-tight text-[#07153b]">
            Crear nueva contraseña
          </h1>
          <p className="mx-auto mt-3 max-w-[330px] text-sm font-semibold leading-6 text-slate-500">
            Ingresa tu nueva clave de acceso para actualizar las credenciales de
            tu cuenta.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4" noValidate>
          <PasswordField
            id="reset-password-new"
            label="Nueva contraseña"
            value={password}
            placeholder="Escribe tu nueva contraseña"
            visible={showPassword}
            error={touched.password ? passwordError : null}
            onBlur={() =>
              setTouched((current) => ({ ...current, password: true }))
            }
            onChange={(value) => {
              setPassword(value);
              setSubmitError(null);
            }}
            onToggleVisibility={() => setShowPassword((value) => !value)}
          />
          <PasswordRequirementCard password={password} />

          <PasswordField
            id="reset-password-confirm"
            label="Confirmar nueva contraseña"
            value={confirmPassword}
            placeholder="Vuelve a escribirla"
            visible={showPassword}
            error={touched.confirmPassword ? confirmPasswordError : null}
            onBlur={() =>
              setTouched((current) => ({ ...current, confirmPassword: true }))
            }
            onChange={(value) => {
              setConfirmPassword(value);
              setSubmitError(null);
            }}
            onToggleVisibility={() => setShowPassword((value) => !value)}
          />

          <button
            type="submit"
            disabled={isFormInvalid}
            className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[#102d92] px-4 text-sm font-black text-white shadow-[0_16px_30px_rgba(16,45,146,0.24)] transition-all duration-200 hover:bg-[#18358f] hover:shadow-[0_18px_34px_rgba(16,45,146,0.28)] active:scale-[0.985] disabled:cursor-not-allowed disabled:bg-[#9fb2d9] disabled:shadow-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#284bc1]/20"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                Actualizando...
              </>
            ) : (
              <>
                Actualizar contraseña
                <ArrowRight size={18} aria-hidden="true" />
              </>
            )}
          </button>
        </form>
      </section>
    </main>
  );
}
