import { SecadoResultsDto } from './dto/secado-results.dto';

export class SecadoValidacionCriticaError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

function normalizarKg(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export function validarResultadosSecadoCriticos(
  inputKg: number,
  dto: SecadoResultsDto,
): void {
  const outputBuenoKg = normalizarKg(dto.outputBuenoKg);
  const outputRegularKg = normalizarKg(dto.outputRegularKg);
  const outputMaloKg = normalizarKg(dto.outputMaloKg ?? 0);
  const totalSalida = normalizarKg(
    outputBuenoKg + outputRegularKg + outputMaloKg,
  );
  const entrada = normalizarKg(inputKg);

  if (!Number.isFinite(entrada) || entrada <= 0) {
    throw new SecadoValidacionCriticaError(
      'SECADO_ENTRADA_INVALIDA',
      'La cantidad de entrada del secado debe ser mayor a 0.',
    );
  }

  if (
    !Number.isFinite(outputBuenoKg) ||
    !Number.isFinite(outputRegularKg) ||
    !Number.isFinite(outputMaloKg) ||
    outputBuenoKg < 0 ||
    outputRegularKg < 0 ||
    outputMaloKg < 0
  ) {
    throw new SecadoValidacionCriticaError(
      'SECADO_CANTIDAD_INVALIDA',
      'Las cantidades de salida deben ser numeros mayores o iguales a 0.',
    );
  }

  if (totalSalida <= 0) {
    throw new SecadoValidacionCriticaError(
      'SECADO_CANTIDAD_INVALIDA',
      'Registra por lo menos una salida seca.',
    );
  }

  if (totalSalida > entrada) {
    throw new SecadoValidacionCriticaError(
      'SECADO_SALIDA_MAYOR_ENTRADA',
      'La salida no puede superar el peso de entrada.',
      { inputKg: entrada, outputKg: totalSalida },
    );
  }
}
