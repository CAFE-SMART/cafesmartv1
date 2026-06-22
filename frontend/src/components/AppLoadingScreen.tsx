import { CafeSmartLogo } from './CafeSmartLogo';

type AppLoadingScreenProps = {
  title?: string;
  subtitle?: string;
};

export function AppLoadingScreen({
  title = 'Cargando...',
  subtitle = 'Preparando tu experiencia',
}: AppLoadingScreenProps) {
  return (
    <main
      className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-[#f8fbff] px-6 py-10 text-[#07153b] dark:bg-slate-950 dark:text-slate-100"
      role="status"
      aria-busy="true"
      aria-live="polite"
    >
      <style>
        {`
          @keyframes appSplashFadeScale {
            from { opacity: 0; transform: translateY(8px) scale(.94); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }

          @keyframes appSplashFadeUp {
            from { opacity: 0; transform: translateY(14px); }
            to { opacity: 1; transform: translateY(0); }
          }

          @keyframes appSplashSpin {
            to { transform: rotate(360deg); }
          }

          @keyframes appSplashSway {
            0%, 100% { transform: rotate(-2deg) translateX(0); }
            50% { transform: rotate(2deg) translateX(4px); }
          }

          @keyframes cafesmartSteam {
            0%, 100% { opacity: .65; transform: translateY(0) scaleX(1); }
            50% { opacity: 1; transform: translateY(-4px) scaleX(.96); }
          }
        `}
      </style>

      <div
        className="pointer-events-none absolute inset-0 opacity-80 dark:hidden"
        style={{
          background:
            'radial-gradient(circle at 78% 18%, rgba(59, 130, 246, 0.08), transparent 30%), linear-gradient(180deg, #ffffff 0%, #f8fbff 58%, #eef5ff 100%)',
        }}
      />
      <div className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(circle_at_78%_18%,rgba(96,165,250,0.12),transparent_30%),linear-gradient(180deg,#020617_0%,#0f172a_58%,#111827_100%)] opacity-95 dark:block" />

      <div className="relative z-10 flex w-full max-w-[430px] flex-col items-center text-center">
        <section className="animate-[appSplashFadeScale_360ms_ease-out_both]">
          <CafeSmartLogo size="lg" />
        </section>

        <section className="mt-16 animate-[appSplashFadeUp_520ms_ease-out_180ms_both]">
          <div className="cs-loader mx-auto h-12 w-12" aria-hidden="true" />
          <span className="sr-only">Cargando</span>
          <p className="mt-6 text-[23px] font-black leading-7 text-[#07153b] dark:text-slate-100">
            {title}
          </p>
          <p className="mt-2 text-sm font-semibold leading-5 text-slate-500 dark:text-slate-300">
            {subtitle}
          </p>
        </section>
      </div>

      <DecorativeBottom />
    </main>
  );
}

function DecorativeBottom() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[190px] overflow-hidden text-[#88b8ff] opacity-100 dark:opacity-45">
      <svg
        className="absolute bottom-0 h-full w-full"
        viewBox="0 0 390 190"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 82C55 53 104 71 154 96C209 124 253 88 300 75C337 65 365 77 390 94V190H0V82Z"
          fill="#dbeafe"
          opacity="0.72"
        />
        <path
          d="M0 120C48 93 100 101 150 124C208 151 256 111 309 102C344 96 372 112 390 128V190H0V120Z"
          fill="#bfdbfe"
          opacity="0.55"
        />
      </svg>

      <svg
        className="absolute bottom-6 left-8 h-20 w-20 origin-bottom opacity-80 animate-[appSplashSway_4s_ease-in-out_infinite]"
        viewBox="0 0 90 90"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M45 82C42 60 44 41 55 22"
          stroke="#6aa7ff"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path d="M45 72C30 68 23 60 22 47C35 47 44 55 45 72Z" fill="#7fb5ff" />
        <path d="M50 56C66 51 73 43 72 30C58 30 50 40 50 56Z" fill="#7fb5ff" />
        <path d="M52 39C40 34 35 26 38 15C49 17 55 27 52 39Z" fill="#9ac7ff" />
      </svg>

      <svg
        className="absolute bottom-2 right-8 h-32 w-24 origin-bottom opacity-85 animate-[appSplashSway_4.8s_ease-in-out_infinite]"
        viewBox="0 0 100 150"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M53 145C44 101 46 62 73 17"
          stroke="#6aa7ff"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <path
          d="M48 112C28 104 16 91 17 73C37 73 50 88 48 112Z"
          fill="#7fb5ff"
        />
        <path d="M57 91C80 85 92 72 91 52C68 52 56 69 57 91Z" fill="#7fb5ff" />
        <path d="M66 62C45 55 35 41 39 23C58 27 68 43 66 62Z" fill="#9ac7ff" />
        <circle cx="71" cy="109" r="6" fill="#c46b36" />
        <circle cx="59" cy="119" r="6" fill="#c46b36" />
        <circle cx="75" cy="124" r="5" fill="#c46b36" />
      </svg>
    </div>
  );
}
