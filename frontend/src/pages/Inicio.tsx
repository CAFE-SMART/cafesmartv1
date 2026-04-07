import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeAlert,
  Clock3,
  Coffee,
  Leaf,
  RefreshCcw,
  SunMedium,
  Warehouse,
} from 'lucide-react';
import { AppBottomNav } from '../components/AppBottomNav';
import { CloudStatusBadge } from '../components/CloudStatusBadge';
import { useUser } from '../context/UserContext';
import { obtenerLotes, type LoteResumen } from '../services/lotesService';
import { getBodegaConfig } from '../utils/bodegaConfig';
import { applySecadoToLots } from '../utils/secadoFlow';

type ResumenTipoCard = {
  tipoCafe: string;
  totalKg: number;
  diasMax: number;
  lotes: number;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value);
}

function formatKg(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value)} kg`;
}

function getInitial(name: string | null | undefined) {
  return (name?.trim()?.charAt(0) || 'U').toUpperCase();
}

function stylesByType(tipoCafe: string) {
  const tipo = tipoCafe.trim().toUpperCase();

  if (tipo === 'VERDE') {
    return {
      title: 'text-[#205f2e]',
      icon: <Leaf size={18} />,
      accent: 'bg-[#205f2e]',
      soft: 'bg-[#eff8f0]',
      text: 'text-[#205f2e]',
    };
  }

  if (tipo === 'SECO') {
    return {
      title: 'text-[#9a4314]',
      icon: <SunMedium size={18} />,
      accent: 'bg-[#b65a1e]',
      soft: 'bg-[#fdf3ed]',
      text: 'text-[#9a4314]',
    };
  }

  if (tipo === 'PASILLA') {
    return {
      title: 'text-[#a21440]',
      icon: <BadgeAlert size={18} />,
      accent: 'bg-[#b31748]',
      soft: 'bg-[#fff0f5]',
      text: 'text-[#a21440]',
    };
  }

  return {
    title: 'text-[#102d92]',
    icon: <Coffee size={18} />,
    accent: 'bg-[#102d92]',
    soft: 'bg-[#eef1ff]',
    text: 'text-[#102d92]',
  };
}

function TipoCard({ item }: { item: ResumenTipoCard }) {
  const estilos = stylesByType(item.tipoCafe);
  const barra = Math.min(100, Math.max(16, item.diasMax * 6));
  const estadoLabel =
    item.tipoCafe.toUpperCase() === 'PASILLA' && item.totalKg <= 150
      ? 'Stock crítico'
      : `${item.diasMax} días`;

  return (
    <article className="rounded-[24px] border border-[#e6e8f3] bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`text-[0.9rem] font-black uppercase tracking-[0.16em] ${estilos.title}`}>
            {item.tipoCafe}
          </p>
        </div>
        <div className={`rounded-2xl p-2.5 ${estilos.soft} ${estilos.text}`}>{estilos.icon}</div>
      </div>

      <div className="mt-4 flex items-end gap-2">
        <p className="text-[2.1rem] font-black leading-none text-slate-900">
          {formatNumber(item.totalKg)}
        </p>
        <span className="pb-1 text-[1.3rem] font-semibold text-slate-400">kg</span>
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-400">
          {item.tipoCafe.toUpperCase() === 'PASILLA' && item.totalKg <= 150
            ? 'Estado'
            : 'Días en bodega'}
        </p>
        <p className={`mt-2 text-[1.2rem] font-black leading-tight ${estilos.text}`}>
          {estadoLabel}
        </p>

        <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${estilos.accent}`} style={{ width: `${barra}%` }} />
        </div>

        <p className="mt-3 text-sm leading-6 text-slate-500">
          {item.lotes} lote{item.lotes === 1 ? '' : 's'} en bodega.
        </p>
      </div>
    </article>
  );
}

export default function Inicio() {
  const navigate = useNavigate();
  const { user, hydrated } = useUser();
  const [lotes, setLotes] = useState<LoteResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bodegaConfig, setBodegaConfig] = useState(() => getBodegaConfig());

  const cargarLotes = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await obtenerLotes();
      setLotes(applySecadoToLots(data));
      setBodegaConfig(getBodegaConfig());
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo cargar el resumen del inventario.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!hydrated) return;
    void cargarLotes();
  }, [hydrated]);

  const resumenGeneral = useMemo(() => {
    const totalKg = lotes.reduce((sum, lote) => sum + lote.pesoActual, 0);
    const loteMasAntiguo = lotes.reduce<LoteResumen | null>((previo, actual) => {
      if (!previo) return actual;
      return actual.diasEnBodegaMax > previo.diasEnBodegaMax ? actual : previo;
    }, null);
    const capacidadKg = bodegaConfig.capacidadKg;
    const disponibleKg = Math.max(0, capacidadKg - totalKg);
    const ocupacionPct =
      capacidadKg > 0 ? Math.min(100, Math.round((totalKg / capacidadKg) * 100)) : 0;

    return {
      totalKg,
      loteMasAntiguo,
      lotesAgrupados: lotes.length,
      capacidadKg,
      disponibleKg,
      ocupacionPct,
    };
  }, [bodegaConfig.capacidadKg, lotes]);

  const resumenPorTipo = useMemo(() => {
    const baseOrder = ['VERDE', 'SECO', 'PASILLA'];
    const grouped = new Map<string, ResumenTipoCard>();

    for (const tipo of baseOrder) {
      grouped.set(tipo, {
        tipoCafe: tipo,
        totalKg: 0,
        diasMax: 0,
        lotes: 0,
      });
    }

    for (const lote of lotes) {
      const key = lote.tipoCafe.trim().toUpperCase();
      const actual =
        grouped.get(key) ??
        ({
          tipoCafe: lote.tipoCafe,
          totalKg: 0,
          diasMax: 0,
          lotes: 0,
        } as ResumenTipoCard);

      actual.tipoCafe = lote.tipoCafe;
      actual.totalKg += lote.pesoActual;
      actual.diasMax = Math.max(actual.diasMax, lote.diasEnBodegaMax);
      actual.lotes += 1;
      grouped.set(key, actual);
    }

    return [...grouped.values()];
  }, [lotes]);

  const lotesPreview = useMemo(
    () => [...lotes].sort((a, b) => b.diasEnBodegaMax - a.diasEnBodegaMax).slice(0, 3),
    [lotes],
  );

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f2fb_100%)] px-4 py-6 pb-[160px] text-slate-900">
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-6">
        <header className="rounded-[28px] border border-white/80 bg-white/90 px-5 py-5 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-4">
              <div className="rounded-[24px] bg-[#eef2ff] p-4 text-[#102d92] shadow-inner">
                <Coffee size={24} />
              </div>
              <div className="min-w-0">
                <p className="text-[1.2rem] font-black tracking-tight text-[#102d92]">Café Smart</p>
                <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                  Resumen operativo
                </p>
                <h1 className="mt-3 text-[1.55rem] font-black leading-tight text-[#121826]">
                  Hola, {user?.name?.trim() ? user.name : 'usuario'}
                </h1>
                <p className="mt-2 max-w-[24rem] text-[0.92rem] leading-6 text-slate-500">
                  Visualiza los lotes disponibles en bodega y entra rápido al inventario.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start gap-3">
              <CloudStatusBadge compact className="max-w-[220px]" />
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void cargarLotes()}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600"
                >
                  <RefreshCcw size={16} />
                  Recargar
                </button>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d7ecd4] text-[#1f5e34] shadow-inner">
                  <span className="text-sm font-black">{getInitial(user?.name)}</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="relative overflow-hidden rounded-[30px] bg-[#102d92] p-5 text-white shadow-[0_28px_70px_rgba(16,45,146,0.28)]">
          <div className="absolute right-0 top-0 h-40 w-40 translate-x-10 -translate-y-8 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute bottom-0 right-4 text-white/10">
            <Warehouse size={150} strokeWidth={1.4} />
          </div>

          <div className="relative z-10">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-blue-100">
              Capacidad en bodega
            </p>
            <div className="mt-4 flex items-end gap-3">
              <p className="text-[2.7rem] font-black leading-none">
                {loading ? '...' : formatNumber(resumenGeneral.totalKg)}
              </p>
              <span className="pb-1.5 text-[1.35rem] font-semibold text-blue-100">
                / {formatNumber(resumenGeneral.capacidadKg)} kg
              </span>
            </div>

            <p className="mt-3 text-sm font-semibold text-blue-100">
              {resumenGeneral.ocupacionPct}% ocupada / {formatNumber(resumenGeneral.disponibleKg)} kg disponibles
            </p>

            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-white"
                style={{ width: `${resumenGeneral.ocupacionPct}%` }}
              />
            </div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] bg-white/10 px-4 py-4 backdrop-blur">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">
                  Lotes agrupados
                </p>
                <p className="mt-2 text-2xl font-black text-white">
                  {loading ? '...' : formatNumber(resumenGeneral.lotesAgrupados)}
                </p>
              </div>
              <div className="rounded-[22px] bg-white/10 px-4 py-4 backdrop-blur">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">
                  Lote más antiguo
                </p>
                {loading ? (
                  <p className="mt-2 text-lg font-black text-white">Cargando...</p>
                ) : resumenGeneral.loteMasAntiguo ? (
                  <div className="mt-2">
                    <p className="text-lg font-black text-white">
                      {resumenGeneral.loteMasAntiguo.codigo}
                    </p>
                    <p className="mt-1 text-sm text-blue-100">
                      {resumenGeneral.loteMasAntiguo.tipoCafe} / {resumenGeneral.loteMasAntiguo.diasEnBodegaMax} días
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-lg font-black text-white">Sin lotes</p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/inventario')}
              className="mt-6 inline-flex items-center justify-center gap-3 rounded-full border border-white/25 bg-white/10 px-6 py-4 text-base font-black text-white backdrop-blur"
            >
              Ver inventario
              <ArrowRight size={20} />
            </button>
          </div>
        </section>

        {error ? (
          <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 text-base text-rose-700">
            No pude cargar el inventario: {error}
          </div>
        ) : null}

        <section>
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-[1.45rem] font-black tracking-tight text-[#121826]">
                Niveles de Inventario
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Resumen por tipo de café para ubicar rápido lo disponible.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/inventario')}
              className="text-sm font-black uppercase tracking-[0.12em] text-[#102d92]"
            >
              Ver todo
            </button>
          </div>

          {loading ? (
            <div className="rounded-[28px] border border-[#e6e8f3] bg-white px-5 py-8 text-center text-base text-slate-500 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
              Cargando inventario...
            </div>
          ) : (
            <div className="grid gap-4">
              {resumenPorTipo.map((item) => (
                <TipoCard key={item.tipoCafe} item={item} />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[30px] border border-[#e6e8f3] bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-400">
                Vista rápida
              </p>
              <h3 className="mt-1 text-[1.35rem] font-black text-slate-900">Lotes más antiguos</h3>
            </div>
            <div className="rounded-2xl bg-[#eef1ff] p-3 text-[#102d92]">
              <Clock3 size={18} />
            </div>
          </div>

          {lotesPreview.length > 0 ? (
            <div className="mt-5 grid gap-4">
              {lotesPreview.map((lote) => (
                <article
                  key={lote.id}
                  className="rounded-[24px] border border-slate-100 bg-[#f8f8fc] px-4 py-4"
                >
                  <div className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    {lote.tipoCafe} / {lote.calidad}
                  </div>
                  <h4 className="mt-3 text-lg font-black text-slate-900">{lote.codigo}</h4>
                  <p className="mt-1 text-sm text-slate-500">
                    {lote.sublotes} sublote{lote.sublotes === 1 ? '' : 's'} / {lote.diasEnBodegaMax} días en bodega
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                        Peso actual
                      </p>
                      <p className="mt-1 text-lg font-black text-slate-900">
                        {formatKg(lote.pesoActual)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/inventario')}
                      className="inline-flex items-center gap-2 rounded-full bg-[#102d92] px-4 py-2 text-sm font-black text-white"
                    >
                      Ver
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-[24px] border border-dashed border-slate-200 bg-[#fafafe] px-4 py-8 text-center text-base text-slate-500">
              Todavía no hay lotes para mostrar.
            </div>
          )}
        </section>
      </div>

      <AppBottomNav />
    </div>
  );
}
