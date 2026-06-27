type RegisterProgressProps = {
  step: number;
  totalSteps: number;
  progressPercent: number;
};

export function RegisterProgress({
  step,
  totalSteps,
  progressPercent,
}: RegisterProgressProps) {
  const stepLabel =
    step === 1
      ? 'Paso 1: Información del negocio'
      : step === 2
        ? 'Paso 2: Datos del administrador'
        : `Paso ${step} de ${totalSteps}`;

  return (
    <>
      <div className="mb-2 flex items-center justify-between text-[0.95rem] font-medium text-slate-600">
        <span>
          {stepLabel}
        </span>
        <span className="text-slate-400">
          {step} de {totalSteps}
        </span>
      </div>
      <div className="mb-6 h-2.5 w-full overflow-hidden rounded-full bg-[#d0dbeb]">
        <div
          className="h-full rounded-full bg-[#1D4ED8] transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </>
  );
}
