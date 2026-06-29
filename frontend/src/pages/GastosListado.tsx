import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus, Receipt, RefreshCcw } from 'lucide-react';
import {
  actualizarEstadoGasto,
  listarGastos,
  type GastoEstadoPago,
  type GastoItem,
} from '../services/gastosService';
import { formatoMoneda } from '../utils/formatMoney';

function formatCurrency(value: number) {
  return formatoMoneda(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const days = Math.round((today.getTime() - target.getTime()) / 86_400_000);

  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days > 1 && days <= 6) return `${days} días`;

  return formatDate(value);
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function shouldShowExpenseType(gasto: GastoItem) {
  const concepto = gasto.conceptoGasto.trim().toLowerCase();
  const tipo = gasto.tipoGasto.trim().toLowerCase().replace(/_/g, ' ');

  return tipo.length > 0 && !concepto.includes(tipo);
}

export default function GastosListado() {
  const navigate = useNavigate();
  const [, setCurrencyTick] = useState(0);
  useEffect(() => {
    const handleCurrencyChange = () => setCurrencyTick((t) => t + 1);
    window.addEventListener('cafesmart_currency_changed', handleCurrencyChange);
    return () => {
      window.removeEventListener('cafesmart_currency_changed', handleCurrencyChange);
    };
  }, []);
  const [searchParams] = useSearchParams();
  const subloteId = searchParams.get('subloteId') ?? undefined;
  const [gastos, setGastos] = useState<GastoItem[]>([]);
  const [estadoFiltro, setEstadoFiltro] = useState<GastoEstadoPago | 'TODOS'>(
    'PENDIENTE',
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actualizandoId, setActualizandoId] = useState<string | null>(null);

  const cargar = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const data = await listarGastos(subloteId);
        setGastos(data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'No se pudieron cargar los gastos.',
        );
        setGastos([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [subloteId],
  );

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const gastosFiltrados = useMemo(() => {
    if (estadoFiltro === 'TODOS') {
      return gastos;
    }

    return gastos.filter((gasto) => gasto.estadoPago === estadoFiltro);
  }, [estadoFiltro, gastos]);

  const totalAcumulado = useMemo(
    () => gastosFiltrados.reduce((sum, gasto) => sum + gasto.montoGasto, 0),
    [gastosFiltrados],
  );

  const marcarPagado = async (gastoId: string) => {
    setActualizandoId(gastoId);

    try {
      const actualizado = await actualizarEstadoGasto(gastoId, 'PAGADO');
      setGastos((actual) =>
        actual.map((gasto) => (gasto.id === gastoId ? actualizado : gasto)),
      );
    } finally {
      setActualizandoId(null);
    }
  };

  const resumenTexto =
    estadoFiltro === 'PENDIENTE'
      ? 'Suma de gastos pendientes por pagar.'
      : estadoFiltro === 'PAGADO'
        ? 'Suma de gastos pagados.'
        : 'Suma de todos tus gastos registrados.';

  return (
    <div className="min-h-screen bg-[#eef2f6] px-4 py-3 pb-24 text-slate-900">
      <main className="mx-auto w-full max-w-[430px] rounded-[24px] border border-[#dbe2ee] bg-white px-3 py-3 shadow-[0_14px_38px_rgba(15,23,42,0.06)]">
        <header className="grid h-10 grid-cols-[36px_1fr_36px] items-center">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#102d92]"
            aria-label="Volver"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-center text-[0.82rem] font-black">
            {subloteId ? 'Gastos del sublote' : 'Gastos generales'}
          </h1>
          <button
            type="button"
            onClick={() => void cargar(true)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400"
            aria-label="Recargar gastos"
          >
            <RefreshCcw
              size={14}
              className={refreshing ? 'animate-spin' : ''}
            />
          </button>
        </header>

        <section className="mt-3 rounded-[12px] border border-[#dbe2ee] bg-[#f8fafc] px-3 py-3">
          <p className="text-[0.85rem] font-semibold text-slate-800">
            Total acumulado
          </p>
          <p className="mt-1 text-[1.25rem] font-black text-[#102d92]">
            {loading ? '...' : formatCurrency(totalAcumulado)}
          </p>
          <p className="mt-1 text-[0.58rem] font-semibold leading-4 text-slate-500">
            {resumenTexto}
          </p>
        </section>

        <button
          type="button"
          onClick={() => navigate('/gastos/registro')}
          className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-[10px] bg-[#2051e5] px-4 text-[0.72rem] font-black text-white shadow-[0_8px_18px_rgba(32,81,229,0.2)]"
        >
          <Plus size={14} />
          Registrar gasto
        </button>

        {error ? (
          <section className="mt-3 rounded-[8px] border border-rose-200 bg-rose-50 px-3 py-3 text-[0.68rem] font-semibold text-rose-700">
            {error}
          </section>
        ) : null}

        <div className="mt-3 grid grid-cols-3 rounded-[12px] bg-[#eef2f8] p-1">
          {[
            ['PENDIENTE', 'Pendientes'],
            ['PAGADO', 'Pagados'],
            ['TODOS', 'Todos'],
          ].map(([value, label]) => {
            const active = estadoFiltro === value;

            return (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setEstadoFiltro(value as GastoEstadoPago | 'TODOS')
                }
                className={`h-8 rounded-[9px] text-[0.62rem] font-black transition ${
                  active
                    ? 'bg-white text-[#102d92] shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <section className="mt-3 space-y-2">
          {!loading && gastosFiltrados.length > 0 ? (
            <div className="flex items-center justify-between px-1">
              <p className="text-[0.85rem] font-semibold text-slate-800">
                {estadoFiltro === 'PENDIENTE'
                  ? 'Gastos pendientes'
                  : estadoFiltro === 'PAGADO'
                    ? 'Gastos pagados'
                    : 'Gastos recientes'}
              </p>
              <span className="text-[0.56rem] font-bold text-slate-400">
                {gastosFiltrados.length}{' '}
                {gastosFiltrados.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-[12px] border border-[#eeeeee] bg-white px-3 py-5 text-center text-[0.72rem] font-semibold text-slate-500">
              Cargando gastos...
            </div>
          ) : null}

          {!loading && gastosFiltrados.length === 0 && !error ? (
            <div className="rounded-[14px] border border-[#dbe2ee] bg-white px-4 py-6 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#eef4ff] text-[#2051e5]">
                <Receipt size={18} />
              </div>
              <p className="mt-3 text-[0.76rem] font-black text-slate-900">
                {gastos.length === 0
                  ? 'Aún no has registrado gastos'
                  : estadoFiltro === 'PENDIENTE'
                    ? 'No tienes gastos pendientes'
                    : 'No hay gastos en este filtro'}
              </p>
              <p className="mx-auto mt-1 max-w-[230px] text-[0.64rem] font-semibold leading-5 text-slate-500">
                {gastos.length === 0
                  ? 'Registra el primero para empezar a gestionarlos.'
                  : 'Cambia el filtro para ver otros gastos.'}
              </p>
            </div>
          ) : null}

          {!loading
            ? gastosFiltrados.map((gasto) => (
                <article
                  key={gasto.id}
                  className="rounded-[12px] border border-[#eeeeee] bg-white px-3 py-3 shadow-[0_3px_10px_rgba(15,23,42,0.035)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[0.76rem] font-black text-[#202020]">
                        {gasto.conceptoGasto}
                      </p>
                      {shouldShowExpenseType(gasto) ? (
                        <p className="mt-1 text-xs font-semibold text-slate-700">
                          {titleCase(gasto.tipoGasto)}
                        </p>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-[0.78rem] font-black text-[#102d92]">
                      {formatCurrency(gasto.montoGasto)}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-[0.6rem] font-semibold text-slate-500">
                    <span>{formatRelativeDate(gasto.fechaGasto)}</span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-bold ${
                        gasto.estadoPago === 'PAGADO'
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-amber-55 bg-amber-50 text-amber-800'
                      }`}
                    >
                      {titleCase(gasto.estadoPago)}
                    </span>
                  </div>
                  {gasto.estadoPago === 'PENDIENTE' ? (
                    <button
                      type="button"
                      onClick={() => void marcarPagado(gasto.id)}
                      disabled={actualizandoId === gasto.id}
                      className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-[10px] bg-[#eef3ff] text-[0.66rem] font-black text-[#173b9c] disabled:opacity-60"
                    >
                      {actualizandoId === gasto.id
                        ? 'Guardando...'
                        : 'Marcar como pagado'}
                    </button>
                  ) : null}
                </article>
              ))
            : null}
        </section>
      </main>
    </div>
  );
}
