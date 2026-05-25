import { IsObject, IsOptional } from 'class-validator';

export class AiBusinessContextDto {
  @IsOptional()
  @IsObject()
  inventario?: {
    totalKg?: number;
    capacidadUsada?: string;
    sublotesDisponibles?: number;
    sublotesAntiguos?: number;
  };

  @IsOptional()
  @IsObject()
  ventas?: {
    totalMes?: number;
    totalKg?: number;
    cantidadVentas?: number;
  };

  @IsOptional()
  @IsObject()
  compras?: {
    totalMes?: number;
    totalKg?: number;
    cantidadCompras?: number;
  };

  @IsOptional()
  @IsObject()
  gastos?: {
    totalMes?: number;
    principales?: string[];
  };

  @IsOptional()
  @IsObject()
  secado?: {
    activos?: number;
    mermaKg?: number;
  };

  @IsOptional()
  @IsObject()
  offline?: {
    usandoDatosCacheados?: boolean;
    pendientesSync?: number;
  };
}

export function sanitizeAiText(value: unknown, maxLength = 500) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[correo omitido]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, '[token oculto]')
    .replace(/\b\d{7,15}\b/g, '[numero omitido]')
    .replace(
      /password|contrase[ñn]a|token|api\s*key|apikey|secret|c[eé]dula|documento|tel[eé]fono|celular|correo|email|direcci[oó]n/gi,
      '[dato sensible]',
    )
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLength);
}

export function sanitizeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function sanitizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => sanitizeAiText(item, 80))
    .filter(Boolean)
    .slice(0, 5);
}

export function sanitizeBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}
