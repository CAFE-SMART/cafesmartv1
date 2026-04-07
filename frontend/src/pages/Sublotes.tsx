import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Droplets,
  Info,
  Package2,
  RefreshCcw,
  Save,
  Scale,
} from 'lucide-react';
import { CloudStatusBadge } from '../components/CloudStatusBadge';
import { formatDateLabel } from '../utils/date';
import {
  guardarHumedadesSublotes,
  obtenerDetalleLote,
  type LoteDetalle,
} from '../services/lotesService';
import { applySecadoToDetalle } from '../utils/secadoFlow';
import { getAverageFactorForLot, getFactorForSublote, saveFactorsForLot } from '../utils/factorStorage';

function kg(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value)} kg`;
}

function date(value: string) {
  return formatDateLabel(value);
}

function humidity(value: number | null) {
  if (value === null) return 'Sin dato';
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function factorLabel(value: number | null) {
  if (value === null) return 'Sin dato';
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function dayLabel(value: number) {
  return `${value} dia${value === 1 ? '' : 's'}`;
}

function storageRange(min: number, max: number) {
  if (min === max) return `${dayLabel(max)} en bodega`;
  return `Entre ${dayLabel(min)} y ${dayLabel(max)}`;
}

function sublotState(value: number | null) {
  if (value === null) {
    return {
      label: 'Pendiente',
      badge: 'bg-amber-100 text-amber-900',
      stripe: 'bg-amber-300',
      panel: 'bg-amber-50 text-amber-900',
      note: 'Falta registrar la humedad real de este sublote.',
      icon: <Info size={18} />,
    };
  }

  if (value < 10.5) {
    return {
      label: 'Seco',
      badge: 'bg-sky-100 text-sky-900',
      stripe: 'bg-sky-400',
      panel: 'bg-sky-50 text-sky-900',
      note: 'Puede afectar el rendimiento si sigue bajando.',
      icon: <AlertTriangle size={18} />,
    };
  }

  if (value <= 12) {
    return {
      label: 'Óptimo',
      badge: 'bg-emerald-100 text-emerald-800',
      stripe: 'bg-emerald-300',
      panel: 'bg-emerald-50 text-emerald-900',
      note: 'Humedad dentro del rango esperado.',
      icon: <CheckCircle2 size={18} />,
    };
  }

  if (value <= 13.5) {
    return {
      label: 'Atención',
      badge: 'bg-amber-100 text-amber-900',
      stripe: 'bg-amber-300',
      panel: 'bg-amber-50 text-amber-900',
      note: 'Conviene revisar este sublote pronto.',
      icon: <AlertTriangle size={18} />,
    };
  }

  return {
    label: 'Crítico',
    badge: 'bg-rose-100 text-rose-800',
    stripe: 'bg-rose-400',
    panel: 'bg-rose-50 text-rose-900',
    note: 'La humedad está alta y puede afectar bodega o secado.',
    icon: <AlertTriangle size={18} />,
  };
}

export default function Sublotes() {
  const navigate = useNavigate();
  const { tipoCafeId, calidadId } = useParams<{ tipoCafeId: string; calidadId: string }>();
  const [detalle, setDetalle] = useState<LoteDetalle | null>(null);
  const [humedades, setHumedades] = useState<Record<string, string>>({});
  const [factores, setFactores] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const cargar = async () => {
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
            sublote.humedad === null ? '' : sublote.humedad.toString(),
          ]),
        ),
      );
      setFactores(
        Object.fromEntries(
          visual.sublotes.map((sublote) => {
            const factor = getFactorForSublote(sublote.id);
            return [sublote.id, factor === null ? '' : factor.toString()];
          }),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el lote.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, [calidadId, tipoCafeId]);

  const isSecoBuenoLot =
    (detalle?.lote.tipoCafe ?? '').trim().toUpperCase() === 'SECO' &&
    (detalle?.lote.calidad ?? '').trim().toUpperCase() === 'BUENO';

  const pendingChanges = useMemo(() => {
    if (!detalle) return 0;

    return detalle.sublotes.filter((sublote) => {
      const humidityChanged = !sublote.id.startsWith('secado-')
        ? (sublote.humedad === null ? '' : sublote.humedad.toString()) !==
          (humedades[sublote.id] ?? '').trim()
        : false;

      const factorChanged = isSecoBuenoLot
        ? (getFactorForSublote(sublote.id)?.toString() ?? '') !==
          (factores[sublote.id] ?? '').trim()
        : false;

      return humidityChanged || factorChanged;
    }).length;
  }, [detalle, factores, humedades, isSecoBuenoLot]);

  const summary = useMemo(() => {
    if (!detalle) return { pending: 0, low: 0, high: 0, optimal: 0 };

    return detalle.sublotes.reduce(
      (acc, sublote) => {
        if (sublote.humedad === null) acc.pending += 1;
        else if (sublote.humedad < 10.5) acc.low += 1;
        else if (sublote.humedad > 13.5) acc.high += 1;
        else if (sublote.humedad <= 12) acc.optimal += 1;
        return acc;
      },
      { pending: 0, low: 0, high: 0, optimal: 0 },
    );
  }, [detalle]);

  const secadoHint = useMemo(() => {
    if (!detalle || detalle.sublotes.length === 0) {
      return isSecoBuenoLot
        ? 'Registra humedad y factor por sublote para tener una lectura clara del lote.'
        : 'Registra humedad por sublote para tener una lectura clara del lote.';
    }

    if (summary.high > 0) {
      return 'Hay sublotes con humedad alta. Prioriza control de bodega y revisa secado.';
    }

    if (summary.low > 0) {
      return 'Hay sublotes por debajo de 10.5%. Vigila el rendimiento antes de secado.';
    }

    if (summary.pending > 0) {
      return isSecoBuenoLot
        ? 'Completa humedad y factor en los sublotes para cerrar bien el lote.'
        : 'Completa la humedad pendiente para cerrar bien el lote.';
    }

    return isSecoBuenoLot
      ? 'El lote tiene humedad estable y un factor promedio listo para seguimiento.'
      : 'El lote tiene humedad más estable para seguimiento y secado.';
  }, [detalle, isSecoBuenoLot, summary.high, summary.low, summary.pending]);

  const factorPromedioLote = useMemo(() => {
    if (!detalle || !isSecoBuenoLot) return null;

    const lotEntries = detalle.sublotes
      .map((sublote) => {
        const text = (factores[sublote.id] ?? '').trim();
        if (!text) return null;

        const value = Number(text.replace(',', '.'));
        return Number.isFinite(value) ? value : null;
      })
      .filter((value): value is number => value !== null);

    if (lotEntries.length === 0) {
      return getAverageFactorForLot(detalle.lote.id);
    }

    return Number(
      (lotEntries.reduce((sum, value) => sum + value, 0) / lotEntries.length).toFixed(2),
    );
  }, [detalle, factores, isSecoBuenoLot]);

  const updateHumidity = (id: string, value: string) => {
    setHumedades((current) => ({ ...current, [id]: value.replace(',', '.') }));
  };

  const updateFactor = (id: string, value: string) => {
    setFactores((current) => ({ ...current, [id]: value.replace(',', '.') }));
  };

  const guardarTodo = async () => {
    if (!detalle) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload = detalle.sublotes
        .filter((sublote) => !sublote.id.startsWith('secado-'))
        .map((sublote) => {
        const text = (humedades[sublote.id] ?? '').trim();
        if (!text) return { id: sublote.id, humedad: null };

        const value = Number(text);
        if (!Number.isFinite(value) || value < 0 || value > 100) {
          throw new Error(`La humedad de ${sublote.etiqueta} debe estar entre 0 y 100.`);
        }

        return { id: sublote.id, humedad: Number(value.toFixed(1)) };
        });

      const factorPayload = isSecoBuenoLot
        ? detalle.sublotes.map((sublote) => {
            const text = (factores[sublote.id] ?? '').trim();
            if (!text) return { subloteId: sublote.id, factor: null as number | null };

            const value = Number(text);
            if (!Number.isFinite(value) || value < 0 || value > 10) {
              throw new Error(`El factor de ${sublote.etiqueta} debe estar entre 0 y 10.`);
            }

            return { subloteId: sublote.id, factor: Number(value.toFixed(2)) };
          })
        : [];

      if (factorPayload.length > 0) {
        saveFactorsForLot(detalle.lote.id, factorPayload);
      }

      if (payload.length === 0) {
        await cargar();
        setSuccess(
          factorPayload.length > 0
            ? 'Se guardaron los factores del lote seco bueno.'
            : 'Este lote proviene del secado visual. No hay humedades reales por guardar en backend.',
        );
        return;
      }

      const response = await guardarHumedadesSublotes(payload);
      await cargar();
      setSuccess(
        factorPayload.length > 0
          ? `Se guardaron ${response.totalActualizados} humedades y los factores del lote.`
          : `Se guardaron ${response.totalActualizados} humedad${response.totalActualizados === 1 ? '' : 'es'} correctamente.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar las humedades.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] pb-32 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-white/80 bg-[rgba(247,245,255,0.86)] px-4 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate('/inventario')} className="inline-flex h-12 w-12 items-center justify-center rounded-[20px] border border-[#dbe1f0] bg-white text-slate-700 shadow-sm">
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-3">
              <div className="rounded-[22px] bg-[#eef2ff] p-3 text-[#102d92] shadow-inner">
                <Package2 size={22} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Café Smart</p>
                <h1 className="text-[1.9rem] font-black tracking-tight text-[#111827]">Sublotes</h1>
              </div>
            </div>
          </div>
          <CloudStatusBadge />
        </div>
      </header>

      <main className="px-4 py-6 md:px-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <section className="relative overflow-hidden rounded-[34px] bg-[#102d92] p-6 text-white shadow-[0_30px_80px_rgba(16,45,146,0.26)]">
            <div className="absolute right-0 top-0 h-44 w-44 translate-x-8 -translate-y-10 rounded-full bg-white/10 blur-3xl" />
            <div className="relative z-10 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-100">Detalle real del lote</p>
                <h2 className="mt-4 text-[2.7rem] font-black leading-[1.02]">
                  {loading || !detalle ? 'Cargando lote...' : `${detalle.lote.tipoCafe} - ${detalle.lote.calidad}`}
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-blue-100">
                  La humedad la registra el usuario en cada sublote. El lote solo resume esa información para inventario.
                </p>

                <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-[24px] bg-white/10 px-4 py-4 backdrop-blur">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">Sublotes</p>
                    <p className="mt-2 text-[2rem] font-black text-white">{loading || !detalle ? '...' : detalle.sublotes.length}</p>
                  </div>
                  <div className="rounded-[24px] bg-white/10 px-4 py-4 backdrop-blur">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">Peso actual</p>
                    <p className="mt-2 text-[2rem] font-black text-white">{loading || !detalle ? '...' : kg(detalle.lote.pesoActual)}</p>
                  </div>
                  <div className="rounded-[24px] bg-white/10 px-4 py-4 backdrop-blur">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">Humedad prom.</p>
                    <p className="mt-2 text-[2rem] font-black text-white">{loading || !detalle ? '...' : humidity(detalle.lote.humedadPromedio)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-[30px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">Estado del lote</p>
                  <button type="button" onClick={() => void cargar()} className="inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-xs font-black text-white">
                    <RefreshCcw size={14} />
                    Recargar
                  </button>
                </div>
                <p className="mt-4 text-lg font-black text-white">
                  {loading || !detalle ? '...' : storageRange(detalle.lote.diasEnBodegaMin, detalle.lote.diasEnBodegaMax)}
                </p>
                <p className="mt-2 text-sm leading-7 text-blue-100">{secadoHint}</p>

                {!loading && detalle ? (
                  <div className="mt-6 grid gap-3">
                    <div className="rounded-[22px] bg-white/8 px-4 py-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">Humedad pendiente</p>
                      <p className="mt-2 text-2xl font-black text-white">{summary.pending}</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[22px] bg-white/8 px-4 py-4">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">Críticos</p>
                        <p className="mt-2 text-2xl font-black text-white">{summary.high}</p>
                      </div>
                      <div className="rounded-[22px] bg-white/8 px-4 py-4">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">Óptimos</p>
                        <p className="mt-2 text-2xl font-black text-white">{summary.optimal}</p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {!loading && detalle ? (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[28px] border border-[#e5e9f6] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                <div className="mb-4 inline-flex rounded-2xl bg-[#eef2ff] p-3 text-[#102d92]"><Scale size={18} /></div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Peso actual</p>
                <p className="mt-3 text-2xl font-black text-slate-900">{kg(detalle.lote.pesoActual)}</p>
              </div>
              <div className="rounded-[28px] border border-[#e5e9f6] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                <div className="mb-4 inline-flex rounded-2xl bg-[#ecfbf8] p-3 text-[#0f6b6d]"><Droplets size={18} /></div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Humedad promedio</p>
                <p className="mt-3 text-2xl font-black text-slate-900">{humidity(detalle.lote.humedadPromedio)}</p>
              </div>
              {isSecoBuenoLot ? (
                <div className="rounded-[28px] border border-[#e5e9f6] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                  <div className="mb-4 inline-flex rounded-2xl bg-[#eef2ff] p-3 text-[#102d92]"><Scale size={18} /></div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Factor promedio</p>
                  <p className="mt-3 text-2xl font-black text-slate-900">{factorLabel(factorPromedioLote)}</p>
                </div>
              ) : null}
              <div className="rounded-[28px] border border-[#e5e9f6] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                <div className="mb-4 inline-flex rounded-2xl bg-[#fff4e9] p-3 text-[#b25a1a]"><Clock3 size={18} /></div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Antigüedad</p>
                <p className="mt-3 text-lg font-black text-slate-900">{storageRange(detalle.lote.diasEnBodegaMin, detalle.lote.diasEnBodegaMax)}</p>
              </div>
              <div className="rounded-[28px] border border-[#e5e9f6] bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
                <div className="mb-4 inline-flex rounded-2xl bg-[#fff0f4] p-3 text-[#a31d3e]"><Package2 size={18} /></div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Primer ingreso</p>
                <p className="mt-3 text-lg font-black text-slate-900">{date(detalle.lote.fechaPrimerIngreso)}</p>
              </div>
            </section>
          ) : null}

          <section className="rounded-[30px] border border-[#dbe4ff] bg-[linear-gradient(135deg,#eef3ff_0%,#f5f7ff_100%)] px-5 py-5 shadow-[0_18px_35px_rgba(15,23,42,0.05)]">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-[#102d92] p-3 text-white"><Info size={18} /></div>
              <div>
                <p className="text-lg font-black text-[#102d92]">Seguimiento de humedad</p>
                <p className="mt-2 text-sm leading-7 text-slate-600">{secadoHint}</p>
              </div>
            </div>
          </section>

          {error ? <div className="rounded-[26px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">{error}</div> : null}
          {success ? <div className="rounded-[26px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">{success}</div> : null}

          {!loading && !detalle ? (
            <section className="rounded-[32px] border border-dashed border-[#d8dceb] bg-white px-5 py-12 text-center shadow-[0_18px_40px_rgba(15,23,42,0.04)]">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#eef2ff] text-[#102d92]"><Package2 size={24} /></div>
              <h3 className="mt-5 text-2xl font-black text-slate-900">No se pudo cargar el lote</h3>
              <p className="mt-3 text-base leading-7 text-slate-500">Regresa al inventario o vuelve a cargar el detalle.</p>
            </section>
          ) : null}

          {loading ? <section className="rounded-[32px] border border-[#e5e9f6] bg-white px-5 py-12 text-center shadow-[0_18px_40px_rgba(15,23,42,0.04)]"><p className="text-lg font-semibold text-slate-500">Cargando sublotes...</p></section> : null}

          <section className="grid gap-4">
            {detalle?.sublotes.map((sublote) => {
              const state = sublotState(sublote.humedad);

              return (
                <article key={sublote.id} className="relative overflow-hidden rounded-[30px] border border-[#e5e9f6] bg-white p-5 shadow-[0_20px_48px_rgba(15,23,42,0.08)]">
                  <div className={`absolute left-0 top-0 h-full w-2 ${state.stripe}`} />

                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-[2rem] font-black leading-none text-[#102d92]">{sublote.etiqueta}</h3>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold ${state.badge}`}>{state.label}</span>
                        <span className="rounded-full bg-[#f4f6fb] px-3 py-1 text-xs font-bold text-slate-600">{kg(sublote.pesoActual)}</span>
                        <span className="rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-bold text-[#102d92]">{dayLabel(sublote.diasEnBodega)}</span>
                      </div>
                      <p className="mt-4 text-sm leading-7 text-slate-500">Ingreso {date(sublote.fechaIngreso)} · {sublote.tipoCafe} / {sublote.calidad}</p>
                    </div>

                    <div className={`inline-flex rounded-2xl p-3 ${state.panel}`}>{state.icon}</div>
                  </div>

                  <div className="mt-6 grid gap-3 md:grid-cols-3">
                    <div className="rounded-[24px] bg-[#f8f9ff] px-4 py-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Peso disponible</p>
                      <p className="mt-3 text-xl font-black text-slate-900">{kg(sublote.pesoActual)}</p>
                    </div>
                    <div className="rounded-[24px] bg-[#f8f9ff] px-4 py-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Humedad actual</p>
                      <p className="mt-3 text-xl font-black text-slate-900">{humidity(sublote.humedad)}</p>
                    </div>
                    {isSecoBuenoLot ? (
                      <div className="rounded-[24px] bg-[#f8f9ff] px-4 py-4">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Factor actual</p>
                        <p className="mt-3 text-xl font-black text-slate-900">{factorLabel(getFactorForSublote(sublote.id))}</p>
                      </div>
                    ) : null}
                    <div className={`rounded-[24px] px-4 py-4 ${state.panel}`}>
                      <p className="text-xs font-black uppercase tracking-[0.18em] opacity-70">Estado de humedad</p>
                      <p className="mt-3 text-sm font-bold leading-7">{state.note}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <div className="rounded-[24px] border border-[#dfe5f2] bg-[#fbfbff] px-4 py-4">
                      <label htmlFor={`humedad-${sublote.id}`} className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        Humedad del sublote (%)
                      </label>
                      <input
                        id={`humedad-${sublote.id}`}
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        min="0"
                        max="100"
                        value={humedades[sublote.id] ?? ''}
                        onChange={(event) => updateHumidity(sublote.id, event.target.value)}
                        className="w-full rounded-[22px] border border-[#dfe5f2] bg-white px-4 py-4 text-base font-semibold text-slate-900 outline-none transition placeholder:text-base placeholder:font-semibold placeholder:text-slate-400 focus:border-[#102d92]"
                        placeholder="Ingresa la humedad Ej. 11"
                      />
                      {isSecoBuenoLot ? (
                        <div className="mt-4">
                          <label htmlFor={`factor-${sublote.id}`} className="mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                            Factor del sublote
                          </label>
                          <input
                            id={`factor-${sublote.id}`}
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            max="10"
                            value={factores[sublote.id] ?? ''}
                            onChange={(event) => updateFactor(sublote.id, event.target.value)}
                            className="w-full rounded-[22px] border border-[#dfe5f2] bg-white px-4 py-4 text-base font-semibold text-slate-900 outline-none transition placeholder:text-base placeholder:font-semibold placeholder:text-slate-400 focus:border-[#102d92]"
                            placeholder="Ingresa el factor Ej. 1.85"
                          />
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-[24px] bg-[#f6f7fd] px-4 py-4">
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Recomendación</p>
                      <p className="mt-3 text-base font-bold leading-8 text-slate-700">
                        Mantener mediciones claras por sublote ayuda a que el lote agrupado refleje mejor la bodega.
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 z-20 border-t border-white/70 bg-[rgba(255,255,255,0.88)] px-4 py-4 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="rounded-[24px] bg-[#f4f6fb] px-4 py-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Cambios pendientes</p>
            <p className="mt-2 text-lg font-black text-slate-900">
              {pendingChanges > 0 ? `${pendingChanges} por guardar` : 'Sin cambios pendientes'}
            </p>
          </div>

          <div className="grid w-full gap-3 md:w-auto md:grid-cols-2">
            <button
              type="button"
              onClick={() => navigate('/inventario')}
              className="inline-flex min-h-[56px] items-center justify-center gap-3 rounded-[24px] border border-[#dbe1ef] bg-white px-6 py-4 text-sm font-black text-slate-700"
            >
              <ArrowLeft size={18} />
              Regresar
            </button>
            <button
              type="button"
              onClick={() => void guardarTodo()}
              disabled={saving || loading || !detalle}
              className="inline-flex min-h-[56px] items-center justify-center gap-3 rounded-[24px] bg-[#102d92] px-6 py-4 text-sm font-black text-white shadow-[0_22px_50px_rgba(16,45,146,0.24)] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Save size={18} />
              {saving ? 'Guardando...' : isSecoBuenoLot ? 'Guardar humedad y factor' : 'Guardar humedades'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
