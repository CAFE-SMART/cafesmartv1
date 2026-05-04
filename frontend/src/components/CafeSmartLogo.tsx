import { Coffee } from 'lucide-react';

type CafeSmartLogoProps = {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  showSubtitle?: boolean;
  compact?: boolean;
  className?: string;
};

const sizes = {
  sm: {
    shell: 'h-[62px] w-[62px]',
    steamOne: 'top-0 h-7 w-5 border-[3px]',
    steamTwo: 'top-3 h-6 w-5 border-[3px]',
    cup: 'bottom-0 h-[40px] w-[52px] rounded-b-[24px] rounded-t-[6px] border-[4px]',
    handle: 'bottom-[18px] right-0 h-5 w-4 border-[4px]',
    bean: 'h-4 w-4',
    title: 'text-[1.35rem]',
    subtitle: 'text-[0.7rem]',
  },
  md: {
    shell: 'h-[86px] w-[86px]',
    steamOne: 'top-0 h-9 w-7 border-[4px]',
    steamTwo: 'top-4 h-8 w-6 border-[4px]',
    cup: 'bottom-0 h-[54px] w-[70px] rounded-b-[32px] rounded-t-[7px] border-[5px]',
    handle: 'bottom-6 right-0 h-7 w-6 border-[5px]',
    bean: 'h-6 w-6',
    title: 'text-[2rem]',
    subtitle: 'text-sm',
  },
  lg: {
    shell: 'h-[118px] w-[118px]',
    steamOne: 'top-1 h-12 w-9 border-4',
    steamTwo: 'top-5 h-10 w-8 border-4',
    cup: 'bottom-1 h-[74px] w-[94px] rounded-b-[42px] rounded-t-[8px] border-[6px]',
    handle: 'bottom-8 right-1 h-9 w-8 border-[6px]',
    bean: 'h-8 w-8',
    title: 'text-[42px]',
    subtitle: 'text-[17px]',
  },
} as const;

export function CafeSmartLogo({
  size = 'md',
  showText = true,
  showSubtitle = true,
  compact = false,
  className = '',
}: CafeSmartLogoProps) {
  const style = sizes[size];

  return (
    <div className={`text-center ${className}`}>
      <div className={`relative mx-auto flex ${style.shell} items-center justify-center`}>
        <span
          className={`absolute ${style.steamOne} rounded-full border-[#2f80ed] border-b-0 opacity-90 animate-[cafesmartSteam_2.2s_ease-in-out_infinite]`}
          aria-hidden="true"
        />
        <span
          className={`absolute ${style.steamTwo} rounded-full border-[#2f80ed] border-b-0 opacity-80 animate-[cafesmartSteam_2.4s_ease-in-out_infinite_160ms]`}
          aria-hidden="true"
        />
        <div
          className={`absolute ${style.cup} flex items-center justify-center border-[#2f80ed] bg-white shadow-[0_22px_48px_rgba(37,99,235,0.12)]`}
        >
          <Coffee className={`${style.bean} text-[#8b572a]`} strokeWidth={2.4} aria-hidden="true" />
        </div>
        <div
          className={`absolute ${style.handle} rounded-r-full border-l-0 border-[#2f80ed]`}
          aria-hidden="true"
        />
      </div>

      {showText ? (
        <p className={`${compact ? 'mt-1' : 'mt-3'} ${style.title} font-black leading-none tracking-normal`}>
          <span className="text-[#07153b]">Café</span>
          <span className="text-[#1683f7]">Smart</span>
        </p>
      ) : null}
      {showText && showSubtitle ? (
        <p className={`${compact ? 'mt-1' : 'mt-3'} ${style.subtitle} font-semibold leading-5 text-slate-600`}>
          Gestiona tu negocio cafetero
        </p>
      ) : null}
    </div>
  );
}
