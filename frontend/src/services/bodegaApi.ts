export type ConfiguracionBodega = {
  nombreBodega: string;
  capacidadKg: number;
  updatedAt: string;
};

/**
 * Obtiene la configuración de bodega del servidor.
 */
export async function obtenerConfiguracionBodega(): Promise<ConfiguracionBodega> {
  const response = await fetch('/api/bodega/configuracion', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Error obteniendo configuración: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}

/**
 * Guarda la configuración de bodega en el servidor.
 */
export async function guardarConfiguracionBodega(
  config: Omit<ConfiguracionBodega, 'updatedAt'>,
): Promise<ConfiguracionBodega> {
  const response = await fetch('/api/bodega/configuracion', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      nombreBodega: config.nombreBodega,
      capacidadKg: config.capacidadKg,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message ||
        `Error guardando configuración: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}
