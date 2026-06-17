import { useEffect, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { authService } from '../services/authService';
import {
  EMAIL_REGEX,
  PASSWORD_MAX_LENGTH,
  getPasswordChecks,
  hasAtLeastOneSurname,
  isValidPhone,
  normalizeBusinessNameInput,
  normalizeBusinessDescriptionInput,
  validatePersonLastName,
  validatePersonName,
  type RegisterLocationState,
  type StepOneErrors,
  type StepTwoErrors,
  type TipoOrg,
  type TipoOrgSelection,
  validateBusinessName,
  validateBusinessDescription,
} from '../utils/registerValidators';
import { getPhoneDigits } from '../utils/formatPhone';
import { normalizePossiblyMojibake } from '../utils/jwt';

type UseRegisterFormParams = {
  hasGoogleFlow: boolean;
  routeState: RegisterLocationState;
  navigate: NavigateFunction;
};

function scrollToFirstInvalidField(fieldIds: string[]) {
  if (typeof window === 'undefined') return;

  window.setTimeout(() => {
    const target = fieldIds
      .map((id) => document.getElementById(id))
      .find((element): element is HTMLElement => Boolean(element));

    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLButtonElement
    ) {
      target.focus({ preventScroll: true });
    }
  }, 60);
}

export function useRegisterForm({
  hasGoogleFlow,
  routeState,
  navigate,
}: UseRegisterFormParams) {
  const draft = routeState.registerDraft;
  const [step, setStep] = useState(() => draft?.currentStep ?? 1);

  const [nombreOrganizacion, setNombreOrganizacion] = useState(
    () => draft?.nombreOrganizacion ?? '',
  );
  const [descripcionOrganizacion, setDescripcionOrganizacion] = useState(
    () => draft?.descripcionOrganizacion ?? '',
  );
  const [tipoOrganizacion, setTipoOrganizacion] =
    useState<TipoOrgSelection>(() => draft?.tipoOrganizacion ?? '');
  const [otroTipoDetalle, setOtroTipoDetalle] = useState(
    () => draft?.otroTipoDetalle ?? '',
  );
  const [stepOneErrors, setStepOneErrors] = useState<StepOneErrors>({});

  const [nombre, setNombre] = useState(
    normalizePossiblyMojibake(
      routeState.googlePrefill?.nombre || draft?.nombre || '',
    ),
  );
  const [apellidos, setApellidos] = useState(
    normalizePossiblyMojibake(
      routeState.googlePrefill?.apellidos || draft?.apellidos || '',
    ),
  );
  const [telefono, setTelefono] = useState(() => draft?.telefono ?? '');
  const [correo, setCorreo] = useState(
    normalizePossiblyMojibake(
      routeState.googlePrefill?.correo || draft?.correo || '',
    ),
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [stepTwoErrors, setStepTwoErrors] = useState<StepTwoErrors>({});
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasGoogleFlow && routeState.googlePrefill) {
      const nombreGoogle = normalizePossiblyMojibake(
        routeState.googlePrefill.nombre?.trim(),
      );
      const apellidosGoogle = normalizePossiblyMojibake(
        routeState.googlePrefill.apellidos?.trim(),
      );
      const correoGoogle = normalizePossiblyMojibake(
        routeState.googlePrefill.correo?.trim(),
      ).toLowerCase();

      if (nombreGoogle) {
        setNombre(nombreGoogle);
      }

      if (apellidosGoogle) {
        setApellidos(apellidosGoogle);
      }

      if (correoGoogle) {
        setCorreo(correoGoogle);
      }

      setStepTwoErrors((prev) => ({
        ...prev,
        nombre: undefined,
        apellidos: undefined,
        correo: undefined,
      }));
      setError(null);
    }
  }, [hasGoogleFlow, routeState.googlePrefill]);

  const validateEmailAvailability = async (correoValue: string) => {
    if (!EMAIL_REGEX.test(correoValue.trim())) {
      return null;
    }

    setIsCheckingEmail(true);
    try {
      const exists = await authService.checkEmailExists(
        correoValue.trim().toLowerCase(),
      );
      return exists ? 'Este correo ya esta registrado.' : null;
    } catch {
      return null;
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const goToStep2 = () => {
    setError(null);
    console.log('[CafeSmart][register-step1] validando');
    const nextErrors: StepOneErrors = {};
    const businessNameError = validateBusinessName(nombreOrganizacion);
    const businessDescriptionError = validateBusinessDescription(
      descripcionOrganizacion,
    );

    if (businessNameError) {
      nextErrors.nombreOrganizacion = businessNameError;
    }

    if (businessDescriptionError) {
      nextErrors.descripcionOrganizacion = businessDescriptionError;
    }

    if (!tipoOrganizacion) {
      nextErrors.tipoOrganizacion =
        'Selecciona el tipo de negocio que mejor describe tu operación.';
    }

    if (Object.keys(nextErrors).length > 0) {
      console.log(
        '[CafeSmart][register-step1] errores:',
        JSON.stringify(nextErrors, null, 2),
      );
      setStepOneErrors(nextErrors);
      setError('Revisa los campos resaltados.');
      scrollToFirstInvalidField([
        nextErrors.nombreOrganizacion ? 'register-business-name' : '',
        nextErrors.tipoOrganizacion ? 'register-business-type-group' : '',
        nextErrors.descripcionOrganizacion ? 'register-business-description' : '',
      ]);
      return;
    }

    console.log(
      '[CafeSmart][register-step1] datos validos:',
      JSON.stringify(
        {
          nombreOrganizacion:
            normalizeBusinessNameInput(nombreOrganizacion).trim(),
          tipoOrganizacion,
          descripcionOrganizacion:
            normalizeBusinessDescriptionInput(descripcionOrganizacion).trim() ||
            null,
        },
        null,
        2,
      ),
    );
    console.log('[CafeSmart][register-step1] avanzando a paso 2');
    setStepOneErrors({});
    setStep(2);
  };

  const goBackToStep1 = () => {
    setError(null);
    setStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const nextErrors: StepTwoErrors = {};
    const businessNameError = validateBusinessName(nombreOrganizacion);
    const businessDescriptionError = validateBusinessDescription(
      descripcionOrganizacion,
    );

    if (businessNameError) {
      setError('Falta el nombre del negocio.');
      setStepOneErrors({
        nombreOrganizacion: businessNameError,
      });
      setStep(1);
      return;
    }

    if (!tipoOrganizacion) {
      setError('Falta el tipo de negocio.');
      setStepOneErrors({
        tipoOrganizacion:
          'Selecciona el tipo de negocio que mejor describe tu operación.',
      });
      setStep(1);
      return;
    }

    if (businessDescriptionError) {
      setError('Revisa la descripción del negocio.');
      setStepOneErrors({
        descripcionOrganizacion: businessDescriptionError,
      });
      setStep(1);
      return;
    }

    const nameError = validatePersonName(nombre);
    if (nameError) {
      nextErrors.nombre = nameError;
    }

    const lastNameError = validatePersonLastName(apellidos);
    if (lastNameError) {
      nextErrors.apellidos = lastNameError;
    } else if (!hasAtLeastOneSurname(apellidos)) {
      nextErrors.apellidos = 'Ingresa al menos un apellido para continuar.';
    }

    const telefonoDigits = getPhoneDigits(telefono);
    if (!telefono.trim()) {
      nextErrors.telefono = 'Ingresa un número de celular.';
    } else if (/[^\d\s+]/.test(telefono)) {
      nextErrors.telefono = 'Solo se permiten números.';
    } else if (telefonoDigits.length < 10) {
      nextErrors.telefono = 'El número debe tener 10 dígitos.';
    } else if (!isValidPhone(telefonoDigits)) {
      nextErrors.telefono = 'Ingresa un número de celular válido.';
    }

    if (!correo.trim()) {
      nextErrors.correo = 'Ingresa tu correo para crear tu cuenta.';
    } else if (!EMAIL_REGEX.test(correo.trim())) {
      nextErrors.correo =
        'Ingresa un correo válido, por ejemplo nombre@correo.com.';
    } else {
      const emailExistsError = await validateEmailAvailability(correo);
      if (emailExistsError) {
        nextErrors.correo = emailExistsError;
      }
    }

    const checks = getPasswordChecks(password);
    if (!password.trim()) {
      nextErrors.password = 'Crea una contraseña para proteger tu cuenta.';
    } else if (password.length > PASSWORD_MAX_LENGTH) {
      nextErrors.password = 'La contraseña es demasiado larga. Usa máximo 32 caracteres.';
    } else if (
      !checks.minLength ||
      !checks.maxLength ||
      !checks.hasUpper ||
      !checks.hasLower ||
      !checks.hasNumber
    ) {
      nextErrors.password =
        'La contraseña debe tener 8 a 32 caracteres, una mayúscula, una minúscula y un número.';
    }

    if (!confirmPassword.trim()) {
      nextErrors.confirmPassword = 'Confirma nuevamente tu contraseña.';
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'Las contraseñas no coinciden.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setStepTwoErrors(nextErrors);
      setError('Revisa los campos resaltados.');
      scrollToFirstInvalidField([
        nextErrors.nombre ? 'register-admin-name' : '',
        nextErrors.apellidos ? 'register-admin-lastname' : '',
        nextErrors.telefono ? 'register-admin-phone' : '',
        nextErrors.correo ? 'register-admin-email' : '',
        nextErrors.password ? 'register-admin-password' : '',
        nextErrors.confirmPassword ? 'register-admin-password-confirm' : '',
      ]);
      return;
    }

    setStepTwoErrors({});

    if (hasGoogleFlow && !routeState.googleToken) {
      setError('Vuelve a iniciar con Google.');
      return;
    }

    navigate('/estado-sistema', {
      state: {
        hasGoogleFlow,
        googleToken: routeState.googleToken,
        nombreOrganizacion: normalizeBusinessNameInput(nombreOrganizacion).trim(),
        descripcionOrganizacion:
          normalizeBusinessDescriptionInput(descripcionOrganizacion).trim() ||
          undefined,
        tipoOrganizacion: tipoOrganizacion as TipoOrg,
        otroTipoDetalle:
          tipoOrganizacion === 'PERSONALIZADO' && otroTipoDetalle.trim()
            ? otroTipoDetalle.trim()
            : undefined,
        nombre: `${nombre.trim()} ${apellidos.trim()}`,
        telefono: telefonoDigits,
        correo,
        password,
      },
    });
  };

  return {
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
  };
}
