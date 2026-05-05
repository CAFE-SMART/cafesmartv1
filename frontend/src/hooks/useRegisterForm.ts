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
import { normalizePossiblyMojibake } from '../utils/jwt';

type UseRegisterFormParams = {
  hasGoogleFlow: boolean;
  routeState: RegisterLocationState;
  navigate: NavigateFunction;
};

export function useRegisterForm({ hasGoogleFlow, routeState, navigate }: UseRegisterFormParams) {
  const [step, setStep] = useState(1);

  const [nombreOrganizacion, setNombreOrganizacion] = useState('');
  const [tipoOrganizacion, setTipoOrganizacion] = useState<TipoOrgSelection>('');
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
      const exists = await authService.checkEmailExists(correoValue.trim().toLowerCase());
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
      nextErrors.nombreOrganizacion = 'Escribe el nombre del negocio.';
    }

    if (!tipoOrganizacion) {
      nextErrors.tipoOrganizacion = 'Elige un tipo de negocio.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setStepOneErrors(nextErrors);
      setError('Revisa los campos marcados.');
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
      setStepOneErrors({ nombreOrganizacion: 'Escribe el nombre del negocio.' });
      setStep(1);
      return;
    }

    if (!tipoOrganizacion) {
      setError('Falta el tipo de negocio.');
      setStepOneErrors({ tipoOrganizacion: 'Elige un tipo de negocio.' });
      setStep(1);
      return;
    }

    if (!nombre.trim()) {
      nextErrors.nombre = 'Escribe el nombre.';
    }

    if (!apellidos.trim()) {
      nextErrors.apellidos = 'Escribe los apellidos.';
    } else if (!hasAtLeastOneSurname(apellidos)) {
      nextErrors.apellidos = 'Ingresa un apellido valido.';
    }

    if (!telefono.trim()) {
      nextErrors.telefono = 'Escribe el telefono.';
    } else if (!isValidPhone(telefono)) {
      nextErrors.telefono = 'Telefono invalido.';
    }

    if (!correo.trim()) {
      nextErrors.correo = 'Escribe el correo.';
    } else if (!EMAIL_REGEX.test(correo.trim())) {
      nextErrors.correo = 'Correo invalido.';
    } else {
      const emailExistsError = await validateEmailAvailability(correo);
      if (emailExistsError) {
        nextErrors.correo = emailExistsError;
      }
    }

    const checks = getPasswordChecks(password);
    if (!checks.minLength || !checks.hasLower || !checks.hasUpper) {
      nextErrors.password =
        'Minimo 6 caracteres, minuscula y mayuscula.';
    }

    if (!confirmPassword.trim()) {
      nextErrors.confirmPassword = 'Confirma tu contrasena.';
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'No coinciden.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setStepTwoErrors(nextErrors);
      setError('Revisa los campos marcados.');
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
        telefono,
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
