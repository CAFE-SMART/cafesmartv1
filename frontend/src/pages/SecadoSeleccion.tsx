import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronRight,
  Coffee,
  Scale,
  X,
} from 'lucide-react';
import {
  obtenerDetalleLote,
  type LoteDetalle,
  type SubloteDetalle,
} from '../services/lotesService';
import {
  createGuidedError,
  InlineGuidedError,
  type GuidedErrorMessage,
} from '../components/forms/GuidedError';
import {
  applySecadoToDetalle,
  getActiveSecadoSessions,
  type SecadoSession,
} from '../utils/secadoFlow';
import { formatDisplayLabel } from '../utils/uiMessages';

function kg(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value)} kg`;
}

const MAX_SECADO_INPUT_KG = 99999;

function sanitizeDecimalInput(value: string, maxDigits: number) {
  const normalized = value.replace(',', '.').replace(/[^\d.]/g, '');
  const [integer = '', ...decimalParts] = normalized.split('.');
  const digits = `${integer}${decimalParts.join('')}`.slice(0, maxDigits);

  if (!digits) return '';
  if (!normalized.includes('.')) return digits;

  const integerLength = Math.min(integer.length, digits.length);
  const nextInteger = digits.slice(0, integerLength) || '0';
  const nextDecimal = digits.slice(integerLength);

  return nextDecimal ? `${nextInteger}.${nextDecimal}` : `${nextInteger}.`;
}

function clampDecimalInput(value: string, maxDigits: number, maxValue: number) {
  const next = sanitizeDecimalInput(value, maxDigits);
  if (!next || next.endsWith('.')) return next;

  const parsed = Number(next);
  if (!Number.isFinite(parsed)) return '';

  return parsed > maxValue ? String(maxValue) : next;
}

function qualityKey(value: string) {
  return value.trim().toUpperCase();
}

function qualityTone(value: string) {
  const key = qualityKey(value);
  if (key === 'BUENO') return 'bg-emerald-500';
  if (key === 'REGULAR') return 'bg-amber-400';
  return 'bg-rose-500';
}

function daysSince(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  const now = new Date();
  const currentDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const targetDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
  return Math.max(0, Math.floor((currentDay - targetDay) / 86400000));
}

function formatDaysLabel(fechaIngreso: string) {
  const days = daysSince(fechaIngreso);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Hace 1d';
  return `Hace ${days}d`;
}

function getSecadoSeleccionGuidance(message: string): GuidedErrorMessage {
  if (message.includes('superar el peso disponible')) {
    return createGuidedError(
      message,
      'La cantidad supera lo disponible.',
      'El secado solo puede iniciar con el peso disponible del sublote.',
      'Ajusta los kilos a secar.',
    );
  }

  if (message.includes('entrada del secado')) {
    return createGuidedError(
      message,
      'La cantidad no es válida.',
      'Necesitamos un peso mayor a 0 para iniciar el secado.',
      'Ingresa una cantidad mayor a 0.',
    );
  }

  return createGuidedError(
    message,
    'No se pudo continuar con el secado.',
    'Hay un dato que debe revisarse antes de seguir.',
    'Revisa la selección e intenta de nuevo.',
  );
}

export default function SecadoSeleccion() {
  const navigate = useNavigate();
  const { tipoCafeId, calidadId } = useParams<{
    tipoCafeId: string;
    calidadId: string;
  }>();
  const [detalle, setDetalle] = useState<LoteDetalle | null>(null);
  const [selectedWeights, setSelectedWeights] = useState<
    Record<string, number>
  >({});
  const [editing, setEditing] = useState<SubloteDetalle | null>(null);
  const [draftWeight, setDraftWeight] = useState('');
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSessions, setActiveSessions] = useState<SecadoSession[]>([]);

  useEffect(() => {
    const cargar = async () => {
      if (!tipoCafeId || !calidadId) {
        setError('No se encontro el lote verde para secado.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const base = await obtenerDetalleLote(tipoCafeId, calidadId);
        const visual = applySecadoToDetalle(base, tipoCafeId, calidadId);

        if (!visual)
          throw new Error(
            'No se encontraron sublotes disponibles para este lote.',
          );

        setDetalle(visual);
        setSelectedWeights({});
        setActiveSessions(getActiveSecadoSessions());
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'No se pudo abrir el proceso de secado.',
        );
      } finally {
        setLoading(false);
      }
    };

    void cargar();
  }, [calidadId, tipoCafeId]);

  const selectedIds = useMemo(
    () =>
      Object.keys(selectedWeights).filter(
        (id) => (selectedWeights[id] ?? 0) > 0,
      ),
    [selectedWeights],
  );

  const totalSeleccionado = useMemo(
    () => selectedIds.reduce((sum, id) => sum + (selectedWeights[id] ?? 0), 0),
    [selectedIds, selectedWeights],
  );

  const activeWeightBySubloteId = useMemo(() => {
    const weights = new Map<string, number>();
    for (const session of activeSessions) {
      for (const sublote of session.sublotes) {
        weights.set(
          sublote.id,
          (weights.get(sublote.id) ?? 0) + sublote.pesoActual,
        );
      }
    }
    return weights;
  }, [activeSessions]);

  const availableSublotes = useMemo(
    () =>
      (detalle?.sublotes ?? [])
        .map((sublote) => ({
          ...sublote,
          pesoActual: Math.max(
            0,
            Number(
              (
                sublote.pesoActual -
                (activeWeightBySubloteId.get(sublote.id) ?? 0)
              ).toFixed(1),
            ),
          ),
        }))
        .filter((sublote) => sublote.pesoActual > 0),
    [activeWeightBySubloteId, detalle?.sublotes],
  );

  const currentLotActiveSessions = useMemo(() => {
    if (!detalle) return [];
    const currentSubloteIds = new Set(
      detalle.sublotes.map((sublote) => sublote.id),
    );
    return activeSessions.filter(
      (session) =>
        session.loteId === detalle.lote.id &&
        session.sublotes.some((sublote) => currentSubloteIds.has(sublote.id)),
    );
  }, [activeSessions, detalle]);

  const latestActiveSession = useMemo(
    () =>
      [...currentLotActiveSessions].sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      )[0] ?? null,
    [currentLotActiveSessions],
  );

  const grouped = useMemo(() => {
    const groups = ['BUENO', 'REGULAR', 'MALO'];
    return groups.map((quality) => ({
      quality,
      items: availableSublotes.filter(
        (sublote) => qualityKey(sublote.calidad) === quality,
      ),
    }));
  }, [availableSublotes]);

  const toggleSublote = (sublote: SubloteDetalle) => {
    setSelectedWeights((current) => {
      if ((current[sublote.id] ?? 0) > 0) {
        const next = { ...current };
        delete next[sublote.id];
        return next;
      }

      return { ...current, [sublote.id]: sublote.pesoActual };
    });
  };

  const seleccionarTodo = () => {
    setSelectedWeights(
      Object.fromEntries(
        availableSublotes.map((sublote) => [sublote.id, sublote.pesoActual]),
      ),
    );
    setError(null);
  };

  const seleccionarParte = () => {
    setSelectedWeights({});
    setError(null);
  };

  const allSelected =
    availableSublotes.length > 0 &&
    availableSublotes.every(
      (sublote) => (selectedWeights[sublote.id] ?? 0) >= sublote.pesoActual,
    );

  const openAdjust = (sublote: SubloteDetalle) => {
    setEditing(sublote);
    setDraftWeight(String(selectedWeights[sublote.id] || sublote.pesoActual));
    setAdjustError(null);
  };

  const confirmAdjust = () => {
    if (!editing) return;
    const value = Number(draftWeight);
    if (!Number.isFinite(value) || value <= 0) {
      setAdjustError('La cantidad de entrada del secado debe ser mayor a 0.');
      return;
    }

    if (value > editing.pesoActual) {
      setAdjustError('La cantidad a secar no puede superar el peso disponible.');
      return;
    }

    setSelectedWeights((current) => ({ ...current, [editing.id]: value }));
    setEditing(null);
    setAdjustError(null);
    setError(null);
  };

  const iniciarSecado = () => {
    if (!detalle || selectedIds.length === 0) return;
    const availableDetail = {
      ...detalle,
      sublotes: availableSublotes,
    };

    navigate('/inventario/secado/nuevo/configurar', {
      state: {
        detalle: availableDetail,
        selectedWeights,
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#f6f6f6] text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col bg-[#fbfbfb]">
        <header className="relative flex h-12 items-center justify-center border-b border-slate-100 px-4">
          <button
            type="button"
            onClick={() =>
              navigate('/inventario', { state: { preferredTypeKey: 'VERDE' } })
            }
            className="absolute left-4 inline-flex h-8 w-8 items-center justify-center text-[#1f4fd8]"
            aria-label="Volver"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-sm font-extrabold">Iniciar secado</h1>
        </header>

        <main className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-4 pb-3">
          <section className="overflow-hidden rounded-[20px] bg-[linear-gradient(135deg,#24442a_0%,#6b5b35_100%)] p-4 text-white shadow-[0_14px_30px_rgba(36,68,42,0.18)]">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white/15 text-white">
                <Coffee size={22} />
              </div>
              <div className="min-w-0">
            <h2 className="text-[1.05rem] font-black leading-tight">
              Selecciona los sublotes de café verde
            </h2>
            <p className="mt-2 text-[0.72rem] leading-5 text-white/80">
              Selecciona los sublotes que vas a secar. Puedes enviar todo el
              peso o tocar Ajustar cantidad para secar solo una parte.
            </p>
              </div>
            </div>

            {availableSublotes.length > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-2 rounded-[14px] bg-white/12 p-1">
                <button
                  type="button"
                  onClick={seleccionarTodo}
                  className={`h-9 rounded-[10px] text-[0.7rem] font-black transition ${
                    allSelected
                      ? 'bg-white text-[#24442a] shadow-sm'
                      : 'text-white/85'
                  }`}
                >
                  Todo el peso
                </button>
                <button
                  type="button"
                  onClick={seleccionarParte}
                  className={`h-9 rounded-[10px] text-[0.7rem] font-black transition ${
                    !allSelected
                      ? 'bg-white text-[#24442a] shadow-sm'
                      : 'text-white/85'
                  }`}
                >
                  Una parte
                </button>
              </div>
            ) : null}
          </section>

          {latestActiveSession ? (
            <section className="rounded-[16px] border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-900">
              Tienes un secado activo de este lote. Puedes revisarlo sin perder
              lo que ya guardaste.
              <button
                type="button"
                onClick={() => navigate('/inventario/secados')}
                className="mt-3 w-full rounded-[14px] bg-[#1747d4] py-3 text-xs font-black text-white"
              >
                Revisar secado activo
              </button>
            </section>
          ) : null}

          {error ? (
            <InlineGuidedError message={getSecadoSeleccionGuidance(error)} />
          ) : null}

          {loading ? (
            <section className="rounded-[18px] bg-white p-6 text-center text-sm font-bold text-slate-500 shadow-sm">
              Cargando sublotes...
            </section>
          ) : null}

          {!loading && detalle && availableSublotes.length === 0 ? (
            <section className="rounded-[16px] border border-slate-200 bg-white p-4 text-center text-xs font-semibold leading-5 text-slate-500 shadow-sm">
              No hay sublotes disponibles para iniciar otro secado. Los sublotes
              de este lote ya están en proceso o no tienen peso disponible.
            </section>
          ) : null}

          {!loading && detalle && availableSublotes.length > 0 ? (
            <section className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-3 pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {grouped.map(({ quality, items }) =>
                items.length > 0 ? (
                  <div key={quality} className="space-y-2">
                    <p className="flex items-center gap-2 text-[0.64rem] font-black uppercase tracking-[0.08em] text-slate-500">
                      <span
                        className={`h-2 w-2 rounded-full ${qualityTone(quality)}`}
                      />
                      Calidad: {formatDisplayLabel(quality)}
                    </p>
                    {items.map((sublote) => {
                      const selected = (selectedWeights[sublote.id] ?? 0) > 0;
                      const selectedKg =
                        selectedWeights[sublote.id] ?? sublote.pesoActual;

                      return (
                        <article
                          key={sublote.id}
                          className={`rounded-[18px] border bg-white p-3 shadow-sm ${
                            selected
                              ? 'border-[#1455ff] ring-1 ring-[#1455ff]'
                              : 'border-slate-100'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              type="button"
                              onClick={() => toggleSublote(sublote)}
                              className={`mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                                selected
                                  ? 'border-[#1455ff] bg-[#1455ff] text-white'
                                  : 'border-slate-300 bg-white text-transparent'
                              }`}
                              aria-label="Seleccionar sublote"
                            >
                              <Check size={13} strokeWidth={3} />
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-black">
                                  {sublote.etiqueta}
                                </p>
                                <span className="inline-flex items-center gap-1 text-[0.65rem] font-semibold text-slate-500">
                                  <CalendarDays size={11} />
                                  {formatDaysLabel(sublote.fechaIngreso)}
                                </span>
                              </div>
                              <p className="mt-1 text-[0.72rem] font-bold text-slate-500">
                                {kg(selected ? selectedKg : sublote.pesoActual)}
                                {selected && selectedKg < sublote.pesoActual
                                  ? ' seleccionados'
                                  : ''}
                              </p>
                              <button
                                type="button"
                                onClick={() => openAdjust(sublote)}
                                className="mt-2 inline-flex h-8 items-center rounded-[10px] bg-[#eef4ff] px-3 text-[0.68rem] font-black text-[#1f4fd8]"
                              >
                                Ajustar cantidad
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : null,
              )}
            </section>
          ) : null}
        </main>

        <footer className="sticky bottom-0 z-20 mx-auto w-full max-w-[430px] bg-[#fbfbfb] px-4 pb-4 pt-2 shadow-[0_-10px_24px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between rounded-t-[2px] bg-[#0647d6] px-4 py-2 text-white">
            <span className="text-[0.62rem] font-black uppercase tracking-[0.12em]">
              Total seleccionado
            </span>
            <span className="inline-flex items-center gap-2 text-sm font-black">
              {kg(totalSeleccionado)}
              <Scale size={16} />
            </span>
          </div>
          <button
            type="button"
            onClick={iniciarSecado}
            disabled={selectedIds.length === 0}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0647d6] text-xs font-black uppercase tracking-[0.05em] text-white shadow-[0_12px_22px_rgba(6,71,214,0.2)] disabled:bg-slate-300"
          >
            Continuar <ChevronRight size={16} />
          </button>
        </footer>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/55 px-5 backdrop-blur-[2px]">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-[430px] overflow-y-auto rounded-[14px] bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black">Ajustar cantidad</h2>
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setAdjustError(null);
                }}
                className="text-slate-400"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-5 flex items-start justify-between rounded-[14px] bg-slate-50 p-3">
              <div>
                <p className="text-[0.58rem] font-black uppercase text-slate-400">
                  Sublote
                </p>
                <p className="mt-1 text-sm font-black">{editing.etiqueta}</p>
              </div>
              <div className="text-right">
                <p className="text-[0.58rem] font-black uppercase text-slate-400">
                  Disponible
                </p>
                <p className="mt-1 text-sm font-black text-[#0647d6]">
                  {kg(editing.pesoActual)}
                </p>
              </div>
            </div>
            <label className="mt-4 block text-xs font-black text-slate-700">
              Cantidad a secar (kg)
            </label>
            <input
              type="text"
              inputMode="decimal"
              maxLength={8}
              value={draftWeight}
              onChange={(event) => {
                setDraftWeight(
                  clampDecimalInput(
                    event.target.value,
                    7,
                    Math.min(MAX_SECADO_INPUT_KG, editing.pesoActual),
                  ),
                );
                setAdjustError(null);
              }}
              className="mt-2 h-11 w-full rounded-[12px] border border-slate-200 px-4 text-sm font-bold outline-none focus:border-[#0647d6]"
              placeholder="Ej: 50"
            />
            <p className="mt-2 text-[0.68rem] text-slate-400">
              Debe ser menor o igual a {kg(editing.pesoActual)}.
            </p>
            {adjustError ? (
              <InlineGuidedError
                message={getSecadoSeleccionGuidance(adjustError)}
                className="mt-3"
              />
            ) : null}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setAdjustError(null);
                }}
                className="h-11 rounded-full text-xs font-bold text-slate-500"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmAdjust}
                className="h-11 rounded-full bg-[#0647d6] text-xs font-black text-white"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
