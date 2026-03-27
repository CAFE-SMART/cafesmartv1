type RegisterProgressProps = {
  step: number;
  totalSteps: number;
  progressPercent: number;
};

export function RegisterProgress({ step, totalSteps, progressPercent }: RegisterProgressProps) {
  return (
    <>
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-bold tracking-wider text-gray-500 uppercase">
          Paso {step} de {totalSteps}
        </span>
        <span className="text-sm font-bold text-[#1e3a8a]">{progressPercent}%</span>
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
