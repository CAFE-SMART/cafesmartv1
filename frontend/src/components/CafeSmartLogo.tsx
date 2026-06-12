type CafeSmartLogoProps = {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  showSubtitle?: boolean;
  compact?: boolean;
  className?: string;
};

const sizes = {
  sm: {
    shell: 'h-[70px] w-[70px]',
    title: 'text-[1.35rem]',
    subtitle: 'text-[0.7rem]',
  },
  md: {
    shell: 'h-[94px] w-[94px]',
    title: 'text-[2rem]',
    subtitle: 'text-sm',
  },
  lg: {
    shell: 'h-[132px] w-[132px]',
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
      <svg
        className={`mx-auto ${style.shell} overflow-visible`}
        viewBox="0 0 120 150"
        fill="none"
        aria-hidden="true"
      >
        <path
          className="origin-center animate-[cafesmartSteam_2.6s_ease-in-out_infinite]"
          d="M72 5C82 9 76 20 59 27C39 35 31 43 39 51C46 58 63 50 78 48C97 45 103 62 84 72C73 78 62 79 54 88"
          stroke="#1683f7"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M11 74H83V108C83 127 68 141 47 141C26 141 11 127 11 108V74Z"
          stroke="#1683f7"
          strokeWidth="8"
          strokeLinejoin="round"
        />
        <path
          d="M83 84H96C106 84 113 91 113 101C113 112 105 120 94 120H83"
          stroke="#1683f7"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M49 118C40 112 37 101 42 91C46 82 56 78 68 81C70 92 67 103 59 111C56 114 53 116 49 118Z"
          fill="#8b572a"
        />
        <path
          d="M48 118C52 103 60 91 68 81"
          stroke="#6f3f1f"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>

      {showText ? (
        <p className={`${compact ? 'mt-1' : 'mt-3'} ${style.title} font-black leading-none tracking-normal`}>
          <span className="text-[#07153b]">Café</span>
          <span className="text-[#1683f7]">Smart</span>
        </p>
      ) : null}
      {showText && showSubtitle ? (
        <p className={`${compact ? 'mt-1' : 'mt-3'} ${style.subtitle} font-semibold leading-5 text-slate-600 dark:text-slate-300`}>
          Gestiona tu negocio cafetero
        </p>
      ) : null}
    </div>
  );
}
