import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Package2,
  RefreshCcw,
  Save,
} from 'lucide-react';
import { CloudStatusBadge } from '../components/CloudStatusBadge';
import { formatDateLabel, getDaysInBodega } from '../utils/date';
import {
  guardarHumedadesSublotes,
  obtenerDetalleLote,
  type LoteDetalle,
} from '../services/lotesService';
import { applySecadoToDetalle } from '../utils/secadoFlow';
import {
  getAverageFactorForLot,
  getFactorForSublote,
  saveFactorsForLot,
} from '../utils/factorStorage';

type EstadoHumedad = {
  label: string;
  badgeClass: string;
  dotClass: string;
};

type SavedFlags = Record<string, boolean>;
type BusyFlags = Record<string, boolean>;

function formatKg(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value)} kg`;
}

function formatHumedad(value: number | null) {
  if (value === null) return 'Sin dato';
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function formatFactor(value: number | null) {
  if (value === null) return 'Sin dato';
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function estadoPorHumedad(value: number | null): EstadoHumedad {
  if (value === null) {
    return {
      label: 'Sin dato',
      badgeClass: 'bg-slate-100 text-slate-700',
      dotClass: 'bg-slate-400',
    };
  }

  if (value < 10) {
    return {
      label: 'Bajo',
      badgeClass: 'bg-rose-100 text-rose-700',
      dotClass: 'bg-rose-500',
    };
  }

  if (value > 12) {
    return {
      label: 'Regular',
      badgeClass: 'bg-amber-100 text-amber-800',
      dotClass: 'bg-amber-500',
    };
  }

  return {
    label: 'Óptimo',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    dotClass: 'bg-emerald-500',
  };
}

function parseDecimal(text: string) {
  return Number(text.replace(',', '.'));
}

function getDaysForSublote(sublote: { fechaIngreso: string; diasEnBodega: number }) {
  const computed = getDaysInBodega(sublote.fechaIngreso);
  return Math.max(computed, sublote.diasEnBodega || 0);
}

export default function Sublotes() {
  const navigate = useNavigate();
  const { tipoCafeId, calidadId } = useParams<{ tipoCafeId: string; calidadId: string }>();

  const [detalle, setDetalle] = useState<LoteDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [humedades, setHumedades] = useState<Record<string, string>>({});
  const [factores, setFactores] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<SavedFlags>({});
  const [busy, setBusy] = useState<BusyFlags>({});
  const [factorVersion, setFactorVersion] = useState(0);

  const isSecoBuenoLot =
    (detalle?.lote.tipoCafe ?? '').trim().toUpperCase() === 'SECO' &&
    (detalle?.lote.calidad ?? '').trim().toUpperCase() === 'BUENO';

  const cargar = useCallback(async () => {
    if (!tipoCafeId || !calidadId) {
      setError('No se encontró el lote solicitado.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let data: LoteDetalle | null = null;
      try {
        data = await obtenerDetalleLote(tipoCafeId, calidadId);
      } catch {
        data = null;
      }

      const visual = applySecadoToDetalle(data, tipoCafeId, calidadId);
      if (!visual) {
        throw new Error('No se pudo cargar el lote.');
      }

      setDetalle(visual);
      setHumedades(
        Object.fromEntries(
          visual.sublotes.map((sublote) => [
            sublote.id,
            sublote.humedad === null ? '' : String(sublote.humedad),
          ]),
        ),
      );
      setFactores(
        Object.fromEntries(
          visual.sublotes.map((sublote) => {
            const factor = getFactorForSublote(sublote.id);
            return [sublote.id, factor === null ? '' : String(factor)];
          }),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el lote.');
      setDetalle(null);
    } finally {
      setLoading(false);
    }
  }, [calidadId, tipoCafeId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const markSaved = (key: string) => {
    setSaved((current) => ({ ...current, [key]: true }));
    window.setTimeout(() => {
      setSaved((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }, 2200);
  };

  const setBusyKey = (key: string, value: boolean) => {
    setBusy((current) => ({ ...current, [key]: value }));
  };

  const updateHumedad = (subloteId: string, value: string) => {
    setHumedades((current) => ({ ...current, [subloteId]: value }));
  };

  const updateFactor = (subloteId: string, value: string) => {
    setFactores((current) => ({ ...current, [subloteId]: value }));
  };

  const guardarHumedad = async (subloteId: string) => {
    if (!detalle) return;

    const sublote = detalle.sublotes.find((item) => item.id === subloteId);
    if (!sublote) return;

    const busyKey = `${subloteId}:humedad:busy`;
    setBusyKey(busyKey, true);
    setError(null);

    try {
      if (sublote.id.startsWith('secado-')) {
        throw new Error('Este sublote de secado no se edita en backend.');
      }

      const text = (humedades[sublote.id] ?? '').trim();
      const payload = !text
        ? { id: sublote.id, humedad: null as number | null }
        : (() => {
            const value = parseDecimal(text);
            if (!Number.isFinite(value) || value < 0 || value > 100) {
              throw new Error(`La humedad de ${sublote.etiqueta} debe estar entre 0 y 100.`);
            }
            return { id: sublote.id, humedad: Number(value.toFixed(1)) };
          })();

      await guardarHumedadesSublotes([payload]);
      await cargar();
      markSaved(`${sublote.id}:humedad`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la humedad.');
    } finally {
      setBusyKey(busyKey, false);
    }
  };

  const guardarFactor = async (subloteId: string) => {
    if (!detalle) return;

    if (!isSecoBuenoLot) {
      setError('El factor aplica solo para café seco de calidad bueno.');
      return;
    }

    const sublote = detalle.sublotes.find((item) => item.id === subloteId);
    if (!sublote) return;

    const busyKey = `${subloteId}:factor:busy`;
    setBusyKey(busyKey, true);
    setError(null);

    try {
      const text = (factores[sublote.id] ?? '').trim();
      if (!text) {
        saveFactorsForLot(detalle.lote.id, [{ subloteId: sublote.id, factor: null }]);
      } else {
        const value = parseDecimal(text);
        if (!Number.isFinite(value) || value < 0 || value > 10) {
          throw new Error(`El factor de ${sublote.etiqueta} debe estar entre 0 y 10.`);
        }
        saveFactorsForLot(detalle.lote.id, [
          { subloteId: sublote.id, factor: Number(value.toFixed(2)) },
        ]);
      }

      setFactorVersion((current) => current + 1);
      markSaved(`${sublote.id}:factor`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el factor.');
    } finally {
      setBusyKey(busyKey, false);
    }
  };

  const estadoLote = useMemo(
    () => estadoPorHumedad(detalle?.lote.humedadPromedio ?? null),
    [detalle?.lote.humedadPromedio],
  );

  const factorPromedioLote = useMemo(() => {
    if (!detalle || !isSecoBuenoLot) return null;
    return getAverageFactorForLot(detalle.lote.id);
  }, [detalle, factorVersion, isSecoBuenoLot]);

  const diasLote = useMemo(() => {
    if (!detalle) return 0;
    if (detalle.sublotes.length === 0) {
      return getDaysInBodega(detalle.lote.fechaPrimerIngreso || detalle.lote.fecha);
    }
    return Math.max(...detalle.sublotes.map((sublote) => getDaysForSublote(sublote)));
  }, [detalle]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] pb-28 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-white/80 bg-[rgba(247,245,255,0.92)] px-4 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[520px] items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/inventario')}
              className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] border border-[#dbe1f0] bg-white text-slate-700 shadow-sm"
              aria-label="Volver al inventario"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-3">
              <div className="rounded-[16px] bg-[#eef2ff] p-2.5 text-[#102d92]">
                <Package2 size={18} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Café Smart</p>
                <h1 className="text-[1.45rem] font-black tracking-tight text-[#111827]">Sublotes</h1>
              </div>
            </div>
          </div>
          <CloudStatusBadge compact className="max-w-[240px]" />
        </div>
      </header>

      <main className="px-4 py-5">
        <div className="mx-auto flex w-full max-w-[520px] flex-col gap-4">
          <section className="rounded-[22px] border border-[#dce4fb] bg-[#eef3ff] p-4 text-[#102d92] shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#5b6f9d]">Resumen del lote</p>
                <h2 className="mt-1.5 text-[1.45rem] font-black leading-tight">
                  {loading || !detalle ? 'Cargando...' : `${detalle.lote.tipoCafe} - ${detalle.lote.calidad}`}
                </h2>
                <p className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-slate-700">
                  <span className={`h-2.5 w-2.5 rounded-full ${estadoLote.dotClass}`} />
                  {estadoLote.label}
                  <span className="text-slate-400">·</span>
                  {loading || !detalle ? '...' : formatKg(detalle.lote.pesoActual)}
                  <span className="text-slate-400">·</span>
                  {loading || !detalle ? '...' : `${diasLote} días en bodega`}
                </p>
                <p className="mt-1 text-xs text-[#5b6f9d]">
                  {loading || !detalle || detalle.sublotes.length === 0
                    ? '...'
                    : `Ingreso: ${formatDateLabel(detalle.sublotes[0].fechaIngreso)} · ${detalle.lote.tipoCafe} · ${detalle.lote.calidad}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void cargar()}
                className="inline-flex items-center gap-2 rounded-full border border-[#cbd9fb] bg-white px-3 py-2 text-xs font-black text-[#102d92]"
              >
                <RefreshCcw size={14} />
                Recargar
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="rounded-[12px] bg-white px-3 py-2.5">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Sublotes</p>
                <p className="mt-1 text-lg font-black text-slate-900">{detalle?.sublotes.length ?? 0}</p>
              </div>
              <div className="rounded-[12px] bg-white px-3 py-2.5">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Peso</p>
                <p className="mt-1 text-lg font-black text-slate-900">
                  {detalle ? formatKg(detalle.lote.pesoActual) : '...'}
                </p>
              </div>
              <div className="rounded-[12px] bg-white px-3 py-2.5">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Humedad</p>
                <p className="mt-1 text-lg font-black text-slate-900">
                  {detalle ? formatHumedad(detalle.lote.humedadPromedio) : '...'}
                </p>
              </div>
              <div className="rounded-[12px] bg-white px-3 py-2.5">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Factor</p>
                <p className="mt-1 text-lg font-black text-slate-900">
                  {isSecoBuenoLot ? formatFactor(factorPromedioLote) : 'Sin dato'}
                </p>
              </div>
            </div>
          </section>

          {error ? (
            <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {loading ? (
            <section className="rounded-[22px] border border-[#e5e9f6] bg-white px-5 py-10 text-center shadow-sm">
              <p className="text-base font-semibold text-slate-500">Cargando sublotes...</p>
            </section>
          ) : null}

          {!loading && !detalle ? (
            <section className="rounded-[22px] border border-dashed border-[#d8dceb] bg-white px-5 py-10 text-center shadow-sm">
              <p className="text-base font-semibold text-slate-600">No se pudo cargar el lote.</p>
            </section>
          ) : null}

          <section className="grid gap-4">
            {detalle?.sublotes.map((sublote) => {
              const estado = estadoPorHumedad(sublote.humedad);
              const factorActual = getFactorForSublote(sublote.id);
              const diasSublote = getDaysForSublote(sublote);
              const humedadSavedKey = `${sublote.id}:humedad`;
              const factorSavedKey = `${sublote.id}:factor`;
              const humedadBusyKey = `${sublote.id}:humedad:busy`;
              const factorBusyKey = `${sublote.id}:factor:busy`;

              return (
                <article
                  key={sublote.id}
                  className="relative overflow-hidden rounded-[22px] border border-[#e5e9f6] bg-white p-4 shadow-sm"
                >
                  <div className={`absolute left-0 top-0 h-full w-1.5 ${estado.dotClass}`} />

                  <div className="pl-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[1.3rem] font-black leading-none text-[#102d92]">{sublote.etiqueta}</h3>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ${estado.badgeClass}`}
                      >
                        <span className={`h-2 w-2 rounded-full ${estado.dotClass}`} />
                        {estado.label}
                      </span>
                      <span className="rounded-full bg-[#eef2ff] px-2.5 py-1 text-xs font-black text-[#102d92]">
                        {formatKg(sublote.pesoActual)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#eef2ff] px-2.5 py-1 text-xs font-black text-[#102d92]">
                        <Clock3 size={12} />
                        {diasSublote} días
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-500">
                      Ingreso: {formatDateLabel(sublote.fechaIngreso)} · {sublote.tipoCafe} · {sublote.calidad}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      <div className="rounded-[14px] bg-[#f8f9ff] px-3 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Peso</p>
                        <p className="mt-1 text-base font-black text-slate-900">{formatKg(sublote.pesoActual)}</p>
                      </div>
                      <div className="rounded-[14px] bg-[#f8f9ff] px-3 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Días</p>
                        <p className="mt-1 text-base font-black text-slate-900">{diasSublote}</p>
                      </div>
                      <div className="rounded-[14px] bg-[#f8f9ff] px-3 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Humedad</p>
                        <p className="mt-1 text-base font-black text-slate-900">{formatHumedad(sublote.humedad)}</p>
                      </div>
                      <div className="rounded-[14px] bg-[#f8f9ff] px-3 py-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Factor</p>
                        <p className="mt-1 text-base font-black text-slate-900">{formatFactor(factorActual)}</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-[16px] border border-[#dfe5f2] bg-[#fbfbff] px-3.5 py-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <label
                          htmlFor={`humedad-${sublote.id}`}
                          className="text-xs font-black uppercase tracking-[0.14em] text-slate-400"
                        >
                          Humedad del sublote (%)
                        </label>
                        <button
                          type="button"
                          onClick={() => void guardarHumedad(sublote.id)}
                          disabled={Boolean(busy[humedadBusyKey]) || loading}
                          className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-[10px] border border-[#d3def8] bg-[#eef3ff] px-2.5 py-1.5 text-[11px] font-black text-[#102d92] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Save size={12} />
                          Guardar humedad
                        </button>
                      </div>
                      <input
                        id={`humedad-${sublote.id}`}
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        min="0"
                        max="100"
                        value={humedades[sublote.id] ?? ''}
                        onChange={(event) => updateHumedad(sublote.id, event.target.value)}
                        className="mt-2 w-full rounded-[12px] border border-[#dfe5f2] bg-white px-3 py-2.5 text-base font-semibold text-slate-900 outline-none focus:border-[#102d92]"
                        placeholder="Ingresa la humedad (Ej: 11)"
                      />
                      {saved[humedadSavedKey] ? (
                        <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-black text-emerald-700">
                          <CheckCircle2 size={13} />
                          Guardado
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-3 rounded-[16px] border border-[#dfe5f2] bg-[#fbfbff] px-3.5 py-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <label
                          htmlFor={`factor-${sublote.id}`}
                          className="text-xs font-black uppercase tracking-[0.14em] text-slate-400"
                        >
                          Factor del sublote
                        </label>
                        <button
                          type="button"
                          onClick={() => void guardarFactor(sublote.id)}
                          disabled={Boolean(busy[factorBusyKey]) || loading || !isSecoBuenoLot}
                          className="inline-flex min-h-[34px] items-center justify-center gap-1.5 rounded-[10px] border border-[#d3def8] bg-[#eef3ff] px-2.5 py-1.5 text-[11px] font-black text-[#102d92] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Save size={12} />
                          Guardar factor
                        </button>
                      </div>
                      <input
                        id={`factor-${sublote.id}`}
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        max="10"
                        value={factores[sublote.id] ?? ''}
                        onChange={(event) => updateFactor(sublote.id, event.target.value)}
                        disabled={!isSecoBuenoLot}
                        className="mt-2 w-full rounded-[12px] border border-[#dfe5f2] bg-white px-3 py-2.5 text-base font-semibold text-slate-900 outline-none focus:border-[#102d92] disabled:bg-slate-100 disabled:text-slate-500"
                        placeholder={isSecoBuenoLot ? 'Ingresa el factor (Ej: 1.85)' : 'No aplica en este lote'}
                      />
                      {saved[factorSavedKey] ? (
                        <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-black text-emerald-700">
                          <CheckCircle2 size={13} />
                          Guardado
                        </p>
                      ) : null}
                    </div>

                    <div className="mt-3 rounded-[16px] bg-[#f6f7fd] px-3.5 py-3">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Recomendación</p>
                      <p className="mt-1.5 text-sm font-semibold leading-6 text-slate-700">
                        Ajusta la humedad antes de almacenar para evitar pérdidas o castigos en el precio.
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/70 bg-[rgba(255,255,255,0.9)] px-4 py-3 backdrop-blur">
        <div className="mx-auto w-full max-w-[520px]">
          <button
            type="button"
            onClick={() => navigate('/inventario')}
            className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[14px] border border-[#dbe1ef] bg-white px-5 py-2.5 text-sm font-black text-slate-700"
          >
            <ArrowLeft size={16} />
            Volver
          </button>
        </div>
      </footer>
    </div>
  );
}
