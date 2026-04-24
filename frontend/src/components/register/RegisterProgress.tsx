type RegisterProgressProps = {
  step: number;
  totalSteps: number;
  progressPercent: number;
};

export function RegisterProgress({ step, totalSteps, progressPercent }: RegisterProgressProps) {
  const stepLabel =
    step === 1
      ? 'Paso 1: Información del negocio'
      : step === 2
        ? 'Paso 2: Datos del administrador'
        : `Paso ${step} de ${totalSteps}`;

  return (
    <>
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-bold tracking-wide text-gray-500">
          {stepLabel}
        </span>
        <span className="text-sm font-bold text-[#1e3a8a]">{step} de {totalSteps}</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full mb-8 overflow-hidden">
        <div
          className="h-full bg-[#1e3a8a] rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </>
  );
}
