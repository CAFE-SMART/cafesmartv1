export type ApiErrorBody = {
  code: string;
  message: string;
  field?: string | null;
  details?: unknown;
  error?: string;
};

export function apiError(
  code: string,
  message: string,
  extras: Omit<ApiErrorBody, 'code' | 'message'> = {},
): ApiErrorBody {
  return {
    code,
    message,
    ...extras,
  };
}

export function defaultCodeForHttpStatus(status: number): string {
  if (status === 400) return 'VALIDATION_ERROR';
  if (status === 401) return 'AUTH_UNAUTHORIZED';
  if (status === 403) return 'AUTH_FORBIDDEN';
  if (status === 404) return 'RESOURCE_NOT_FOUND';
  if (status === 409) return 'BUSINESS_CONFLICT';
  if (status >= 500) return 'INTERNAL_SERVER_ERROR';
  return 'REQUEST_ERROR';
}

export function validationCodeForField(field: string): string {
  if (field.includes('pesoInicial')) return 'COMPRA_CANTIDAD_INVALIDA';
  if (field.includes('precioKg') && field.includes('detalles'))
    return 'VENTA_PRECIO_INVALIDO';
  if (field.includes('precioKg')) return 'COMPRA_PRECIO_INVALIDO';
  if (field.includes('tipoCafeId')) return 'COMPRA_TIPO_CAFE_INVALIDO';
  if (field.includes('calidadId')) return 'COMPRA_CALIDAD_INVALIDA';
  if (field.includes('pesoVendido')) return 'VENTA_CANTIDAD_INVALIDA';
  if (field.includes('subloteId')) return 'VENTA_SUBLOTE_INVALIDO';
  if (field.includes('output') || field.includes('humedad'))
    return 'SECADO_CANTIDAD_INVALIDA';
  return 'DATOS_OBLIGATORIOS_INCOMPLETOS';
}
