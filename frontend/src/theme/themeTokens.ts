export const themeTokens = {
  surface: {
    page: 'bg-[#f6f7ff] dark:bg-slate-950',
    card: 'bg-white dark:bg-slate-900',
    cardSoft: 'bg-slate-50 dark:bg-slate-800',
    input: 'bg-white dark:bg-slate-950',
    chip: 'bg-slate-100 dark:bg-slate-800',
    disabled: 'bg-slate-100 dark:bg-slate-800/70',
  },
  text: {
    primary: 'text-slate-900 dark:text-slate-50',
    secondary: 'text-slate-600 dark:text-slate-200',
    muted: 'text-slate-500 dark:text-slate-300',
    soft: 'text-slate-400 dark:text-slate-300',
    inverse: 'text-white',
    disabled: 'text-slate-400 dark:text-slate-500',
  },
  border: {
    default: 'border-slate-200 dark:border-slate-600',
    soft: 'border-slate-100 dark:border-slate-700',
    strong: 'border-slate-300 dark:border-slate-500',
    focus: 'focus-visible:ring-4 focus-visible:ring-blue-500/25 dark:focus-visible:ring-blue-300/30',
  },
  icon: {
    default: 'text-slate-600 dark:text-slate-100',
    soft: 'text-slate-500 dark:text-slate-200',
    accent: 'text-blue-700 dark:text-blue-200',
    danger: 'text-red-700 dark:text-red-200',
    warning: 'text-amber-700 dark:text-amber-200',
    success: 'text-emerald-700 dark:text-emerald-200',
    disabled: 'text-slate-400 dark:text-slate-500',
  },
  button: {
    primary: 'bg-blue-700 text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500',
    secondary:
      'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
    outline:
      'border border-blue-200 bg-white text-blue-700 hover:bg-blue-50 dark:border-blue-400/50 dark:bg-slate-900 dark:text-blue-200 dark:hover:bg-blue-500/15',
  },
} as const;
