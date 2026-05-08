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
      ? 'Paso 1: Informaci\u00f3n del negocio'
      : step === 2
        ? 'Paso 2: Datos del administrador'
        : `Paso ${step} de ${totalSteps}`;

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-black tracking-normal text-[#1f2937]">
          {stepLabel}
        </span>
        <span className="text-[11px] font-semibold text-[#506077]">
          {step} de {totalSteps}
        </span>
      </div>
      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-[#dbe2ee]">
        <div
          className="h-full rounded-full bg-[#183d92] transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </>
  );
}
