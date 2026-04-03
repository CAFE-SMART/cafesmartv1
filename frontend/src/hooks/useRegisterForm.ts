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

  const [nombre, setNombre] = useState(routeState.googlePrefill?.nombre || '');
  const [apellidos, setApellidos] = useState(routeState.googlePrefill?.apellidos || '');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState(routeState.googlePrefill?.correo || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [stepTwoErrors, setStepTwoErrors] = useState<StepTwoErrors>({});
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasGoogleFlow && routeState.googlePrefill) {
      setNombre(routeState.googlePrefill.nombre || '');
      setApellidos(routeState.googlePrefill.apellidos || '');
      setCorreo(routeState.googlePrefill.correo || '');
    }
  }, [hasGoogleFlow, routeState.googlePrefill]);

  const validateEmailAvailability = async (correoValue: string) => {
    if (!EMAIL_REGEX.test(correoValue.trim())) {
      return null;
    }

    setIsCheckingEmail(true);
    try {
      const exists = await authService.checkEmailExists(correoValue.trim().toLowerCase());
      return exists ? 'Este correo ya esta registrado. Usa otro o inicia sesion.' : null;
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
      nextErrors.nombreOrganizacion = 'El nombre de la empresa es obligatorio.';
    }

    if (!tipoOrganizacion) {
      nextErrors.tipoOrganizacion = 'Debes seleccionar el tipo de negocio.';
    }

    if (tipoOrganizacion === 'OTRO' && !otroTipoDetalle.trim()) {
      nextErrors.otroTipoDetalle = 'Por favor especifica el tipo de organizacion.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setStepOneErrors(nextErrors);
      setError('Corrige los campos marcados para continuar.');
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
      setError('El nombre del negocio es obligatorio.');
      setStepOneErrors({ nombreOrganizacion: 'El nombre de la empresa es obligatorio.' });
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
      nextErrors.nombre = 'El nombre del administrador es obligatorio.';
    }

    if (!apellidos.trim()) {
      nextErrors.apellidos = 'Los apellidos del administrador son obligatorios.';
    } else if (!hasAtLeastOneSurname(apellidos)) {
      nextErrors.apellidos = 'Ingresa al menos un apellido valido.';
    }

    if (!telefono.trim()) {
      nextErrors.telefono = 'El telefono es obligatorio.';
    } else if (!isValidPhone(telefono)) {
      nextErrors.telefono = 'Ingresa un telefono colombiano valido. Ejemplo: +57 300 123 4567';
    }

    if (!correo.trim()) {
      nextErrors.correo = 'El correo electronico es obligatorio.';
    } else if (!EMAIL_REGEX.test(correo.trim())) {
      nextErrors.correo = 'Ingresa un correo valido. Ejemplo: admin@empresa.com';
    } else {
      const emailExistsError = await validateEmailAvailability(correo);
      if (emailExistsError) {
        nextErrors.correo = emailExistsError;
      }
    }

    const checks = getPasswordChecks(password);
    if (!checks.minLength || !checks.hasLower || !checks.hasUpper) {
      nextErrors.password =
        'La contrasena debe tener minimo 6 caracteres, una minuscula y una mayuscula.';
    }

    if (!confirmPassword.trim()) {
      nextErrors.confirmPassword = 'Confirma nuevamente tu contrasena.';
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'Las contrasenas no coinciden.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setStepTwoErrors(nextErrors);
      setError('Corrige los campos marcados para continuar.');
      return;
    }

    setStepTwoErrors({});

    if (hasGoogleFlow && !routeState.googleToken) {
      setError('No detectamos tu sesion de Google. Vuelve a iniciar con Google.');
      return;
    }

    navigate('/estado-sistema', {
      state: {
        hasGoogleFlow,
        googleToken: routeState.googleToken,
        nombreOrganizacion,
        tipoOrganizacion: tipoOrganizacion as TipoOrg,
        otroTipoDetalle: tipoOrganizacion === 'OTRO' ? otroTipoDetalle : undefined,
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
