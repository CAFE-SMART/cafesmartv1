import type {
  LoteDetalle,
  LoteResumen,
  SubloteDetalle,
} from '../services/lotesService';

const STORAGE_KEY = 'cafesmart-secado-flow-v1';
export const VISUAL_CAPACITY_KG = 3000;

export type SecadoEstado = 'IN_PROCESS' | 'READY' | 'COMPLETED';

export type SecadoSubloteSeleccionado = {
  id: string;
  etiqueta: string;
  pesoActual: number;
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
  fechaLote: string;
  sublotes: SecadoSubloteSeleccionado[];
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  outputBuenoKg: number;
  outputBuenoHumedad: number | null;
  outputRegularKg: number;
  outputRegularHumedad: number | null;
  mermaKg: number;
  rendimientoPct: number;
};

type ResultadoSecadoPayload = {
  outputBuenoKg: number;
  outputBuenoHumedad: number | null;
  outputRegularKg: number;
  outputRegularHumedad: number | null;
};

function keyOf(value: string) {
  return value.trim().toUpperCase();
}

function nowIso() {
  return new Date().toISOString();
}

function safeNumber(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(1)) : 0;
}

function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readStorage() {
  if (typeof window === 'undefined') return [] as SecadoSession[];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [] as SecadoSession[];

    const parsed = JSON.parse(raw) as SecadoSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as SecadoSession[];
  }
}

function writeStorage(sessions: SecadoSession[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function daysSince(value: string) {
  const now = new Date();
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return 0;

  const currentDayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const targetDayUtc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );

  return Math.max(0, Math.floor((currentDayUtc - targetDayUtc) / 86400000));
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
  return session.sublotes.reduce((sum, sublote) => sum + sublote.pesoActual, 0);
}

function buildGeneratedOutputs(session: SecadoSession) {
  const completedAt = session.completedAt ?? session.updatedAt;

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
    fechaIngreso: completedAt,
    diasEnBodega: daysSince(completedAt),
    creadoEn: completedAt,
  })) satisfies SubloteDetalle[];
}

function rebuildLotFromSublotes(
  reference: LoteResumen,
  sublotes: SubloteDetalle[],
  override?: Partial<LoteResumen>,
) {
  const pesoActual = sublotes.reduce((sum, sublote) => sum + sublote.pesoActual, 0);
  const pesoInicial = sublotes.reduce((sum, sublote) => sum + sublote.pesoInicial, 0);
  const sublotesConHumedad = sublotes.filter((sublote) => sublote.humedad !== null).length;

  const sublotesConDato = sublotes.filter(
    (sublote) => sublote.humedad !== null && sublote.pesoActual > 0,
  );

  const humedadPromedio =
    sublotesConDato.length === 0
      ? null
      : Number(
          (
            sublotesConDato.reduce(
              (sum, sublote) => sum + (sublote.humedad as number) * sublote.pesoActual,
              0,
            ) /
            sublotesConDato.reduce((sum, sublote) => sum + sublote.pesoActual, 0)
          ).toFixed(1),
        );

  const fechas = sublotes.map((sublote) => sublote.fechaIngreso);
  const primerIngreso = fechas.length > 0 ? [...fechas].sort()[0] : reference.fechaPrimerIngreso;
  const ultimoIngreso =
    fechas.length > 0 ? [...fechas].sort()[fechas.length - 1] : reference.fechaUltimoIngreso;

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

export function getSecadoSession(sessionId: string) {
  return readStorage().find((session) => session.id === sessionId) ?? null;
}

export function getActiveSecadoSession() {
  return readStorage().find((session) => session.estado !== 'COMPLETED') ?? null;
}

export function getActiveSecadoSessionForLot(lotId: string) {
  return (
    readStorage().find(
      (session) => session.loteId === lotId && session.estado !== 'COMPLETED',
    ) ?? null
  );
}

export function startSecado(detalle: LoteDetalle, selectedIds: string[]) {
  const selectedSublotes = detalle.sublotes.filter((sublote) => selectedIds.includes(sublote.id));
  const sessions = readStorage();
  const active = sessions.find((session) => session.estado !== 'COMPLETED');

  if (active) {
    return active;
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
    fechaLote: detalle.lote.fechaPrimerIngreso,
    sublotes: selectedSublotes.map((sublote) => ({
      id: sublote.id,
      etiqueta: sublote.etiqueta,
      pesoActual: sublote.pesoActual,
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
    mermaKg: 0,
    rendimientoPct: 0,
  };

  writeStorage([session, ...sessions]);
  return session;
}

export function saveSecadoResults(sessionId: string, payload: ResultadoSecadoPayload) {
  const sessions = readStorage();
  const nextSessions = sessions.map((session) => {
    if (session.id !== sessionId) return session;

    const totalEntrada = totalInputKg(session);
    const totalSalida = payload.outputBuenoKg + payload.outputRegularKg;
    const mermaKg = Math.max(0, totalEntrada - totalSalida);
    const rendimientoPct =
      totalEntrada > 0 ? Number(((totalSalida / totalEntrada) * 100).toFixed(1)) : 0;

    return {
      ...session,
      estado: 'READY' as const,
      updatedAt: nowIso(),
      outputBuenoKg: safeNumber(payload.outputBuenoKg),
      outputBuenoHumedad: payload.outputBuenoHumedad,
      outputRegularKg: safeNumber(payload.outputRegularKg),
      outputRegularHumedad: payload.outputRegularHumedad,
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
          completedAt: nowIso(),
        }
      : session,
  );

  writeStorage(nextSessions);
  return nextSessions.find((session) => session.id === sessionId) ?? null;
}

export function applySecadoToLots(baseLots: LoteResumen[]) {
  const sessions = readStorage().filter((session) => session.estado === 'COMPLETED');
  const lots = baseLots.map((lot) => ({ ...lot }));

  for (const session of sessions) {
    const removedKg = totalInputKg(session);
    const removedCount = session.sublotes.length;
    const removedHumidityCount = session.sublotes.filter((sublote) => sublote.humedad !== null).length;
    const source = lots.find((lot) => lot.id === session.loteId);

    if (source) {
      source.pesoActual = safeNumber(Math.max(0, source.pesoActual - removedKg));
      source.pesoInicial = safeNumber(Math.max(0, source.pesoInicial - removedKg));
      source.sublotes = Math.max(0, source.sublotes - removedCount);
      source.sublotesConHumedad = Math.max(0, source.sublotesConHumedad - removedHumidityCount);
    }

    const completedAt = session.completedAt ?? session.updatedAt;
    const outputs = [
      { quality: 'BUENO', kg: session.outputBuenoKg, humidity: session.outputBuenoHumedad },
      { quality: 'REGULAR', kg: session.outputRegularKg, humidity: session.outputRegularHumedad },
    ].filter((item) => item.kg > 0);

    for (const output of outputs) {
      const existing = lots.find(
        (lot) => keyOf(lot.tipoCafe) === 'SECO' && keyOf(lot.calidad) === output.quality,
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
          existing.fechaUltimoIngreso > completedAt ? existing.fechaUltimoIngreso : completedAt;
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
        });
      }
    }
  }

  return lots.filter((lot) => lot.sublotes > 0 && lot.pesoActual > 0);
}

export function applySecadoToDetalle(
  baseDetail: LoteDetalle | null,
  tipoCafeId: string,
  calidadId: string,
) {
  const sessions = readStorage().filter((session) => session.estado === 'COMPLETED');

  if (baseDetail) {
    let nextSublotes = [...baseDetail.sublotes];

    for (const session of sessions) {
      if (session.loteId === baseDetail.lote.id) {
        const selectedIds = new Set(session.sublotes.map((sublote) => sublote.id));
        nextSublotes = nextSublotes.filter((sublote) => !selectedIds.has(sublote.id));
      }

      if (keyOf(baseDetail.lote.tipoCafe) === 'SECO' && keyOf(baseDetail.lote.calidad) === 'BUENO') {
        nextSublotes = [...nextSublotes, ...buildGeneratedOutputs(session).filter((sublote) => keyOf(sublote.calidad) === 'BUENO')];
      }

      if (keyOf(baseDetail.lote.tipoCafe) === 'SECO' && keyOf(baseDetail.lote.calidad) === 'REGULAR') {
        nextSublotes = [...nextSublotes, ...buildGeneratedOutputs(session).filter((sublote) => keyOf(sublote.calidad) === 'REGULAR')];
      }
    }

    return {
      lote: rebuildLotFromSublotes(baseDetail.lote, nextSublotes),
      sublotes: nextSublotes,
    } satisfies LoteDetalle;
  }

  if (tipoCafeId !== 'virtual-seco' || !calidadId.startsWith('virtual-')) {
    return null;
  }

  const quality = calidadId.replace('virtual-', '').toUpperCase();
  const virtualSublotes = sessions.flatMap((session) =>
    buildGeneratedOutputs(session).filter((sublote) => keyOf(sublote.calidad) === quality),
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
  };

  return {
    lote: rebuildLotFromSublotes(referenceLot, virtualSublotes),
    sublotes: virtualSublotes,
  } satisfies LoteDetalle;
}
