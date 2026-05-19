import {
  getPasswordChecks,
  getPasswordStrength,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from './registerValidators';

export const PASSWORD_MISMATCH_MESSAGE =
  '⚠️ Las contraseñas ingresadas no coinciden.';

export function validatePasswordRules(password: string) {
  const checks = getPasswordChecks(password);

  if (!password.trim()) {
    return 'Ingresa una nueva contraseña.';
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return 'La contraseña es demasiado larga. Usa máximo 32 caracteres.';
  }

  if (
    !checks.minLength ||
    !checks.maxLength ||
    !checks.hasUpper ||
    !checks.hasLower ||
    !checks.hasNumber
  ) {
    return `La contraseña debe tener ${PASSWORD_MIN_LENGTH} a ${PASSWORD_MAX_LENGTH} caracteres, una mayúscula, una minúscula y un número.`;
  }

  return null;
}

export function validatePasswordConfirmation(
  password: string,
  confirmPassword: string,
) {
  if (!confirmPassword.trim()) {
    return 'Confirma nuevamente tu contraseña.';
  }

  if (password !== confirmPassword) {
    return PASSWORD_MISMATCH_MESSAGE;
  }

  return null;
}

export function isPasswordPolicyValid(password: string) {
  return validatePasswordRules(password) === null;
}

export function getPasswordValidationState(password: string) {
  const checks = getPasswordChecks(password);
  const strength = getPasswordStrength(password);
  const label =
    password.length === 0
      ? 'Sin evaluar'
      : strength.score <= 3
        ? 'Débil'
        : strength.score === 4
          ? 'Media'
          : 'Fuerte';

  return {
    checks,
    strength: {
      score: strength.score,
      label,
    },
    requirements: [
      {
        active: checks.minLength && checks.maxLength,
        label: `${PASSWORD_MIN_LENGTH} a ${PASSWORD_MAX_LENGTH} caracteres`,
      },
      { active: checks.hasUpper, label: 'Una mayúscula' },
      { active: checks.hasLower, label: 'Una minúscula' },
      { active: checks.hasNumber, label: 'Un número' },
    ],
  };
}
