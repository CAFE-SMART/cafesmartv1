/**
 * Utility para generar códigos únicos de lote con formato TIPO_CALIDAD_NUMERO
 * Ejemplo: VB-01 (Verde Bueno), SB-01 (Seco Bueno), SR-02 (Seco Regular)
 */

/**
 * Genera el prefijo de código basado en tipo de café y calidad
 * @param tipoCafeNombre Nombre del tipo de café (VERDE, SECO, TRILLADO, PASILLA)
 * @param calidadNombre Nombre de la calidad (BUENO, REGULAR, MALO)
 * @returns Prefijo de 2 caracteres (ej. VB para Verde Bueno)
 */
export function generarPrefijoCodigo(
  tipoCafeNombre: string,
  calidadNombre: string,
): string {
  const prefijosTipo: Record<string, string> = {
    VERDE: 'V',
    SECO: 'S',
    TRILLADO: 'T',
    PASILLA: 'P',
  };
  const letraTipo = prefijosTipo[tipoCafeNombre.toUpperCase()] ?? 'X';

  const prefijosCalidad: Record<string, string> = {
    BUENO: 'B',
    REGULAR: 'R',
    MALO: 'M',
  };
  const letraCalidad = prefijosCalidad[calidadNombre.toUpperCase()] ?? 'X';

  return `${letraTipo}${letraCalidad}`;
}

export function formatearNumeroSecuencia(
  numero: number,
  digitos: number = 2,
): string {
  return numero.toString().padStart(digitos, '0').slice(-digitos);
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
 * Obtiene la siguiente secuencia para un código específico
 * y genera el código único
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
