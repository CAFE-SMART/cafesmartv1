import { apiFetch } from './apiService';

export type VentaClientePayload = {
  nombre: string;
  documento: string;
  telefono?: string;
  detalle?: string;
  rapido?: boolean;
};

export type VentaDetallePayload = {
  subloteId: string;
  pesoVendido: number;
  precioKg: number;
};

export type CreateVentaPayload = {
  fecha?: string;
  deviceId: string;
  localId: string;
  clienteId?: string;
  detalles: VentaDetallePayload[];
};

export type CreateVentaResponse = {
  venta: {
    id: string;
    fecha: string;
    totalVenta: number;
    localId: string;
    deviceId: string;
    clienteId: string | null;
  };
  detalles: Array<{
    id: string;
    subloteId: string;
    pesoVendido: number;
    precioKg: number;
    subtotal: number;
  }>;
};

export async function crearVenta(payload: CreateVentaPayload) {
  return apiFetch('/ventas', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<CreateVentaResponse>;
}
