import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDays, Plus, Receipt } from 'lucide-react';
import { RefreshButton } from '../components/RefreshButton';
import { SmartSelect } from '../components/SmartSelect';
import { listarGastos, type GastoItem } from '../services/gastosService';
import {
  BUSINESS_MIN_DATE_VALUE,
  formatDateLabel,
  getTodayLocalDateValue,
} from '../utils/date';

function formatCurrency(value: number) {
  return `$ ${new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
  }).format(value)}`;
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

function formatLongDateLabel(value: string) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];
const WEEKDAYS_ES = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

function parseLocalDateValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
}

function formatLocalDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function GastosDatePicker({
  value,
  open,
  onToggle,
  onClose,
  onChange,
}: {
  value: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onChange: (value: string) => void;
}) {
  const min = BUSINESS_MIN_DATE_VALUE;
  const max = getTodayLocalDateValue();
  const selectedDate = parseLocalDateValue(value);
  const maxDate = parseLocalDateValue(max) ?? new Date();
  const minDate = parseLocalDateValue(min) ?? new Date(2026, 0, 1);
  const visibleDate = selectedDate ?? maxDate;
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(visibleDate.getFullYear(), visibleDate.getMonth(), 1),
  );

  useEffect(() => {
    if (open) {
      const nextDate = parseLocalDateValue(value) ?? maxDate;
      setVisibleMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    }
  }, [max, open, value]);

  const days = useMemo(() => {
    const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const daysInMonth = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + 1,
      0,
    ).getDate();
    return [
      ...Array.from({ length: firstDay.getDay() }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => {
        const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index + 1);
        return { day: index + 1, value: formatLocalDateValue(date) };
      }),
    ];
  }, [visibleMonth]);

  const previousMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
  const nextMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
  const canGoPrevious = previousMonth >= new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const canGoNext = nextMonth <= new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onClose();
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        {...(open
          ? ({ 'aria-expanded': 'true' } as const)
          : ({ 'aria-expanded': 'false' } as const))}
        className={`flex min-h-[42px] w-full items-center justify-between gap-2 rounded-[12px] border bg-white px-3 text-left text-[0.72rem] font-black text-[#08256d] ${
          open ? 'border-[#102d92]' : 'border-[#dbe2f0]'
        }`}
      >
        <span>{value ? formatLongDateLabel(value) : 'Fechas'}</span>
        <CalendarDays size={15} className="text-[#102d92]" />
      </button>

      {open ? (
        <div className="absolute left-1/2 z-40 mt-2 w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 rounded-[18px] border border-[#d5deee] bg-white p-2 shadow-[0_18px_38px_rgba(15,23,42,0.16)]">
          <div className="flex items-center justify-between gap-2 px-1 pb-2">
            <button
              type="button"
              disabled={!canGoPrevious}
              onClick={() => setVisibleMonth(previousMonth)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#102d92] hover:bg-[#eef4ff] disabled:text-slate-300"
              aria-label="Mes anterior"
            >
              <ArrowLeft size={17} />
            </button>
            <p className="rounded-full bg-[#f8faff] px-4 py-2 text-sm font-black text-slate-900">
              {MONTHS_ES[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
            </p>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => setVisibleMonth(nextMonth)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#102d92] hover:bg-[#eef4ff] disabled:text-slate-300"
              aria-label="Mes siguiente"
            >
              <ArrowRight size={17} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 px-1">
            {WEEKDAYS_ES.map((day) => (
              <span key={day} className="py-1.5 text-center text-[0.7rem] font-black text-slate-500">
                {day}
              </span>
            ))}
            {days.map((day, index) =>
              day ? (
                <button
                  key={day.value}
                  type="button"
                  disabled={day.value < min || day.value > max}
                  onClick={() => {
                    onChange(day.value);
                    onClose();
                  }}
                  className={`h-8 rounded-full text-xs font-black disabled:text-slate-300 ${
                    day.value === value
                      ? 'bg-[#102d92] text-white'
                      : day.value === max
                        ? 'bg-[#eef4ff] text-[#102d92]'
                        : 'text-slate-800 hover:bg-[#f4f7ff]'
                  }`}
                >
                  {day.day}
                </button>
              ) : (
                <span key={`empty-${index}`} />
              ),
            )}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-[#edf1f7] px-1 pt-2">
            <button
              type="button"
              onClick={() => {
                onChange('');
                onClose();
              }}
              className="rounded-full px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-100"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(max);
                onClose();
              }}
              className="rounded-full bg-[#eef4ff] px-3 py-2 text-xs font-black text-[#102d92]"
            >
              Hoy
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function GastosListado() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const subloteId = searchParams.get('subloteId') ?? undefined;
  const [gastos, setGastos] = useState<GastoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtroFecha, setFiltroFecha] = useState('');
  const [filtroFechaOpen, setFiltroFechaOpen] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('TODOS');
  const [orden, setOrden] = useState<'recent' | 'oldest'>('recent');
  const requestRef = useRef<AbortController | null>(null);

  const cargar = useCallback(
    async (isRefresh = false) => {
      requestRef.current?.abort();
      const controller = new AbortController();
      requestRef.current = controller;
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const data = await listarGastos({
          subloteId,
          fecha: filtroFecha || undefined,
          tipo: filtroTipo,
          orden,
          signal: controller.signal,
        });
        setGastos(
          subloteId ? data : data.filter((gasto) => gasto.esGastoGeneral),
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setError('No pudimos cargar los gastos. Intenta nuevamente.');
        setGastos([]);
      } finally {
        if (requestRef.current === controller) {
          requestRef.current = null;
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [filtroFecha, filtroTipo, orden, subloteId],
  );

  useEffect(() => {
    void cargar();
    return () => requestRef.current?.abort();
  }, [cargar]);

  const gastosFiltrados = useMemo(() => {
    return [...gastos]
      .filter((gasto) => !filtroFecha || gasto.fechaGasto.slice(0, 10) === filtroFecha)
      .filter((gasto) => filtroTipo === 'TODOS' || gasto.tipoGasto === filtroTipo)
      .sort((a, b) =>
        orden === 'oldest'
          ? new Date(a.fechaGasto).getTime() - new Date(b.fechaGasto).getTime()
          : new Date(b.fechaGasto).getTime() - new Date(a.fechaGasto).getTime(),
      );
  }, [filtroFecha, filtroTipo, gastos, orden]);

  const totalAcumulado = useMemo(
    () => gastosFiltrados.reduce((sum, gasto) => sum + gasto.montoGasto, 0),
    [gastosFiltrados],
  );
  const filtrosActivos =
    Boolean(filtroFecha) || filtroTipo !== 'TODOS' || orden !== 'recent';

  return (
    <div className="min-h-screen bg-[#eef2f6] px-4 py-3 pb-24 text-slate-900">
      <main className="mx-auto w-full max-w-[430px] rounded-[24px] border border-[#dbe2ee] bg-white px-3 py-3 shadow-[0_14px_38px_rgba(15,23,42,0.06)]">
        <header className="grid min-h-10 grid-cols-[36px_1fr_auto] items-center gap-2">
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
          <RefreshButton
            onClick={() => void cargar(true)}
            loading={refreshing}
            aria-label="Recargar gastos"
          >
            {refreshing ? 'Recargando...' : 'Recargar'}
          </RefreshButton>
        </header>

        <section className="mt-3 rounded-[12px] border border-[#dbe2ee] bg-[#f8fafc] px-3 py-3">
          <p className="text-[0.56rem] font-black uppercase tracking-[0.12em] text-[#73829a]">
            Total acumulado
          </p>
          <p className="mt-1 text-[1.25rem] font-black text-[#102d92]">
            {loading ? '...' : formatCurrency(totalAcumulado)}
          </p>
          <p className="mt-1 text-[0.58rem] font-semibold leading-4 text-slate-500">
            Suma de todos tus gastos registrados.
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

        <section className="mt-3 rounded-[14px] border border-[#dbe2ee] bg-[#f8faff] px-3 py-3">
          <div className="grid grid-cols-2 gap-2 min-[430px]:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-[0.62rem] font-black text-slate-700">
                Fecha
              </span>
              <GastosDatePicker
                value={filtroFecha}
                open={filtroFechaOpen}
                onToggle={() => setFiltroFechaOpen((open) => !open)}
                onClose={() => setFiltroFechaOpen(false)}
                onChange={setFiltroFecha}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[0.62rem] font-black text-slate-700">
                Tipo
              </span>
              <SmartSelect
                value={filtroTipo}
                onChange={(event) => setFiltroTipo(event.target.value)}
                className="h-10 rounded-[12px] text-[0.62rem]"
              >
                <option value="TODOS">Todos</option>
                <option value="TRANSPORTE">Transporte</option>
                <option value="COMIDA">Comida</option>
                <option value="SECADO">Secado</option>
                <option value="CARGUE">Cargue</option>
                <option value="DESCARGUE">Descargue</option>
                <option value="OTROS">Otros</option>
              </SmartSelect>
            </label>
            <label className="col-span-2 block min-[430px]:col-span-1">
              <span className="mb-1 block text-[0.62rem] font-black text-slate-700">
                Ordenar por
              </span>
              <SmartSelect
                value={orden}
                onChange={(event) => setOrden(event.target.value as 'recent' | 'oldest')}
                className="h-10 rounded-[12px] text-[0.62rem]"
              >
                <option value="recent">Más recientes</option>
                <option value="oldest">Más antiguos</option>
              </SmartSelect>
            </label>
          </div>
          {filtroFecha ? (
            <p className="mt-2 rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-[0.62rem] font-semibold leading-4 text-amber-800">
              Mostrando registros filtrados por fecha. Usa “Limpiar” para volver a ver todos.
            </p>
          ) : null}
          {filtrosActivos ? (
            <button
              type="button"
              onClick={() => {
                setFiltroFecha('');
                setFiltroFechaOpen(false);
                setFiltroTipo('TODOS');
                setOrden('recent');
              }}
              className="mt-2 inline-flex min-h-[36px] w-full items-center justify-center rounded-[11px] border border-[#d5deee] bg-white px-3 text-[0.64rem] font-black text-[#334b85]"
            >
              Limpiar filtros
            </button>
          ) : null}
        </section>

        {error ? (
          <section className="mt-3 rounded-[8px] border border-rose-200 bg-rose-50 px-3 py-3 text-[0.68rem] font-semibold text-rose-700">
            {error}
          </section>
        ) : null}

        <section className="mt-3 space-y-2">
          {!loading && gastos.length > 0 ? (
            <div className="flex items-center justify-between px-1">
              <p className="text-[0.56rem] font-black uppercase tracking-[0.12em] text-[#73829a]">
                Gastos recientes
              </p>
              <span className="text-[0.56rem] font-bold text-slate-400">
                {gastosFiltrados.length} {gastosFiltrados.length === 1 ? 'registro' : 'registros'}
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
                {gastos.length > 0 && filtrosActivos
                  ? 'No hay registros con esos filtros'
                  : 'Aún no has registrado gastos'}
              </p>
              <p className="mx-auto mt-1 max-w-[230px] text-[0.64rem] font-semibold leading-5 text-slate-500">
                {gastos.length > 0 && filtrosActivos
                  ? 'Limpia los filtros para volver al historial completo.'
                  : 'Registra el primero para empezar a gestionarlos.'}
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
                      <p className="mt-1 text-[0.58rem] font-bold uppercase tracking-[0.08em] text-slate-400">
                        {titleCase(gasto.tipoGasto)}
                      </p>
                    </div>
                    <p className="shrink-0 text-[0.78rem] font-black text-[#102d92]">
                      {formatCurrency(gasto.montoGasto)}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-[0.6rem] font-semibold text-slate-500">
                    <span>{formatRelativeDate(gasto.fechaGasto)}</span>
                    <span
                      className={`rounded-full px-2 py-1 text-[0.52rem] font-black uppercase ${
                        gasto.estadoPago === 'PAGADO'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {titleCase(gasto.estadoPago)}
                    </span>
                  </div>
                </article>
              ))
            : null}
        </section>
      </main>
    </div>
  );
}
