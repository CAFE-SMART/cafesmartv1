import { CafeSmartProcessingScreen } from './CafeSmartProcessingScreen';

type InternalLoadingScreenProps = {
  title: string;
  description: string;
  warningText?: string;
  securityTitle?: string;
  securityDescription?: string;
  showSpinner?: boolean;
  variant?: 'purchase' | 'drying';
};

export function InternalLoadingScreen({
  title,
  description,
  warningText = 'No cierres la aplicación durante el registro.',
  securityTitle = 'Tus datos están protegidos',
  securityDescription = 'Estamos validando y guardando la información de forma segura.',
  showSpinner = true,
  variant = 'purchase',
}: InternalLoadingScreenProps) {
  return (
    <CafeSmartProcessingScreen
      title={title}
      subtitle={description}
      helperText={warningText}
      trustTitle={securityTitle}
      trustText={securityDescription}
      showSpinner={showSpinner}
      variant={variant}
    />
  );
}
