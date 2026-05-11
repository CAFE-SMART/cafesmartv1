import { ShieldCheck } from 'lucide-react';
import { CafeSmartLogo } from './CafeSmartLogo';

type CafeSmartProcessingScreenProps = {
  title: string;
  subtitle: string;
  helperText: string;
  trustTitle: string;
  trustText: string;
};

function ProcessingAnimations() {
  return (
    <style>
      {`
        @keyframes cafesmartFadeScale {
          0% { opacity: 0; transform: translateY(8px) scale(0.94); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes cafesmartFadeUp {
          0% { opacity: 0; transform: translateY(16px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes cafesmartSteam {
          0%, 100% { opacity: .58; transform: translateY(0) scaleX(1); }
          50% { opacity: 1; transform: translateY(-5px) scaleX(.96); }
        }

        @keyframes cafesmartSpin {
          to { transform: rotate(360deg); }
        }

        @keyframes cafesmartSway {
          0%, 100% { transform: rotate(-2deg) translateX(0); }
          50% { transform: rotate(2deg) translateX(4px); }
        }

        @keyframes cafesmartFloat {
          0%, 100% { transform: translateY(0) rotate(-4deg); }
          50% { transform: translateY(-7px) rotate(4deg); }
        }

        @keyframes cafesmartPulseSoft {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.045); }
        }
      `}
    </style>
  );
}

function CoffeePlant({
  className,
  delay = '0s',
}: {
  className: string;
  delay?: string;
}) {
  return (
    <svg
      viewBox="0 0 96 140"
      className={className}
      fill="none"
      style={{ animationDelay: delay }}
      aria-hidden="true"
    >
      <path
        d="M48 134C45 92 52 56 75 17"
        stroke="#86bfff"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path d="M49 96C28 90 16 76 14 58C35 60 49 75 49 96Z" fill="#9ccaff" />
      <path d="M57 78C77 73 89 61 91 43C71 43 58 58 57 78Z" fill="#7db5ff" />
      <path
        d="M60 116C77 112 88 101 91 84C73 84 61 98 60 116Z"
        fill="#9ccaff"
      />
      <circle cx="55" cy="119" r="5" fill="#7db5ff" />
      <circle cx="69" cy="126" r="5" fill="#c46b36" />
    </svg>
  );
}

function FloatingLeaf({ className, delay = '0s' }: { className: string; delay?: string }) {
  return (
    <svg
      viewBox="0 0 42 58"
      className={className}
      fill="none"
      style={{ animationDelay: delay }}
      aria-hidden="true"
    >
      <path
        d="M35 4C15 8 5 24 10 49C31 44 42 27 35 4Z"
        fill="#8fbeff"
        opacity="0.78"
      />
      <path
        d="M31 13C24 27 18 38 11 48"
        stroke="#5fa2ff"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path
        d="M20 34L11 31M25 24L17 20"
        stroke="#6aa7ff"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.75"
      />
    </svg>
  );
}

function CoffeeBean({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 42 42" className={className} fill="none" aria-hidden="true">
      <ellipse
        cx="21"
        cy="21"
        rx="11"
        ry="17"
        transform="rotate(35 21 21)"
        fill="#8b572a"
      />
      <path
        d="M14 31C18 23 23 18 30 12"
        stroke="#6f3f1f"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PurchaseIllustration() {
  return (
    <div className="relative mt-7 h-[190px] w-full animate-[cafesmartFadeUp_420ms_ease-out_100ms_both]">
      <div className="absolute left-1/2 top-5 h-40 w-40 -translate-x-1/2 rounded-full bg-[#e9f3ff] animate-[cafesmartPulseSoft_2.8s_ease-in-out_infinite]" />
      <FloatingLeaf className="absolute left-9 top-14 h-10 w-8 opacity-80 animate-[cafesmartFloat_4.2s_ease-in-out_infinite]" />
      <FloatingLeaf
        className="absolute right-8 top-9 h-12 w-9 opacity-80 animate-[cafesmartFloat_4.8s_ease-in-out_infinite]"
        delay="0.35s"
      />
      <CoffeeBean className="absolute left-12 top-[118px] h-8 w-8 opacity-95 animate-[cafesmartFloat_5s_ease-in-out_infinite]" />
      <CoffeeBean className="absolute right-16 top-[104px] h-7 w-7 opacity-95 animate-[cafesmartFloat_5.4s_ease-in-out_infinite]" />
      <CoffeePlant className="absolute bottom-0 left-7 h-24 w-20 origin-bottom opacity-70 animate-[cafesmartSway_4.3s_ease-in-out_infinite]" />
      <CoffeePlant
        className="absolute bottom-0 right-4 h-28 w-20 origin-bottom opacity-70 animate-[cafesmartSway_4.9s_ease-in-out_infinite]"
        delay="0.25s"
      />

      <svg
        viewBox="0 0 210 170"
        className="absolute left-1/2 top-5 h-[170px] w-[210px] -translate-x-1/2"
        fill="none"
        aria-hidden="true"
      >
        <ellipse cx="106" cy="156" rx="84" ry="10" fill="#cfe0fb" opacity="0.85" />
        <path d="M56 80L143 65L160 150L50 152L56 80Z" fill="#7fb5ff" />
        <path d="M143 65L173 82L160 150L143 145V65Z" fill="#1683f7" />
        <path d="M56 80L143 65L173 82L83 99L56 80Z" fill="#2f80ed" />
        <path
          d="M85 88C86 45 127 44 130 85"
          stroke="#1683f7"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M96 86C97 47 132 46 138 82"
          stroke="#9ccaff"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <rect
          x="82"
          y="48"
          width="77"
          height="39"
          transform="rotate(7 82 48)"
          fill="#f4f7fb"
        />
        <path d="M90 60L150 68" stroke="#a7b2c4" strokeWidth="4" strokeLinecap="round" />
        <path
          d="M111 137C100 129 96 114 103 103C109 92 122 88 138 92C140 107 136 121 126 131C121 134 117 136 111 137Z"
          fill="white"
          opacity="0.88"
        />
        <path
          d="M110 137C116 119 127 102 138 92"
          stroke="#9ccaff"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M105 84C98 79 96 70 100 62C104 55 112 52 122 55C124 65 121 74 115 80C112 82 109 84 105 84Z"
          fill="#8b572a"
        />
        <path
          d="M105 84C109 72 115 62 122 55"
          stroke="#6f3f1f"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function BottomDecoration() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[190px] overflow-hidden">
      <svg
        className="absolute bottom-0 h-full w-full"
        viewBox="0 0 430 190"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 86C54 55 105 72 153 101C211 136 259 95 313 84C358 75 393 93 430 116V190H0V86Z"
          fill="#dbeafe"
          opacity="0.82"
        />
        <path
          d="M0 126C59 94 113 106 170 133C223 158 270 126 319 116C364 108 397 126 430 143V190H0V126Z"
          fill="#bfdbfe"
          opacity="0.58"
        />
      </svg>
      <CoffeePlant className="absolute bottom-3 left-8 h-24 w-20 origin-bottom opacity-85 animate-[cafesmartSway_4s_ease-in-out_infinite]" />
      <CoffeePlant
        className="absolute bottom-3 right-5 h-36 w-24 origin-bottom opacity-90 animate-[cafesmartSway_4.8s_ease-in-out_infinite]"
        delay="0.35s"
      />
    </div>
  );
}

export function CafeSmartProcessingScreen({
  title,
  subtitle,
  helperText,
  trustTitle,
  trustText,
}: CafeSmartProcessingScreenProps) {
  return (
    <main
      className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-[#f8fbff] px-5 py-7 text-[#07153b]"
      aria-busy="true"
      aria-live="polite"
    >
      <ProcessingAnimations />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 16%, rgba(47,128,237,0.09), transparent 30%), linear-gradient(180deg,#ffffff 0%,#f8fbff 60%,#eef5ff 100%)',
        }}
      />

      <section className="relative z-10 flex min-h-[calc(100dvh-3.5rem)] w-full max-w-[430px] flex-col items-center pb-28 text-center">
        <div className="mx-auto h-1.5 w-16 rounded-full bg-[#c7d6ef] animate-[cafesmartFadeScale_300ms_ease-out_both]" />
        <div className="mt-8 animate-[cafesmartFadeScale_300ms_ease-out_60ms_both]">
          <CafeSmartLogo size="sm" compact />
        </div>

        <PurchaseIllustration />

        <div className="mt-3 animate-[cafesmartFadeUp_420ms_ease-out_180ms_both]">
          <h1 className="text-[1.55rem] font-black leading-tight text-[#07153b]">
            {title}
          </h1>
          <p className="mx-auto mt-3 max-w-[310px] text-sm font-semibold leading-6 text-slate-500">
            {subtitle}
          </p>
        </div>

        <div className="mt-7 animate-[cafesmartFadeUp_420ms_ease-out_260ms_both]">
          <div className="mx-auto h-12 w-12 rounded-full border-[4px] border-blue-100 border-t-[#1683f7] animate-[cafesmartSpin_850ms_linear_infinite]" />
          <p className="mt-4 text-sm font-semibold leading-6 text-slate-500">
            {helperText}
          </p>
        </div>

        <div className="mt-7 flex w-full max-w-[330px] items-center gap-3 rounded-[22px] bg-[#eef6ff] p-4 text-left shadow-[0_18px_38px_rgba(37,99,235,0.08)] animate-[cafesmartFadeUp_420ms_ease-out_340ms_both]">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-[#1683f7] shadow-[0_10px_24px_rgba(37,99,235,0.08)]">
            <ShieldCheck size={25} strokeWidth={2.3} />
          </div>
          <div>
            <p className="text-sm font-black text-[#07153b]">{trustTitle}</p>
            <p className="mt-1 text-[0.78rem] font-semibold leading-5 text-slate-500">
              {trustText}
            </p>
          </div>
        </div>
      </section>

      <BottomDecoration />
    </main>
  );
}
