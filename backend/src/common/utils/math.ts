/**
 * Utilidades numericas para operar montos y pesos con precision estable a dos decimales.
 */
export function aCentiUnidades(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100);
}

export function desdeCentiUnidades(valor: number): number {
  return valor / 100;
}

export function normalizarADosDecimales(valor: number): number {
  return desdeCentiUnidades(aCentiUnidades(valor));
}
