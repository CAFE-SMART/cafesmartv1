import { apiFetch } from './apiService';

export type CatalogoItem = {
  id: string;
  nombre: string;
};

export type CatalogosCompra = {
  tiposCafe: CatalogoItem[];
  calidades: CatalogoItem[];
};

export type CompraListadoItem = {
  id: string;
  fecha: string;
  totalCompra: number;
  totalSublotes: number;
  creadoEn: string;
  sublotes: {
    id: string;
    tipoCafeId: string;
    tipoCafe: string;
    calidadId: string;
    calidad: string;
    pesoInicial: number;
    pesoActual: number;
    precioKg: number;
  }[];
};

export type CreateCompraPayload = {
  fecha?: string;
  deviceId: string;
  localId: string;
  sublotes: {
    tipoCafeId: string;
    calidadId: string;
    pesoInicial: number;
    precioKg: number;
    deviceId: string;
    localId: string;
  }[];
};

export type CreateCompraResponse = {
  compra: {
    id: string;
    fecha: string;
    totalCompra: number;
  };
  sublotes: {
    id: string;
    pesoInicial: number;
    pesoActual: number;
    precioKg: number;
  }[];
  warning?: string;
  exceso?: number;
};

export async function obtenerCatalogosCompra() {
  return apiFetch('/compras/catalogos') as Promise<CatalogosCompra>;
}

export async function listarCompras() {
  return apiFetch('/compras') as Promise<CompraListadoItem[]>;
}

export async function crearCompra(payload: CreateCompraPayload) {
  return apiFetch('/compras', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<CreateCompraResponse>;
}
