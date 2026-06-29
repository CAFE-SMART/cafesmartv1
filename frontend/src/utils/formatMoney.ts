import { apiFetch } from '../services/apiService';

export const CURRENCIES = {
  COP: { locale: 'es-CO', code: 'COP', label: 'Pesos colombianos (COP)', symbol: '$' },
  USD: { locale: 'en-US', code: 'USD', label: 'Dólares estadounidenses (USD)', symbol: '$' },
  EUR: { locale: 'de-DE', code: 'EUR', label: 'Euros (EUR)', symbol: '€' },
  MXN: { locale: 'es-MX', code: 'MXN', label: 'Pesos mexicanos (MXN)', symbol: '$' },
};

let memoryCurrency = 'COP';
let isConfigured = false;

export const getActiveCurrency = (): string => {
  return isConfigured ? memoryCurrency : '';
};

export const getActiveCurrencyLabel = (): string => {
  if (!isConfigured) return 'Moneda no configurada';
  const code = memoryCurrency;
  const info = CURRENCIES[code as keyof typeof CURRENCIES] || CURRENCIES.COP;
  return info.label;
};

export const isCurrencyConfigured = (): boolean => {
  return isConfigured;
};

export const updateMemoryCurrency = (code: string | null, configured: boolean): void => {
  if (code && CURRENCIES[code as keyof typeof CURRENCIES]) {
    memoryCurrency = code;
    isConfigured = configured;
  } else {
    memoryCurrency = 'COP';
    isConfigured = false;
  }
  window.dispatchEvent(new Event('cafesmart_currency_changed'));
};

export const setActiveCurrency = async (code: string): Promise<void> => {
  if (CURRENCIES[code as keyof typeof CURRENCIES]) {
    await apiFetch('/bodega/moneda', {
      method: 'POST',
      body: JSON.stringify({ moneda: code }),
    });
    updateMemoryCurrency(code, true);
  }
};

/**
 * Formatea una cadena numérica al formato de entrada de moneda.
 */
export const formatearMonedaInput = (valor: string): string => {
  const numeros = valor.replace(/\D/g, '');
  if (!numeros) {
    return '';
  }
  const code = isConfigured ? memoryCurrency : 'COP';
  const info = CURRENCIES[code as keyof typeof CURRENCIES] || CURRENCIES.COP;
  return new Intl.NumberFormat(info.locale, {
    maximumFractionDigits: 0,
  }).format(Number(numeros));
};

/**
 * Formatea un número al formato de moneda seleccionado con la etiqueta al final (ej., "$ 14.000 COP").
 * Si la moneda no está configurada, retorna solo el número formateado sin símbolos ni etiquetas.
 */
export const formatoMoneda = (valor: number): string => {
  if (!isConfigured) {
    return new Intl.NumberFormat('es-CO', {
      maximumFractionDigits: 0,
    }).format(valor);
  }
  const code = memoryCurrency;
  const info = CURRENCIES[code as keyof typeof CURRENCIES] || CURRENCIES.COP;
  const formatted = new Intl.NumberFormat(info.locale, {
    style: 'currency',
    currency: info.code,
    maximumFractionDigits: 0,
  }).format(valor);
  return `${formatted} ${code}`;
};

export const formatCurrencyShort = (value: number): string => {
  const abs = Math.abs(value);
  let numStr = '';
  if (abs >= 1000000) {
    numStr = `${(value / 1000000).toLocaleString('es-CO', {
      maximumFractionDigits: 1,
    })}M`;
  } else if (abs >= 1000) {
    numStr = `${(value / 1000).toLocaleString('es-CO', {
      maximumFractionDigits: 0,
    })}K`;
  } else {
    numStr = value.toLocaleString('es-CO', { maximumFractionDigits: 0 });
  }

  if (!isConfigured) {
    return numStr;
  }
  const code = memoryCurrency;
  const info = CURRENCIES[code as keyof typeof CURRENCIES] || CURRENCIES.COP;
  return `${info.symbol}${numStr} ${code}`;
};
