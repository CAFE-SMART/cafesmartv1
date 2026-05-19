import type { ClienteSortMode } from './types';

export const LIMITE = 6;

export const CLIENTE_SORT_OPTIONS: Array<{ value: ClienteSortMode; label: string }> = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'oldest', label: 'Más antiguos' },
  { value: 'az', label: 'A-Z' },
  { value: 'za', label: 'Z-A' },
  { value: 'doc-asc', label: 'Número menor a mayor' },
  { value: 'doc-desc', label: 'Número mayor a menor' },
];

export const DOCUMENT_TYPE_OPTIONS = [
  { value: 'CEDULA' as const, label: 'Cédula' },
  { value: 'NIT' as const, label: 'NIT' },
];

export const VENTA_FILTRO_TODOS = 'TODOS';
export const VENTA_DRAFT_STORAGE_KEY = 'cafe-smart:venta-draft:v1';

export const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export const WEEKDAYS_ES = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];

export const MAX_NOMBRE_CARACTERES = 60 as const;
export const MIN_NOMBRE_CARACTERES = 2 as const;
