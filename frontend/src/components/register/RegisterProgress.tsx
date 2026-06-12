interface RegisterProgressProps {
  step: number;
  totalSteps: number;
  progressPercent: number;
}

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
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-black tracking-normal text-[#1f2937] dark:text-slate-100">
          {stepLabel}
        </span>
        <span className="text-[11px] font-semibold text-[#506077] dark:text-slate-300">
          {step} de {totalSteps}
        </span>
      </div>
      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-[#dbe2ee] dark:bg-slate-700">
        <div
          className="h-full rounded-full bg-[#183d92] transition-all duration-500 ease-out dark:bg-blue-400"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </>
  );
}
