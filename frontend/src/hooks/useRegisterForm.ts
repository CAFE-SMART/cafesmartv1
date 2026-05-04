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

  const [nombreOrganizacion, setNombreOrganizacion] = useState(
    normalizePossiblyMojibake(routeState.registerDraft?.nombreOrganizacion || ''),
  );
  const [tipoOrganizacion, setTipoOrganizacion] = useState<TipoOrgSelection>(
    routeState.registerDraft?.tipoOrganizacion || '',
  );
  const [otroTipoDetalle, setOtroTipoDetalle] = useState(
    normalizePossiblyMojibake(routeState.registerDraft?.otroTipoDetalle || ''),
  );
  const [stepOneErrors, setStepOneErrors] = useState<StepOneErrors>({});

  const [nombre, setNombre] = useState(
    normalizePossiblyMojibake(
      routeState.googlePrefill?.nombre ||
        routeState.registerDraft?.nombre?.trim().split(/\s+/).slice(0, 1).join(' ') ||
        '',
    ),
  );
  const [apellidos, setApellidos] = useState(
    normalizePossiblyMojibake(
      routeState.googlePrefill?.apellidos ||
        routeState.registerDraft?.nombre?.trim().split(/\s+/).slice(1).join(' ') ||
        '',
    ),
  );
  const [telefono, setTelefono] = useState(
    routeState.registerDraft?.telefono?.replace(/\D/g, '').slice(-10) || '',
  );
  const [correo, setCorreo] = useState(
    normalizePossiblyMojibake(
      routeState.googlePrefill?.correo || routeState.registerDraft?.correo || '',
    ),
  );
  const [password, setPassword] = useState(routeState.registerDraft?.password || '');
  const [confirmPassword, setConfirmPassword] = useState(routeState.registerDraft?.password || '');
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
      return exists ? 'Este correo ya está registrado. Usa otro o inicia sesión.' : null;
    } catch (checkError) {
      const message =
        checkError && typeof checkError === 'object' && 'message' in checkError
          ? String((checkError as { message?: unknown }).message)
          : 'No se pudo validar el correo con el servidor.';

      return message || 'No se pudo validar el correo con el servidor.';
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const nombreOrganizacionNormalizado = nombreOrganizacion.trim().replace(/\s+/g, ' ');

  const goToStep2 = () => {
    setError(null);
    const nextErrors: StepOneErrors = {};

    if (!nombreOrganizacionNormalizado) {
      nextErrors.nombreOrganizacion = 'El nombre de la empresa es obligatorio.';
    } else if (nombreOrganizacionNormalizado.length < 2) {
      nextErrors.nombreOrganizacion =
        'El nombre de la empresa debe tener mínimo 2 caracteres.';
    }

    if (!tipoOrganizacion) {
      nextErrors.tipoOrganizacion = 'Debes seleccionar el tipo de negocio.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setStepOneErrors(nextErrors);
      setError('Revisa los campos en rojo y corrígelos para continuar.');
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

    if (!nombreOrganizacionNormalizado) {
      setError('El nombre del negocio es obligatorio.');
      setStepOneErrors({ nombreOrganizacion: 'El nombre de la empresa es obligatorio.' });
      setStep(1);
      return;
    }

    if (nombreOrganizacionNormalizado.length < 2) {
      setError('El nombre del negocio debe tener mínimo 2 caracteres.');
      setStepOneErrors({
        nombreOrganizacion: 'El nombre de la empresa debe tener mínimo 2 caracteres.',
      });
      setStep(1);
      return;
    }

    if (!tipoOrganizacion) {
      setError('Debes seleccionar el tipo de negocio.');
      setStepOneErrors({ tipoOrganizacion: 'Debes seleccionar el tipo de negocio.' });
      setStep(1);
      return;
    }

    if (!nombre.trim()) {
      nextErrors.nombre = 'Completa este campo para continuar.';
    }

    if (!apellidos.trim()) {
      nextErrors.apellidos = 'Completa este campo para continuar.';
    } else if (!hasAtLeastOneSurname(apellidos)) {
      nextErrors.apellidos = 'Ingresa al menos un apellido válido.';
    }

    if (!telefono.trim()) {
      nextErrors.telefono = 'Completa este campo para continuar.';
    } else if (!isValidPhone(telefono)) {
      nextErrors.telefono = 'Ingresa un número de celular colombiano de 10 dígitos.';
    }

    if (!correo.trim()) {
      nextErrors.correo = 'Completa este campo para continuar.';
    } else if (!EMAIL_REGEX.test(correo.trim())) {
      nextErrors.correo = 'Revisa que el correo incluya @ y un dominio.';
    } else {
      const emailExistsError = await validateEmailAvailability(correo);
      if (emailExistsError) {
        nextErrors.correo = emailExistsError;
      }
    }

    const checks = getPasswordChecks(password);
    if (!checks.minLength || !checks.hasLower || !checks.hasUpper || !checks.hasNumber) {
      nextErrors.password =
        'Completa los requisitos de seguridad para continuar.';
    }

    if (!confirmPassword.trim()) {
      nextErrors.confirmPassword = 'Completa este campo para continuar.';
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'Las contraseñas no coinciden. Revísalas e intenta otra vez.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setStepTwoErrors(nextErrors);
      setError('Revisa los campos en rojo y corrígelos para continuar.');
      return;
    }

    setStepTwoErrors({});

    if (hasGoogleFlow && !routeState.googleToken) {
      setError('No detectamos tu sesión de Google. Vuelve a iniciar con Google.');
      return;
    }

    navigate('/estado-sistema', {
      state: {
        hasGoogleFlow,
        googleToken: routeState.googleToken,
        nombreOrganizacion: nombreOrganizacionNormalizado,
        tipoOrganizacion: tipoOrganizacion as TipoOrg,
        otroTipoDetalle:
          tipoOrganizacion === 'PERSONALIZADO' && otroTipoDetalle.trim()
            ? otroTipoDetalle.trim()
            : undefined,
        nombre: `${nombre.trim()} ${apellidos.trim()}`,
        telefono: `+57 ${telefono.replace(/\D/g, '')}`,
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
