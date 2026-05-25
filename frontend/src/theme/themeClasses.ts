import { alertThemes } from './alertThemes';

export const themeClasses = {
  page:
    'min-h-screen bg-[#f6f7ff] text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100',
  card:
    'border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
  cardSoft:
    'border border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100',
  input:
    'border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500',
  textPrimary: 'text-slate-900 dark:text-slate-100',
  textSecondary: 'text-slate-600 dark:text-slate-300',
  modal:
    'border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
  bottomNav:
    'border border-slate-200 bg-white/95 text-slate-600 shadow-lg dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-300',
  overlay: 'bg-slate-950/35 backdrop-blur-[2px] dark:bg-slate-950/55',

  pageBase:
    'min-h-screen bg-[#f6f7ff] text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100',
  cardBase:
    'border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
  modalBase:
    'border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
} as const;

export const feedbackThemeClasses = {
  success: {
    border: 'border-emerald-300 dark:border-emerald-700',
    bg: 'bg-emerald-50 dark:bg-emerald-950/35',
    icon: alertThemes.success.icon,
    iconBg: alertThemes.success.iconWrap,
    title: alertThemes.success.title,
    description: alertThemes.success.description,
  },
  error: {
    border: 'border-red-300 dark:border-red-700',
    bg: 'bg-red-50 dark:bg-red-950/40',
    icon: alertThemes.error.icon,
    iconBg: alertThemes.error.iconWrap,
    title: alertThemes.error.title,
    description: alertThemes.error.description,
  },
  warning: {
    border: 'border-amber-300 dark:border-amber-700',
    bg: 'bg-amber-50 dark:bg-amber-950/35',
    icon: alertThemes.warning.icon,
    iconBg: alertThemes.warning.iconWrap,
    title: alertThemes.warning.title,
    description: alertThemes.warning.description,
  },
  info: {
    border: 'border-blue-300 dark:border-blue-700',
    bg: 'bg-blue-50 dark:bg-blue-950/35',
    icon: alertThemes.info.icon,
    iconBg: alertThemes.info.iconWrap,
    title: alertThemes.info.title,
    description: alertThemes.info.description,
  },
} as const;
