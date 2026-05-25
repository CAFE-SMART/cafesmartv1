export const alertThemes = {
  error: {
    container:
      'border border-red-300 bg-red-50 text-red-900 dark:border-red-700 dark:bg-red-950/40 dark:text-red-100',
    title: 'text-red-800 dark:text-red-200',
    description: 'text-red-700 dark:text-red-100',
    iconWrap: 'bg-red-100 dark:bg-red-900/50',
    icon: 'text-red-700 dark:text-red-300',
    badge:
      'border border-red-200 bg-red-100 text-red-800 dark:border-red-700 dark:bg-red-900/50 dark:text-red-200',
  },
  warning: {
    container:
      'border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/35 dark:text-amber-100',
    title: 'text-amber-900 dark:text-amber-200',
    description: 'text-amber-800 dark:text-amber-100',
    iconWrap: 'bg-amber-100 dark:bg-amber-900/40',
    icon: 'text-amber-700 dark:text-amber-300',
    badge:
      'border border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-200',
  },
  success: {
    container:
      'border border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-100',
    title: 'text-emerald-900 dark:text-emerald-200',
    description: 'text-emerald-800 dark:text-emerald-100',
    iconWrap: 'bg-emerald-100 dark:bg-emerald-900/40',
    icon: 'text-emerald-700 dark:text-emerald-300',
    badge:
      'border border-emerald-200 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200',
  },
  info: {
    container:
      'border border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-700 dark:bg-blue-950/35 dark:text-blue-100',
    title: 'text-blue-900 dark:text-blue-200',
    description: 'text-blue-800 dark:text-blue-100',
    iconWrap: 'bg-blue-100 dark:bg-blue-900/40',
    icon: 'text-blue-700 dark:text-blue-300',
    badge:
      'border border-blue-200 bg-blue-100 text-blue-900 dark:border-blue-700 dark:bg-blue-900/50 dark:text-blue-200',
  },
} as const;

export type AlertVariant = keyof typeof alertThemes;
