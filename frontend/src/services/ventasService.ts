import { apiFetch } from './apiService';

export type VentaClientePayload = {
  nombre: string;
  documento: string;
  telefono?: string;
  detalle?: string;
  rapido?: boolean;
};

export type VentaItemPayload = {
  tipoCafeId: string;
  calidadId: string;
  cantidadKg: number;
  precioKg: number;
};

export type CreateVentaPayload = {
  fecha?: string;
  deviceId: string;
  localId: string;
  cliente: VentaClientePayload;
  items: VentaItemPayload[];
};

export type CreateVentaResponse = {
  venta: {
    referenciaId: string;
    fecha: string;
    totalKg: number;
    totalVenta: number;
    cliente: {
      nombre: string;
      documento: string;
      telefono: string | null;
      detalle: string | null;
      rapido: boolean;
    };
  };
  items: Array<{
    tipoCafeId: string;
    calidadId: string;
    codigo: string;
    tipoCafe: string;
    calidad: string;
    cantidadKg: number;
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
