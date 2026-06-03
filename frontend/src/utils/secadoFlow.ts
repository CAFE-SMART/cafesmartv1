import type {
  LoteDetalle,
  LoteResumen,
  SubloteDetalle,
} from '../services/lotesService';

let secadoSessionsMemory: SecadoSession[] = [];
const SECADO_SESSIONS_STORAGE_KEY = 'cafe-smart:secado-sessions:v1';
const SECADO_CANCELLATIONS_STORAGE_KEY = 'cafe-smart:secado-cancellations:v1';
const SECADO_PROCESS_TYPE_ID = 'virtual-en-secado';
const SECADO_PROCESS_QUALITY_ID = 'virtual-en-proceso';
const SECADO_PROCESS_TYPE = 'EN SECADO';
const SECADO_PROCESS_QUALITY = 'EN PROCESO';
export const VISUAL_CAPACITY_KG = 3000;

export type SecadoEstado = 'DRAFT' | 'IN_PROCESS' | 'READY' | 'COMPLETED';
export type SecadoModo = 'TOTAL' | 'PARCIAL';

export type SecadoSubloteSeleccionado = {
  id: string;
  codigo?: string;
  etiqueta: string;
  sourceLoteId?: string;
  pesoActual: number;
  pesoSeleccionadoKg?: number;
  pesoDisponible?: number;
  modoSecado?: SecadoModo;
  humedad: number | null;
  fechaIngreso: string;
  diasEnBodega: number;
};

export type SecadoSession = {
  id: string;
  estado: SecadoEstado;
  loteId: string;
  loteCodigo: string;
  tipoCafeId: string;
  tipoCafe: string;
  calidadId: string;
  calidad: string;
  modoSecado: SecadoModo;
  fechaLote: string;
  sublotes: SecadoSubloteSeleccionado[];
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  outputBuenoKg: number;
  outputBuenoHumedad: number | null;
  outputRegularKg: number;
  outputRegularHumedad: number | null;
  outputMaloKg?: number;
  outputMaloHumedad?: number | null;
  mermaKg: number;
  rendimientoPct: number;
};

type ResultadoSecadoPayload = {
  outputBuenoKg: number;
  outputBuenoHumedad: number | null;
  outputRegularKg: number;
  outputRegularHumedad: number | null;
  outputMaloKg?: number;
  outputMaloHumedad?: number | null;
  completedAt?: string;
};

export class SecadoValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'SecadoValidationError';
  }
}

function keyOf(value: string) {
  return value.trim().toUpperCase();
}

function nowIso() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0),
  ).toISOString();
}

function isLocalDateValue(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseDateForBusinessDay(value: string) {
  if (isLocalDateValue(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  return new Date(value);
}

function normalizeBusinessDateValue(value: string | undefined) {
  if (!value) return undefined;

  if (isLocalDateValue(value)) {
    return value;
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value.slice(0, 10);
  }

  return undefined;
}

function safeNumber(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(1)) : 0;
}

export function getSecadoSelectedKg(sublote: SecadoSubloteSeleccionado) {
  const selected = sublote.pesoSeleccionadoKg;
  if (Number.isFinite(selected) && (selected ?? 0) > 0) {
    return safeNumber(selected as number);
  }

  if (sublote.modoSecado === 'TOTAL') {
    return safeNumber(sublote.pesoActual);
  }

  throw new SecadoValidationError(
    'SECADO_PESO_SELECCIONADO_FALTANTE',
    'No se encontró el peso seleccionado para este sublote.',
    { subloteId: sublote.id },
  );
}

export function getSecadoAvailableKg(sublote: SecadoSubloteSeleccionado) {
  const available = sublote.pesoDisponible ?? sublote.pesoActual;
  return safeNumber(available);
}

export function validarIntegridadSesionSecado(session: SecadoSession) {
  if (session.modoSecado !== 'TOTAL' && session.modoSecado !== 'PARCIAL') {
    throw new SecadoValidationError(
      'SECADO_SESION_INCONSISTENTE',
      'La sesión guardada no es consistente. Inicia el proceso nuevamente.',
      { sessionId: session.id, modoSecado: session.modoSecado },
    );
  }

  for (const sublote of session.sublotes) {
    const modoSublote = sublote.modoSecado ?? session.modoSecado;
    const pesoDisponible = getSecadoAvailableKg(sublote);
    const pesoSeleccionado = Number(sublote.pesoSeleccionadoKg);

    if (!Number.isFinite(pesoDisponible) || pesoDisponible <= 0) {
      throw new SecadoValidationError(
        'SECADO_SESION_INCONSISTENTE',
        'La sesión guardada no es consistente. Inicia el proceso nuevamente.',
        { sessionId: session.id, subloteId: sublote.id, pesoDisponible },
      );
    }

    if (modoSublote !== session.modoSecado) {
      throw new SecadoValidationError(
        'SECADO_SESION_INCONSISTENTE',
        'La sesión guardada no es consistente. Inicia el proceso nuevamente.',
        {
          sessionId: session.id,
          subloteId: sublote.id,
          modoSecado: session.modoSecado,
          modoSublote,
        },
      );
    }

    if (modoSublote === 'PARCIAL') {
      if (!Number.isFinite(pesoSeleccionado) || pesoSeleccionado <= 0) {
        throw new SecadoValidationError(
          'SECADO_PESO_SELECCIONADO_FALTANTE',
          'Falta el peso seleccionado en uno de los sublotes.',
          { sessionId: session.id, subloteId: sublote.id },
        );
      }

      if (pesoSeleccionado > pesoDisponible) {
        throw new SecadoValidationError(
          'SECADO_ENTRADA_SUPERA_DISPONIBLE',
          'El peso seleccionado supera el peso disponible.',
          {
            sessionId: session.id,
            subloteId: sublote.id,
            disponibleKg: pesoDisponible,
            solicitadoKg: pesoSeleccionado,
          },
        );
      }
    }

    if (modoSublote === 'TOTAL') {
      if (
        Number.isFinite(pesoSeleccionado) &&
        pesoSeleccionado > 0 &&
        pesoSeleccionado < pesoDisponible
      ) {
        throw new SecadoValidationError(
          'SECADO_SESION_INCONSISTENTE',
          'La sesión guardada no es consistente. Inicia el proceso nuevamente.',
          {
            sessionId: session.id,
            subloteId: sublote.id,
            disponibleKg: pesoDisponible,
            seleccionadoKg: pesoSeleccionado,
          },
        );
      }

      if (Number.isFinite(pesoSeleccionado) && pesoSeleccionado > pesoDisponible) {
        throw new SecadoValidationError(
          'SECADO_ENTRADA_SUPERA_DISPONIBLE',
          'El peso seleccionado supera el peso disponible.',
          {
            sessionId: session.id,
            subloteId: sublote.id,
            disponibleKg: pesoDisponible,
            solicitadoKg: pesoSeleccionado,
          },
        );
      }
    }
  }
}

function round2(value: number) {
  return Number.isFinite(value)
    ? Math.round((value + Number.EPSILON) * 100) / 100
    : Number.NaN;
}

function generateId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readStorage() {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(SECADO_SESSIONS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          secadoSessionsMemory = parsed.map(normalizeStoredSession);
        }
      }
    } catch {
      return secadoSessionsMemory;
    }
  }

  return secadoSessionsMemory;
}

function normalizeStoredSession(session: SecadoSession): SecadoSession {
  const modoSecado = session.modoSecado ?? 'TOTAL';
  return {
    ...session,
    modoSecado,
    sublotes: session.sublotes.map((sublote) => ({
      ...sublote,
      modoSecado: sublote.modoSecado ?? modoSecado,
      pesoSeleccionadoKg:
        sublote.pesoSeleccionadoKg ??
        (modoSecado === 'TOTAL' ? sublote.pesoActual : undefined),
      pesoDisponible: sublote.pesoDisponible ?? sublote.pesoActual,
    })),
  };
}

function writeStorage(sessions: SecadoSession[]) {
  secadoSessionsMemory = sessions;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(
        SECADO_SESSIONS_STORAGE_KEY,
        JSON.stringify(sessions),
      );
    } catch {
      // Mantener memoria como respaldo si el navegador bloquea localStorage.
    }
  }
}

function daysSince(value: string) {
  const now = new Date();
  const date = parseDateForBusinessDay(value);

  if (Number.isNaN(date.getTime())) return 0;

  const currentDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const targetDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );

  return Math.max(0, Math.floor((currentDay.getTime() - targetDay.getTime()) / 86400000));
}

function weightedHumidity(
  currentHumidity: number | null,
  currentWeight: number,
  nextHumidity: number | null,
  nextWeight: number,
) {
  if (nextHumidity === null || nextWeight <= 0) {
    return currentHumidity;
  }

  if (currentHumidity === null || currentWeight <= 0) {
    return Number(nextHumidity.toFixed(1));
  }

  const weighted =
    (currentHumidity * currentWeight + nextHumidity * nextWeight) /
    (currentWeight + nextWeight);

  return Number(weighted.toFixed(1));
}

function totalInputKg(session: SecadoSession) {
  return session.sublotes.reduce(
    (sum, sublote) => sum + getSecadoSelectedKg(sublote),
    0,
  );
}

function hasSelectedSublotes(session: SecadoSession) {
  return session.sublotes.length > 0 && totalInputKg(session) > 0;
}

function isActiveSession(session: SecadoSession) {
  return (
    (session.estado === 'IN_PROCESS' || session.estado === 'READY') &&
    hasSelectedSublotes(session)
  );
}

function getInventorySecadoSessions() {
  const seen = new Set<string>();

  return readStorage().filter((session) => {
    if (!isActiveSession(session)) return false;
    if (seen.has(session.id)) return false;
    seen.add(session.id);
    return true;
  });
}

function hasSourceSublotes(session: SecadoSession, sublotes: SubloteDetalle[]) {
  const ids = new Set(sublotes.map((sublote) => sublote.id));
  return session.sublotes.some((sublote) => ids.has(sublote.id));
}

function hasSecadoOutput(sublotes: SubloteDetalle[], generatedId: string) {
  return sublotes.some((sublote) => sublote.id === generatedId);
}

function isDryLot(detail: LoteDetalle) {
  return keyOf(detail.lote.tipoCafe) === 'SECO';
}

function appendGeneratedDryOutputs(
  sublotes: SubloteDetalle[],
  sessions: SecadoSession[],
  quality: string,
) {
  const generated = sessions.flatMap((session) =>
    buildGeneratedOutputs(session).filter(
      (sublote) =>
        keyOf(sublote.calidad) === quality &&
        !hasSecadoOutput(sublotes, sublote.id),
    ),
  );

  return [...sublotes, ...generated];
}

function getFullyRemovedSublotesByLot(sessions: SecadoSession[]) {
  const removedBySublote = new Map<
    string,
    {
      loteId: string;
      subloteId: string;
      removedKg: number;
      disponibleKg: number;
      hasHumidity: boolean;
    }
  >();

  for (const session of sessions) {
    for (const sublote of session.sublotes) {
      const loteId = sublote.sourceLoteId ?? session.loteId;
      const key = `${loteId}::${sublote.id}`;
      const current = removedBySublote.get(key) ?? {
        loteId,
        subloteId: sublote.id,
        removedKg: 0,
        disponibleKg: sublote.pesoDisponible ?? sublote.pesoActual,
        hasHumidity: sublote.humedad !== null,
      };

      current.removedKg = safeNumber(
        current.removedKg + getSecadoSelectedKg(sublote),
      );
      current.disponibleKg = Math.max(
        current.disponibleKg,
        sublote.pesoDisponible ?? sublote.pesoActual,
      );
      current.hasHumidity = current.hasHumidity || sublote.humedad !== null;
      removedBySublote.set(key, current);
    }
  }

  const fullyRemovedByLot = new Map<
    string,
    { sublotes: Set<string>; withHumidity: Set<string> }
  >();

  for (const item of removedBySublote.values()) {
    if (item.disponibleKg <= 0 || item.removedKg < item.disponibleKg - 0.01) {
      continue;
    }

    const current = fullyRemovedByLot.get(item.loteId) ?? {
      sublotes: new Set<string>(),
      withHumidity: new Set<string>(),
    };
    current.sublotes.add(item.subloteId);

    if (item.hasHumidity) {
      current.withHumidity.add(item.subloteId);
    }

    fullyRemovedByLot.set(item.loteId, current);
  }

  return fullyRemovedByLot;
}

function isSameOrAfter(value: string, reference: string) {
  const date = parseDateForBusinessDay(value);
  const referenceDate = parseDateForBusinessDay(reference);

  if (Number.isNaN(date.getTime()) || Number.isNaN(referenceDate.getTime())) {
    return true;
  }

  return date.getTime() >= referenceDate.getTime();
}

function canApplySessionToLot(session: SecadoSession, lot: LoteResumen) {
  const removedKg = totalInputKg(session);
  const startedAfterLot = isSameOrAfter(
    session.startedAt,
    lot.fechaPrimerIngreso,
  );

  return (
    startedAfterLot &&
    session.sublotes.length <= lot.sublotes &&
    removedKg <= lot.pesoActual
  );
}

function buildGeneratedOutputs(session: SecadoSession) {
  const completedAt = session.completedAt ?? session.updatedAt;
  const originCode =
    session.sublotes[0]?.codigo?.trim() ||
    session.sublotes[0]?.etiqueta?.trim() ||
    null;

  const outputs = [
    {
      quality: 'BUENO',
      kg: session.outputBuenoKg,
      humidity: session.outputBuenoHumedad,
      id: `secado-${session.id}-bueno`,
      label: `SC-${session.loteCodigo}-B`,
      qualityId: 'virtual-bueno',
    },
    {
      quality: 'REGULAR',
      kg: session.outputRegularKg,
      humidity: session.outputRegularHumedad,
      id: `secado-${session.id}-regular`,
      label: `SC-${session.loteCodigo}-R`,
      qualityId: 'virtual-regular',
    },
    {
      quality: 'MALO',
      kg: session.outputMaloKg ?? 0,
      humidity: session.outputMaloHumedad ?? null,
      id: `secado-${session.id}-malo`,
      label: `SC-${session.loteCodigo}-M`,
      qualityId: 'virtual-malo',
    },
  ].filter((item) => item.kg > 0);

  return outputs.map((item) => ({
    id: item.id,
    etiqueta: item.label,
    tipoCafeId: 'virtual-seco',
    tipoCafe: 'SECO',
    calidadId: item.qualityId,
    calidad: item.quality,
    pesoInicial: item.kg,
    pesoActual: item.kg,
    precioKg: 0,
    humedad: item.humidity,
    factor: null,
    fechaIngreso: completedAt,
    diasEnBodega: daysSince(completedAt),
    creadoEn: completedAt,
    codigoOrigen: originCode,
    procesoOrigen: originCode ? 'SECADO' : null,
    costoTotal: 0,
    totalVentas: 0,
    pesoVendido: 0,
    totalGastos: 0,
    mermaKg: 0,
    mermaPorcentaje: 0,
    mermaValor: 0,
    utilidadNeta: 0,
    costoPorKg: 0,
  })) satisfies SubloteDetalle[];
}

function buildProcessLot(session: SecadoSession) {
  const inputKg = totalInputKg(session);
  const oldestDate =
    session.sublotes.map((sublote) => sublote.fechaIngreso).sort()[0] ??
    session.startedAt;

  return {
    id: `secado-proceso-${session.id}`,
    codigo: `Secado ${session.loteCodigo}`,
    tipoCafeId: SECADO_PROCESS_TYPE_ID,
    tipoCafe: SECADO_PROCESS_TYPE,
    calidadId: SECADO_PROCESS_QUALITY_ID,
    calidad: SECADO_PROCESS_QUALITY,
    sublotes: session.sublotes.length,
    sublotesConHumedad: session.sublotes.filter(
      (sublote) => sublote.humedad !== null,
    ).length,
    pesoInicial: safeNumber(inputKg),
    pesoActual: safeNumber(inputKg),
    precioPromedioKg: 0,
    humedadPromedio: null,
    fecha: session.startedAt,
    fechaPrimerIngreso: oldestDate,
    fechaUltimoIngreso: session.startedAt,
    diasEnBodegaMin: daysSince(session.startedAt),
    diasEnBodegaMax: daysSince(oldestDate),
    creadoEn: session.startedAt,
    totalVentas: 0,
    totalGastos: 0,
    utilidadNeta: 0,
    mermaValor: 0,
    mermaKg: session.mermaKg,
  } satisfies LoteResumen;
}

function rebuildLotFromSublotes(
  reference: LoteResumen,
  sublotes: SubloteDetalle[],
  override?: Partial<LoteResumen>,
) {
  const pesoActual = sublotes.reduce(
    (sum, sublote) => sum + sublote.pesoActual,
    0,
  );
  const pesoInicial = sublotes.reduce(
    (sum, sublote) => sum + sublote.pesoInicial,
    0,
  );
  const sublotesConHumedad = sublotes.filter(
    (sublote) => sublote.humedad !== null,
  ).length;

  const sublotesConDato = sublotes.filter(
    (sublote) => sublote.humedad !== null && sublote.pesoActual > 0,
  );

  const humedadPromedio =
    sublotesConDato.length === 0
      ? null
      : Number(
          (
            sublotesConDato.reduce(
              (sum, sublote) =>
                sum + (sublote.humedad as number) * sublote.pesoActual,
              0,
            ) /
            sublotesConDato.reduce(
              (sum, sublote) => sum + sublote.pesoActual,
              0,
            )
          ).toFixed(1),
        );

  const fechas = sublotes.map((sublote) => sublote.fechaIngreso);
  const primerIngreso =
    fechas.length > 0 ? [...fechas].sort()[0] : reference.fechaPrimerIngreso;
  const ultimoIngreso =
    fechas.length > 0
      ? [...fechas].sort()[fechas.length - 1]
      : reference.fechaUltimoIngreso;

  const dias = sublotes.map((sublote) => daysSince(sublote.fechaIngreso));

  return {
    ...reference,
    ...override,
    sublotes: sublotes.length,
    sublotesConHumedad,
    pesoActual: safeNumber(pesoActual),
    pesoInicial: safeNumber(pesoInicial),
    humedadPromedio,
    fechaPrimerIngreso: primerIngreso,
    fechaUltimoIngreso: ultimoIngreso,
    fecha: ultimoIngreso,
    diasEnBodegaMin: dias.length > 0 ? Math.min(...dias) : 0,
    diasEnBodegaMax: dias.length > 0 ? Math.max(...dias) : 0,
  } satisfies LoteResumen;
}

export function loadSecadoSessions() {
  return readStorage();
}

export function clearSecadoSessions() {
  writeStorage([]);
}

export function getSecadoSession(sessionId: string) {
  return readStorage().find((session) => session.id === sessionId) ?? null;
}

export function getActiveSecadoSession() {
  return readStorage().find((session) => isActiveSession(session)) ?? null;
}

export function getActiveSecadoSessions() {
  return readStorage().filter((session) => isActiveSession(session));
}

export function getActiveSecadoSessionForLot(lotId: string) {
  return (
    readStorage().find(
      (session) => session.loteId === lotId && isActiveSession(session),
    ) ?? null
  );
}

export function getActiveSecadoBlockedSubloteIds() {
  return new Set(
    readStorage()
      .filter((session) => isActiveSession(session))
      .flatMap((session) => session.sublotes.map((sublote) => sublote.id)),
  );
}

export function getActiveSecadoBlockedKgByLot() {
  const blockedByLot = new Map<string, number>();

  for (const session of readStorage().filter((item) => isActiveSession(item))) {
    const blockedKg = totalInputKg(session);
    blockedByLot.set(
      session.loteId,
      safeNumber((blockedByLot.get(session.loteId) ?? 0) + blockedKg),
    );
  }

  return blockedByLot;
}

export function startSecado(detalle: LoteDetalle, selectedIds: string[]) {
  const selectedSublotes = detalle.sublotes.filter((sublote) =>
    selectedIds.includes(sublote.id),
  );
  const sessions = readStorage();

  if (selectedSublotes.length === 0) {
    throw new Error('Selecciona al menos un sublote para iniciar secado.');
  }

  const timestamp = nowIso();
  const session: SecadoSession = {
    id: generateId(),
    estado: 'IN_PROCESS',
    loteId: detalle.lote.id,
    loteCodigo: detalle.lote.codigo,
    tipoCafeId: detalle.lote.tipoCafeId,
    tipoCafe: detalle.lote.tipoCafe,
    calidadId: detalle.lote.calidadId,
    calidad: detalle.lote.calidad,
    modoSecado: 'TOTAL',
    fechaLote: detalle.lote.fechaPrimerIngreso,
    sublotes: selectedSublotes.map((sublote) => ({
      id: sublote.id,
      codigo: sublote.codigo,
      etiqueta: sublote.etiqueta,
      sourceLoteId:
        (sublote as SubloteDetalle & { sourceLoteId?: string }).sourceLoteId ??
        detalle.lote.id,
      pesoActual: sublote.pesoActual,
      pesoSeleccionadoKg: sublote.pesoActual,
      pesoDisponible: sublote.pesoActual,
      modoSecado: 'TOTAL',
      humedad: sublote.humedad,
      fechaIngreso: sublote.fechaIngreso,
      diasEnBodega: sublote.diasEnBodega,
    })),
    startedAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    outputBuenoKg: 0,
    outputBuenoHumedad: null,
    outputRegularKg: 0,
    outputRegularHumedad: null,
    outputMaloKg: 0,
    outputMaloHumedad: null,
    mermaKg: 0,
    rendimientoPct: 0,
  };

  writeStorage([session, ...sessions]);
  return session;
}

export function startSecadoWithWeights(
  detalle: LoteDetalle,
  selectedWeights: Record<string, number>,
) {
  const selectedSublotes = detalle.sublotes.filter((sublote) => {
    const weight = selectedWeights[sublote.id];
    return Number.isFinite(weight) && weight > 0;
  });
  const sessions = readStorage();

  if (selectedSublotes.length === 0) {
    throw new SecadoValidationError(
      'SECADO_ENTRADA_INVALIDA',
      'Selecciona al menos un sublote para iniciar secado.',
    );
  }

  for (const sublote of selectedSublotes) {
    const selectedWeight = Number(selectedWeights[sublote.id]);
    if (!Number.isFinite(selectedWeight) || selectedWeight <= 0) {
      throw new SecadoValidationError(
        'SECADO_ENTRADA_INVALIDA',
        'El peso seleccionado para secado no es válido.',
        { subloteId: sublote.id },
      );
    }

    if (selectedWeight > sublote.pesoActual) {
      throw new SecadoValidationError(
        'SECADO_ENTRADA_SUPERA_DISPONIBLE',
        'El peso seleccionado no puede superar el peso disponible del sublote.',
        {
          subloteId: sublote.id,
          disponibleKg: sublote.pesoActual,
          solicitadoKg: selectedWeight,
        },
      );
    }
  }

  const timestamp = nowIso();
  const session: SecadoSession = {
    id: generateId(),
    estado: 'IN_PROCESS',
    loteId: detalle.lote.id,
    loteCodigo: detalle.lote.codigo,
    tipoCafeId: detalle.lote.tipoCafeId,
    tipoCafe: detalle.lote.tipoCafe,
    calidadId: detalle.lote.calidadId,
    calidad: detalle.lote.calidad,
    modoSecado: 'PARCIAL',
    fechaLote: detalle.lote.fechaPrimerIngreso,
    sublotes: selectedSublotes.map((sublote) => ({
      id: sublote.id,
      codigo: sublote.codigo,
      etiqueta: sublote.etiqueta,
      sourceLoteId:
        (sublote as SubloteDetalle & { sourceLoteId?: string }).sourceLoteId ??
        detalle.lote.id,
      pesoActual: sublote.pesoActual,
      pesoSeleccionadoKg: safeNumber(selectedWeights[sublote.id] ?? 0),
      pesoDisponible: sublote.pesoActual,
      modoSecado: 'PARCIAL',
      humedad: sublote.humedad,
      fechaIngreso: sublote.fechaIngreso,
      diasEnBodega: sublote.diasEnBodega,
    })),
    startedAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    outputBuenoKg: 0,
    outputBuenoHumedad: null,
    outputRegularKg: 0,
    outputRegularHumedad: null,
    outputMaloKg: 0,
    outputMaloHumedad: null,
    mermaKg: 0,
    rendimientoPct: 0,
  };

  writeStorage([session, ...sessions]);
  return session;
}

export function createSecadoDraftWithWeights(
  detalle: LoteDetalle,
  selectedWeights: Record<string, number>,
) {
  const session = startSecadoWithWeights(detalle, selectedWeights);
  const sessions = readStorage();
  const nextSession = {
    ...session,
    estado: 'DRAFT' as const,
  };

  writeStorage([
    nextSession,
    ...sessions.filter(
      (item) => item.id !== session.id && item.estado !== 'DRAFT',
    ),
  ]);

  return nextSession;
}

export function startSecadoProcess(sessionId: string, startedAt?: string) {
  const sessions = readStorage();
  let found = false;
  const timestamp = startedAt ?? nowIso();
  const nextSessions = sessions.map((session) => {
    if (session.id !== sessionId) return session;
    found = true;

    if (!hasSelectedSublotes(session)) {
      throw new SecadoValidationError(
        'SECADO_ENTRADA_INVALIDA',
        'Selecciona al menos un sublote para iniciar secado.',
      );
    }

    return {
      ...session,
      estado: 'IN_PROCESS' as const,
      startedAt: timestamp,
      updatedAt: timestamp,
    };
  });

  if (!found) {
    throw new SecadoValidationError(
      'SECADO_NO_ENCONTRADO',
      'No pudimos iniciar el secado. Intenta nuevamente.',
    );
  }

  writeStorage(nextSessions);
  return nextSessions.find((session) => session.id === sessionId) ?? null;
}

function validarResultadoSecado(
  session: SecadoSession,
  payload: ResultadoSecadoPayload,
) {
  const totalEntrada = round2(totalInputKg(session));
  const outputBuenoKg = round2(payload.outputBuenoKg);
  const outputRegularKg = round2(payload.outputRegularKg);
  const outputMaloKg = round2(payload.outputMaloKg ?? 0);
  const totalSalida = round2(outputBuenoKg + outputRegularKg + outputMaloKg);

  if (!Number.isFinite(totalEntrada) || totalEntrada <= 0) {
    throw new SecadoValidationError(
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
    throw new SecadoValidationError(
      'SECADO_CANTIDAD_INVALIDA',
      'Ingresa un peso válido.',
    );
  }

  if (totalSalida <= 0) {
    throw new SecadoValidationError(
      'SECADO_CANTIDAD_INVALIDA',
      'Debes registrar al menos un resultado de secado.',
    );
  }

  if (totalSalida > totalEntrada) {
    throw new SecadoValidationError(
      'SECADO_SALIDA_MAYOR_ENTRADA',
      'El resultado supera el peso disponible del secado.',
      { inputKg: totalEntrada, outputKg: totalSalida },
    );
  }
}

export function saveSecadoResults(
  sessionId: string,
  payload: ResultadoSecadoPayload,
) {
  const sessions = readStorage();
  const nextSessions = sessions.map((session) => {
    if (session.id !== sessionId) return session;

    if (session.estado === 'DRAFT') {
      throw new SecadoValidationError(
        'SECADO_NO_INICIADO',
        'Debes iniciar el proceso antes de registrar resultados.',
      );
    }

    validarResultadoSecado(session, payload);

    const totalEntrada = totalInputKg(session);
    const totalSalida =
      payload.outputBuenoKg +
      payload.outputRegularKg +
      (payload.outputMaloKg ?? 0);
    const mermaKg = Math.max(0, totalEntrada - totalSalida);
    const rendimientoPct =
      totalEntrada > 0
        ? Number(((totalSalida / totalEntrada) * 100).toFixed(1))
        : 0;
    const completedAt = normalizeBusinessDateValue(payload.completedAt);

    return {
      ...session,
      estado: 'READY' as const,
      updatedAt: nowIso(),
      completedAt: completedAt ?? session.completedAt,
      outputBuenoKg: safeNumber(payload.outputBuenoKg),
      outputBuenoHumedad: payload.outputBuenoHumedad,
      outputRegularKg: safeNumber(payload.outputRegularKg),
      outputRegularHumedad: payload.outputRegularHumedad,
      outputMaloKg: safeNumber(payload.outputMaloKg ?? 0),
      outputMaloHumedad: payload.outputMaloHumedad ?? null,
      mermaKg: safeNumber(mermaKg),
      rendimientoPct,
    };
  });

  writeStorage(nextSessions);
  return nextSessions.find((session) => session.id === sessionId) ?? null;
}

export function finalizeSecado(sessionId: string) {
  const sessions = readStorage();
  const nextSessions = sessions.map((session) =>
    session.id === sessionId
      ? {
          ...session,
          estado: 'COMPLETED' as const,
          updatedAt: nowIso(),
          completedAt: session.completedAt ?? nowIso(),
        }
      : session,
  );

  writeStorage(nextSessions);
  return nextSessions.find((session) => session.id === sessionId) ?? null;
}

export function removeSecadoSession(sessionId: string) {
  writeStorage(readStorage().filter((session) => session.id !== sessionId));
}

export function cancelSecadoSession(sessionId: string) {
  const session = getSecadoSession(sessionId);
  if (!session) return null;

  writeStorage(readStorage().filter((item) => item.id !== sessionId));

  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(SECADO_CANCELLATIONS_STORAGE_KEY);
      const current = raw ? JSON.parse(raw) : [];
      const log = Array.isArray(current) ? current : [];
      log.unshift({
        sessionId,
        loteId: session.loteId,
        calidad: session.calidad,
        sublotes: session.sublotes.map((sublote) => ({
          id: sublote.id,
          pesoKg: getSecadoSelectedKg(sublote),
          calidad: session.calidad,
        })),
        cancelledAt: nowIso(),
      });
      window.localStorage.setItem(
        SECADO_CANCELLATIONS_STORAGE_KEY,
        JSON.stringify(log.slice(0, 50)),
      );
    } catch {
      // La trazabilidad local no debe bloquear la devolución visual al inventario.
    }
  }

  return session;
}

type SecadoVisualOptions = {
  includeGeneratedOutputs?: boolean;
};

export function applySecadoToLots(
  baseLots: LoteResumen[],
  options: SecadoVisualOptions = {},
) {
  if (baseLots.length === 0) {
    return [];
  }

  const includeGeneratedOutputs = options.includeGeneratedOutputs ?? true;
  const sessions = getInventorySecadoSessions();
  const lots = baseLots.map((lot) => ({ ...lot }));
  const originalCountsByLot = new Map(
    baseLots.map((lot) => [
      lot.id,
      {
        sublotes: lot.sublotes,
        sublotesConHumedad: lot.sublotesConHumedad,
      },
    ]),
  );
  const fullyRemovedByLot = getFullyRemovedSublotesByLot(sessions);

  for (const session of sessions) {
    const removedKgByLot = new Map<string, number>();
    for (const sublote of session.sublotes) {
      const loteId = sublote.sourceLoteId ?? session.loteId;
      removedKgByLot.set(
        loteId,
        safeNumber(
          (removedKgByLot.get(loteId) ?? 0) + getSecadoSelectedKg(sublote),
        ),
      );
    }

    for (const [loteId, removedKg] of removedKgByLot.entries()) {
      const source = lots.find((lot) => lot.id === loteId);

      if (!source || removedKg > source.pesoActual) {
        continue;
      }

      source.pesoActual = safeNumber(Math.max(0, source.pesoActual - removedKg));
      source.pesoInicial = safeNumber(
        Math.max(0, source.pesoInicial - removedKg),
      );
    }

    const completedAt = session.completedAt ?? session.updatedAt;
    if (session.estado !== 'COMPLETED') {
      lots.push(buildProcessLot(session));
      continue;
    }

    if (!includeGeneratedOutputs) {
      continue;
    }

    const outputs = [
      {
        quality: 'BUENO',
        kg: session.outputBuenoKg,
        humidity: session.outputBuenoHumedad,
      },
      {
        quality: 'REGULAR',
        kg: session.outputRegularKg,
        humidity: session.outputRegularHumedad,
      },
      {
        quality: 'MALO',
        kg: session.outputMaloKg ?? 0,
        humidity: session.outputMaloHumedad ?? null,
      },
    ].filter((item) => item.kg > 0);

    for (const output of outputs) {
      const existing = lots.find(
        (lot) =>
          keyOf(lot.tipoCafe) === 'SECO' &&
          keyOf(lot.calidad) === output.quality,
      );

      if (existing) {
        const previousWeight = existing.pesoActual;
        existing.pesoActual = safeNumber(existing.pesoActual + output.kg);
        existing.pesoInicial = safeNumber(existing.pesoInicial + output.kg);
        existing.sublotes += 1;
        if (output.humidity !== null) {
          existing.sublotesConHumedad += 1;
        }
        existing.humedadPromedio = weightedHumidity(
          existing.humedadPromedio,
          previousWeight,
          output.humidity,
          output.kg,
        );
        existing.fechaUltimoIngreso =
          existing.fechaUltimoIngreso > completedAt
            ? existing.fechaUltimoIngreso
            : completedAt;
        existing.fecha =
          existing.fecha > completedAt ? existing.fecha : completedAt;
        existing.diasEnBodegaMin = 0;
      } else {
        lots.push({
          id: `virtual-seco-${output.quality.toLowerCase()}`,
          codigo: `Lote Seco ${output.quality}`,
          tipoCafeId: 'virtual-seco',
          tipoCafe: 'SECO',
          calidadId: `virtual-${output.quality.toLowerCase()}`,
          calidad: output.quality,
          sublotes: 1,
          sublotesConHumedad: output.humidity !== null ? 1 : 0,
          pesoInicial: safeNumber(output.kg),
          pesoActual: safeNumber(output.kg),
          precioPromedioKg: 0,
          humedadPromedio: output.humidity,
          fecha: completedAt,
          fechaPrimerIngreso: completedAt,
          fechaUltimoIngreso: completedAt,
          diasEnBodegaMin: 0,
          diasEnBodegaMax: 0,
          creadoEn: completedAt,
          totalVentas: 0,
          totalGastos: 0,
          utilidadNeta: 0,
          mermaValor: 0,
          mermaKg: 0,
        });
      }
    }
  }

  for (const lot of lots) {
    const original = originalCountsByLot.get(lot.id);
    const removed = fullyRemovedByLot.get(lot.id);

    if (!original || !removed) {
      continue;
    }

    lot.sublotes = Math.max(0, original.sublotes - removed.sublotes.size);
    lot.sublotesConHumedad = Math.max(
      0,
      original.sublotesConHumedad - removed.withHumidity.size,
    );
  }

  return lots.filter((lot) => lot.sublotes > 0 && lot.pesoActual > 0);
}

export function applySecadoToDetalle(
  baseDetail: LoteDetalle | null,
  tipoCafeId: string,
  calidadId: string,
  options: SecadoVisualOptions = {},
) {
  const includeGeneratedOutputs = options.includeGeneratedOutputs ?? true;
  const sessions = getInventorySecadoSessions();

  if (baseDetail) {
    let nextSublotes = [...baseDetail.sublotes];
    const sourceSessions = sessions.filter((session) =>
      hasSourceSublotes(session, baseDetail.sublotes),
    );

    for (const session of sourceSessions) {
      const selectedWeightById = new Map(
        session.sublotes.map((sublote) => [
          sublote.id,
          getSecadoSelectedKg(sublote),
        ]),
      );
      nextSublotes = nextSublotes
        .map((sublote) => {
          const selectedWeight = selectedWeightById.get(sublote.id);
          if (!selectedWeight) {
            return sublote;
          }

          return {
            ...sublote,
            pesoActual: round2(
              Math.max(0, sublote.pesoActual - selectedWeight),
            ),
          };
        })
        .filter((sublote) => sublote.pesoActual > 0);
    }

    if (includeGeneratedOutputs && isDryLot(baseDetail)) {
      nextSublotes = appendGeneratedDryOutputs(
        nextSublotes,
        sessions,
        keyOf(baseDetail.lote.calidad),
      );
    }

    return {
      lote: rebuildLotFromSublotes(baseDetail.lote, nextSublotes),
      sublotes: nextSublotes,
    } satisfies LoteDetalle;
  }

  if (
    !includeGeneratedOutputs ||
    tipoCafeId !== 'virtual-seco' ||
    !calidadId.startsWith('virtual-')
  ) {
    return null;
  }

  const quality = calidadId.replace('virtual-', '').toUpperCase();
  const virtualSublotes = sessions.flatMap((session) =>
    buildGeneratedOutputs(session).filter(
      (sublote) => keyOf(sublote.calidad) === quality,
    ),
  );

  if (virtualSublotes.length === 0) {
    return null;
  }

  const referenceLot: LoteResumen = {
    id: `virtual-seco-${quality.toLowerCase()}`,
    codigo: `Lote Seco ${quality}`,
    tipoCafeId: 'virtual-seco',
    tipoCafe: 'SECO',
    calidadId,
    calidad: quality,
    sublotes: 0,
    sublotesConHumedad: 0,
    pesoInicial: 0,
    pesoActual: 0,
    precioPromedioKg: 0,
    humedadPromedio: null,
    fecha: virtualSublotes[0].fechaIngreso,
    fechaPrimerIngreso: virtualSublotes[0].fechaIngreso,
    fechaUltimoIngreso: virtualSublotes[0].fechaIngreso,
    diasEnBodegaMin: 0,
    diasEnBodegaMax: 0,
    creadoEn: virtualSublotes[0].creadoEn,
    totalVentas: 0,
    totalGastos: 0,
    utilidadNeta: 0,
    mermaValor: 0,
    mermaKg: 0,
  };

  return {
    lote: rebuildLotFromSublotes(referenceLot, virtualSublotes),
    sublotes: virtualSublotes,
  } satisfies LoteDetalle;
}
