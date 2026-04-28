export type GastoTipo =
  | 'TRANSPORTE'
  | 'COMIDA'
  | 'SECADO'
  | 'CARGUE'
  | 'DESCARGUE'
  | 'OTROS';

export type GastoEstadoPago = 'PAGADO' | 'PENDIENTE';
export type GastoAplicaA = 'GENERAL' | 'SUBLOTES';

export type GastoDraftPayload = {
  id: string;
  concepto: string;
  descripcion: string;
  monto: number;
  fecha: string;
  tipo: GastoTipo;
  estadoPago: GastoEstadoPago;
  aplicaA: GastoAplicaA;
  lotesIds: string[];
  creadoEn: string;
};

const STORAGE_KEY = 'cafesmart-gastos-locales-v1';

function readStorage() {
  if (typeof window === 'undefined') return [] as GastoDraftPayload[];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [] as GastoDraftPayload[];
    const parsed = JSON.parse(raw) as GastoDraftPayload[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as GastoDraftPayload[];
  }
}

function writeStorage(items: GastoDraftPayload[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function registrarGastoLocal(payload: Omit<GastoDraftPayload, 'creadoEn'>) {
  const current = readStorage();
  const nextItem: GastoDraftPayload = {
    ...payload,
    creadoEn: new Date().toISOString(),
  };
  writeStorage([nextItem, ...current]);
  return nextItem;
}

