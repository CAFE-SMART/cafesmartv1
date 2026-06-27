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
  productorId?: string;
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

export type NivelCapacidadCompra =
  | 'normal'
  | 'alerta'
  | 'exceso'
  | 'sin_validacion'
  | 'requiere_configuracion';

export type EstadoCapacidadCompra = {
  validada: boolean;
  nivel: NivelCapacidadCompra;
  mensaje: string;
  capacidadBodegaKg?: number;
  inventarioActualKg?: number;
  capacidadUsadaKg?: number;
  capacidadRestanteKg?: number;
  porcentajeOcupacion?: number;
  excesoKg?: number;
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
  capacidad?: EstadoCapacidadCompra;
};

export async function obtenerCatalogosCompra() {
  return apiFetch('/compras/catalogos') as Promise<CatalogosCompra>;
}

export async function listarCompras() {
  return apiFetch('/compras') as Promise<CompraListadoItem[]>;
}

export async function crearCompra(payload: CreateCompraPayload) {
  const response = (await apiFetch('/compras', {
    method: 'POST',
    body: JSON.stringify(payload),
  })) as CreateCompraResponse | CreateCompraResponse['compra'];

  if ('compra' in response) {
    return response;
  }

  return {
    compra: response,
    sublotes: [],
  };
}

export async function validarCapacidadCompra(payload: CreateCompraPayload) {
  return apiFetch('/compras/validar-capacidad', {
    method: 'POST',
    body: JSON.stringify(payload),
  }) as Promise<EstadoCapacidadCompra>;
}

export async function eliminarCompra(id: string) {
  return apiFetch(`/compras/${id}`, {
    method: 'DELETE',
  }) as Promise<void>;
}

export async function crearTipoCafe(nombre: string) {
  return apiFetch('/compras/catalogos/tipo-cafe', {
    method: 'POST',
    body: JSON.stringify({ nombre }),
  }) as Promise<CatalogoItem>;
}

export async function editarTipoCafe(id: string, nombre: string) {
  return apiFetch(`/compras/catalogos/tipo-cafe/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ nombre }),
  }) as Promise<CatalogoItem>;
}

export async function eliminarTipoCafe(id: string) {
  return apiFetch(`/compras/catalogos/tipo-cafe/${id}`, {
    method: 'DELETE',
  }) as Promise<void>;
}

export async function crearCalidad(nombre: string) {
  return apiFetch('/compras/catalogos/calidad', {
    method: 'POST',
    body: JSON.stringify({ nombre }),
  }) as Promise<CatalogoItem>;
}

export async function editarCalidad(id: string, nombre: string) {
  return apiFetch(`/compras/catalogos/calidad/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ nombre }),
  }) as Promise<CatalogoItem>;
}

export async function eliminarCalidad(id: string) {
  return apiFetch(`/compras/catalogos/calidad/${id}`, {
    method: 'DELETE',
  }) as Promise<void>;
}
