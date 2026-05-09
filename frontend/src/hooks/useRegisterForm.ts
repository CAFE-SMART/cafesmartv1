import { useEffect, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { authService } from '../services/authService';
import {
  EMAIL_REGEX,
  getPasswordChecks,
  hasAtLeastOneSurname,
  isValidPhone,
  type RegisterLocationState,
  type StepOneErrors,
  type StepTwoErrors,
  type TipoOrg,
  type TipoOrgSelection,
} from '../utils/registerValidators';
import { getPhoneDigits } from '../utils/formatPhone';
import { normalizePossiblyMojibake } from '../utils/jwt';

type UseRegisterFormParams = {
  hasGoogleFlow: boolean;
  routeState: RegisterLocationState;
  navigate: NavigateFunction;
};

export function useRegisterForm({
  hasGoogleFlow,
  routeState,
  navigate,
}: UseRegisterFormParams) {
  const [step, setStep] = useState(1);

  const [nombreOrganizacion, setNombreOrganizacion] = useState('');
  const [tipoOrganizacion, setTipoOrganizacion] =
    useState<TipoOrgSelection>('');
  const [otroTipoDetalle, setOtroTipoDetalle] = useState('');
  const [stepOneErrors, setStepOneErrors] = useState<StepOneErrors>({});

  const [nombre, setNombre] = useState(
    normalizePossiblyMojibake(routeState.googlePrefill?.nombre || ''),
  );
  const [apellidos, setApellidos] = useState(
    normalizePossiblyMojibake(routeState.googlePrefill?.apellidos || ''),
  );
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState(
    normalizePossiblyMojibake(routeState.googlePrefill?.correo || ''),
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
    const nextErrors: StepOneErrors = {};

    if (!nombreOrganizacion.trim()) {
      nextErrors.nombreOrganizacion =
        'Escribe el nombre de tu negocio para continuar.';
    }

    if (!tipoOrganizacion) {
      nextErrors.tipoOrganizacion =
        'Selecciona el tipo de negocio que mejor describe tu operación.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setStepOneErrors(nextErrors);
      setError('Revisa los campos resaltados.');
      return;
    }

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

    if (!nombreOrganizacion.trim()) {
      setError('Falta el nombre del negocio.');
      setStepOneErrors({
        nombreOrganizacion: 'Escribe el nombre de tu negocio para continuar.',
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

    if (!nombre.trim()) {
      nextErrors.nombre = 'Escribe tu nombre para continuar.';
    }

    if (!apellidos.trim()) {
      nextErrors.apellidos = 'Escribe tus apellidos para completar tu cuenta.';
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
    } else if (
      !checks.minLength ||
      !checks.hasLower ||
      !checks.hasUpper ||
      !checks.hasNumber
    ) {
      nextErrors.password =
        'La contraseña debe tener mínimo 6 caracteres, una mayúscula, una minúscula y un número.';
    }

    if (!confirmPassword.trim()) {
      nextErrors.confirmPassword = 'Confirma nuevamente tu contraseña.';
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'Las contraseñas no coinciden.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setStepTwoErrors(nextErrors);
      setError('Revisa los campos resaltados.');
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
        nombreOrganizacion,
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
