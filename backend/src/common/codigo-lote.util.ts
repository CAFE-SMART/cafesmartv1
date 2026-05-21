/**
 * Utility para generar codigos unicos de lote con formato TIPO_CALIDAD_NUMERO.
 * Ejemplo: VB-01 (Verde Bueno), SB-01 (Seco Bueno), SR-02 (Seco Regular).
 */

function normalizarCodigo(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

/**
 * Genera el prefijo de codigo basado en tipo de cafe y calidad.
 */
export function generarPrefijoCodigo(
  tipoCafeNombre: string,
  calidadNombre: string,
): string {
  const tipo = normalizarCodigo(tipoCafeNombre);
  const calidad = normalizarCodigo(calidadNombre);

  const letraTipo = tipo.includes('PASILLA')
    ? 'P'
    : tipo.includes('SECO')
      ? 'S'
      : tipo.includes('VERDE')
        ? 'V'
        : tipo.charAt(0) || 'X';

  const letraCalidad = calidad.includes('REGULAR')
    ? 'R'
    : calidad.includes('MALO') || calidad.includes('MALA') || calidad.includes('BAJO')
      ? 'M'
      : calidad.includes('BUENO') || calidad.includes('BUENA') || calidad.includes('ALTO')
        ? 'B'
        : calidad.charAt(0) || 'X';

  return `${letraTipo}${letraCalidad}`;
}

export function formatearNumeroSecuencia(
  numero: number,
  digitos: number = 2,
): string {
  return numero.toString().padStart(digitos, '0');
}

export function generarCodigoLote(
  tipoCafeNombre: string,
  calidadNombre: string,
  secuencia: number,
): string {
  const prefijo = generarPrefijoCodigo(tipoCafeNombre, calidadNombre);
  const numero = formatearNumeroSecuencia(secuencia);
  return `${prefijo}-${numero}`;
}

export const PARAM_SECUENCIAS_LOTE = 'SECUENCIAS_CODIGOS_LOTE';

/**
 * Obtiene la siguiente secuencia para un codigo especifico y genera el codigo unico.
 */
export function generarSiguienteCodigo(
  secuenciasMap: Record<string, number> | null,
  tipoCafeNombre: string,
  calidadNombre: string,
): { codigo: string; nuevaSecuencia: number } {
  const prefijo = generarPrefijoCodigo(tipoCafeNombre, calidadNombre);
  const secuencias = secuenciasMap ?? {};
  const siguienteSeq = (secuencias[prefijo] ?? 0) + 1;
  return {
    codigo: generarCodigoLote(tipoCafeNombre, calidadNombre, siguienteSeq),
    nuevaSecuencia: siguienteSeq,
  };
}
