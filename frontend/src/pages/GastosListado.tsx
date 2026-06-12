import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CalendarDays, Edit2, Plus, Receipt, Trash2, X } from 'lucide-react';
import { RefreshButton } from '../components/RefreshButton';
import { SmartSelect } from '../components/SmartSelect';
import {
  actualizarGasto,
  actualizarEstadoGasto,
  eliminarGasto,
  listarGastos,
  type GastoEstadoPago,
  type GastoItem,
  type GastoTipo,
} from '../services/gastosService';
import {
  BUSINESS_MIN_DATE_VALUE,
  getTodayLocalDateValue,
} from '../utils/date';
import {
  dangerButtonClass,
  fieldInputClass,
  fieldLabelClass,
  fieldTextareaClass,
  primaryButtonClass,
  secondaryButtonClass,
  selectTriggerClass,
} from '../styles/uiClasses';

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

const TIPOS_GASTO: GastoTipo[] = [
  'TRANSPORTE',
  'COMIDA',
  'SECADO',
  'CARGUE',
  'DESCARGUE',
  'OTROS',
];
const GASTO_MONTO_MAX = 20000000;

type GastoEditForm = {
  conceptoGasto: string;
  descripcion: string;
  montoGasto: string;
  fechaGasto: string;
  tipoGasto: GastoTipo;
  estadoPago: GastoEstadoPago;
};

function sanitizeMoneyInput(value: string) {
  return value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 10);
}

function toEditForm(gasto: GastoItem): GastoEditForm {
  return {
    conceptoGasto: gasto.conceptoGasto,
    descripcion: gasto.descripcion ?? '',
    montoGasto: String(Math.round(gasto.montoGasto)),
    fechaGasto: gasto.fechaGasto.slice(0, 10),
    tipoGasto: gasto.tipoGasto as GastoTipo,
    estadoPago: gasto.estadoPago as GastoEstadoPago,
  };
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
  const todayValue = getTodayLocalDateValue();
  const todaySelectable = todayValue >= min && todayValue <= max ? todayValue : max;
  const maxDate = parseLocalDateValue(max) ?? new Date();
  const minDate = parseLocalDateValue(min) ?? new Date(2026, 0, 1);
  const visibleDate = selectedDate ?? parseLocalDateValue(todaySelectable) ?? maxDate;
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(visibleDate.getFullYear(), visibleDate.getMonth(), 1),
  );

  useEffect(() => {
    if (open) {
      const nextDate = parseLocalDateValue(value) ?? parseLocalDateValue(todaySelectable) ?? maxDate;
      setVisibleMonth(new Date(nextDate.getFullYear(), nextDate.getMonth(), 1));
    }
  }, [max, open, todaySelectable, value]);

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
        className={`${selectTriggerClass} min-h-[44px] rounded-[12px] text-[0.72rem] ${
          open ? 'border-[#102d92] dark:border-blue-400' : ''
        }`}
      >
        <span>{value ? formatLongDateLabel(value) : 'Fechas'}</span>
        <CalendarDays size={15} className="text-[#102d92] dark:text-blue-200" />
      </button>

      {open ? (
        <div className="fixed left-1/2 top-1/2 z-[120] w-[min(20rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[18px] border border-[#d5deee] bg-white p-2 shadow-[0_24px_54px_rgba(15,23,42,0.24)] dark:border-slate-600 dark:bg-slate-900 dark:shadow-[0_24px_54px_rgba(0,0,0,0.46)] sm:absolute sm:left-1/2 sm:top-auto sm:mt-2 sm:translate-y-0">
          <div className="flex items-center justify-between gap-2 px-1 pb-2">
            <button
              type="button"
              disabled={!canGoPrevious}
              onClick={() => setVisibleMonth(previousMonth)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#102d92] hover:bg-[#eef4ff] disabled:text-slate-300 dark:text-blue-200 dark:hover:bg-slate-800 dark:disabled:text-slate-600"
              aria-label="Mes anterior"
            >
              <ArrowLeft size={17} />
            </button>
            <p className="rounded-full bg-[#f8faff] px-4 py-2 text-sm font-black text-slate-900 dark:bg-slate-800 dark:text-slate-100">
              {MONTHS_ES[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
            </p>
            <button
              type="button"
              disabled={!canGoNext}
              onClick={() => setVisibleMonth(nextMonth)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#102d92] hover:bg-[#eef4ff] disabled:text-slate-300 dark:text-blue-200 dark:hover:bg-slate-800 dark:disabled:text-slate-600"
              aria-label="Mes siguiente"
            >
              <ArrowRight size={17} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 px-1">
            {WEEKDAYS_ES.map((day) => (
              <span key={day} className="py-1.5 text-center text-[0.7rem] font-black text-slate-500 dark:text-slate-300">
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
                      : day.value === todaySelectable
                        ? 'bg-[#eef4ff] text-[#102d92] dark:bg-blue-500/20 dark:text-blue-100'
                        : 'text-slate-800 hover:bg-[#f4f7ff] dark:text-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {day.day}
                </button>
              ) : (
                <span key={`empty-${index}`} />
              ),
            )}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-[#edf1f7] px-1 pt-2 dark:border-slate-700">
            <button
              type="button"
              onClick={() => {
                onChange('');
                onClose();
              }}
              className="rounded-full px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(todaySelectable);
                onClose();
              }}
              className="rounded-full bg-[#eef4ff] px-3 py-2 text-xs font-black text-[#102d92] dark:bg-blue-500/20 dark:text-blue-100"
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
  const [estadoFiltro, setEstadoFiltro] = useState<GastoEstadoPago | 'TODOS'>('PENDIENTE');
  const [actualizandoId, setActualizandoId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editandoGasto, setEditandoGasto] = useState<GastoItem | null>(null);
  const [editForm, setEditForm] = useState<GastoEditForm | null>(null);
  const [editFechaPickerOpen, setEditFechaPickerOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [gastoAEliminar, setGastoAEliminar] = useState<GastoItem | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
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
          orden: 'recent',
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
    [subloteId],
  );

  useEffect(() => {
    void cargar();
    return () => requestRef.current?.abort();
  }, [cargar]);

  const gastosFiltrados = useMemo(() => {
    return [...gastos]
      .filter((gasto) => estadoFiltro === 'TODOS' || gasto.estadoPago === estadoFiltro)
      .sort((a, b) => {
        return new Date(b.fechaGasto).getTime() - new Date(a.fechaGasto).getTime();
      });
  }, [estadoFiltro, gastos]);

  const totalAcumulado = useMemo(
    () => gastosFiltrados.reduce((sum, gasto) => sum + gasto.montoGasto, 0),
    [gastosFiltrados],
  );
  const gastosPendientes = useMemo(
    () =>
      [...gastos]
        .filter((gasto) => gasto.estadoPago === 'PENDIENTE')
        .sort(
          (a, b) =>
            new Date(b.fechaGasto).getTime() - new Date(a.fechaGasto).getTime(),
        ),
    [gastos],
  );
  const totalPrincipal = estadoFiltro === 'PENDIENTE'
    ? gastosPendientes.reduce((sum, gasto) => sum + gasto.montoGasto, 0)
    : totalAcumulado;

  const estadoResumen =
    estadoFiltro === 'PENDIENTE'
      ? 'pendientes'
      : estadoFiltro === 'PAGADO'
        ? 'pagados'
        : 'registrados';

  const marcarPagado = async (id: string) => {
    if (actualizandoId) return;

    setActualizandoId(id);
    setError(null);
    try {
      const actualizado = await actualizarEstadoGasto(id, 'PAGADO');
      setGastos((current) =>
        current.map((gasto) => (gasto.id === id ? actualizado : gasto)),
      );
    } catch {
      setError('No pudimos actualizar el estado del gasto. Intenta nuevamente.');
    } finally {
      setActualizandoId(null);
    }
  };

  const abrirEditar = (gasto: GastoItem) => {
    setEditandoGasto(gasto);
    setEditForm(toEditForm(gasto));
    setEditError(null);
    setEditFechaPickerOpen(false);
  };

  const validarEdicion = () => {
    if (!editForm) return 'Corrige los campos marcados para guardar.';
    const concepto = editForm.conceptoGasto.trim();
    const monto = Number(editForm.montoGasto);

    if (!concepto || concepto.length < 4) {
      return 'El concepto debe tener al menos 4 caracteres.';
    }
    if (!editForm.fechaGasto) {
      return 'Selecciona la fecha del gasto.';
    }
    if (!Number.isFinite(monto) || monto <= 0) {
      return 'El monto debe ser mayor a $0.';
    }
    if (monto > GASTO_MONTO_MAX) {
      return 'El monto máximo permitido es $20.000.000.';
    }
    return null;
  };

  const guardarEdicion = async () => {
    if (!editandoGasto || !editForm || guardandoEdicion) return;
    const mensaje = validarEdicion();
    if (mensaje) {
      setEditError(mensaje);
      return;
    }

    setGuardandoEdicion(true);
    setEditError(null);
    setError(null);
    try {
      const actualizado = await actualizarGasto(editandoGasto.id, {
        conceptoGasto: editForm.conceptoGasto.trim(),
        descripcion: editForm.descripcion.trim(),
        montoGasto: Number(editForm.montoGasto),
        fechaGasto: new Date(`${editForm.fechaGasto}T12:00:00`).toISOString(),
        tipoGasto: editForm.tipoGasto,
        estadoPago: editForm.estadoPago,
      });
      setGastos((current) =>
        current.map((gasto) => (gasto.id === actualizado.id ? actualizado : gasto)),
      );
      setEditandoGasto(null);
      setEditForm(null);
      setSuccess('Gasto actualizado correctamente.');
    } catch {
      setEditError('No pudimos actualizar el gasto. Intenta nuevamente.');
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const confirmarEliminar = async () => {
    if (!gastoAEliminar || eliminandoId) return;
    setEliminandoId(gastoAEliminar.id);
    setError(null);
    try {
      await eliminarGasto(gastoAEliminar.id);
      setGastos((current) =>
        current.filter((gasto) => gasto.id !== gastoAEliminar.id),
      );
      setGastoAEliminar(null);
      setSuccess('Gasto eliminado correctamente.');
    } catch {
      setError('No pudimos eliminar el gasto. Intenta nuevamente.');
    } finally {
      setEliminandoId(null);
    }
  };

  return (
    <div className="cs-workflow-page min-h-screen bg-[#eef2f6] px-4 py-3 pb-24 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <main className="mx-auto w-full max-w-[430px] rounded-[24px] border border-[#dbe2ee] bg-white px-3 py-3 shadow-[0_14px_38px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900">
        <header className="grid min-h-10 grid-cols-[36px_1fr_auto] items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#102d92] hover:bg-[#eef4ff] dark:bg-slate-800 dark:text-blue-100 dark:hover:bg-slate-700"
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

        <section className="mt-3 rounded-[12px] border border-[#dbe2ee] bg-[#f8fafc] px-3 py-3 dark:border-slate-700 dark:bg-slate-950">
          <p className="text-[0.56rem] font-black uppercase tracking-[0.12em] text-[#73829a] dark:text-slate-300">
            Total pendiente
          </p>
          <p className="mt-1 text-[1.25rem] font-black text-[#102d92] dark:text-blue-100">
            {loading ? '...' : formatCurrency(totalPrincipal)}
          </p>
          <p className="mt-1 text-[0.58rem] font-semibold leading-4 text-slate-500 dark:text-slate-300">
            {estadoFiltro === 'PENDIENTE'
              ? 'Suma de gastos pendientes por pagar.'
              : `Suma de gastos ${estadoResumen}.`}
          </p>
        </section>

        <button
          type="button"
          onClick={() => navigate('/gastos/registro')}
          className={`${primaryButtonClass} mt-3 min-h-[40px] w-full rounded-[10px] text-[0.72rem]`}
        >
          <Plus size={14} />
          Registrar gasto
        </button>

        <div className="mt-3 grid grid-cols-3 rounded-[12px] border border-[#dbe2ee] bg-[#eef2f8] p-1 dark:border-slate-700 dark:bg-slate-800">
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
                onClick={() => setEstadoFiltro(value as GastoEstadoPago | 'TODOS')}
                className={`min-h-[34px] rounded-[10px] px-2 text-[0.68rem] font-black transition ${
                  active
                    ? 'bg-[#102d92] text-white shadow-sm dark:bg-blue-600'
                    : 'text-slate-500 hover:bg-white/70 hover:text-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white'
                }`}
                aria-pressed={active}
              >
                {label}
              </button>
            );
          })}
        </div>

        {error ? (
          <section className="mt-3 rounded-[8px] border border-rose-200 bg-rose-50 px-3 py-3 text-[0.68rem] font-semibold text-rose-700">
            {error}
          </section>
        ) : null}
        {success ? (
          <section className="mt-3 rounded-[8px] border border-emerald-200 bg-emerald-50 px-3 py-3 text-[0.68rem] font-semibold text-emerald-700">
            {success}
          </section>
        ) : null}

        <section className="mt-3 space-y-2">
          {!loading && gastos.length > 0 ? (
            <div className="flex items-center justify-between px-1">
              <p className="text-[0.56rem] font-black uppercase tracking-[0.12em] text-[#73829a]">
                Gastos {estadoResumen}
              </p>
              <span className="text-[0.56rem] font-bold text-slate-400 dark:text-slate-300">
                {gastosFiltrados.length} {gastosFiltrados.length === 1 ? 'registro' : 'registros'}
              </span>
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-[12px] border border-[#eeeeee] bg-white px-3 py-5 text-center text-[0.72rem] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              Cargando gastos...
            </div>
          ) : null}

          {!loading && gastosFiltrados.length === 0 && !error ? (
            <div className="rounded-[14px] border border-[#dbe2ee] bg-white px-4 py-6 text-center shadow-[0_10px_24px_rgba(15,23,42,0.05)] dark:border-slate-700 dark:bg-slate-900">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#eef4ff] text-[#2051e5] dark:bg-blue-500/20 dark:text-blue-100">
                <Receipt size={18} />
              </div>
              <p className="mt-3 text-[0.76rem] font-black text-slate-900 dark:text-slate-100">
                {estadoFiltro === 'PENDIENTE'
                  ? 'No tienes gastos pendientes.'
                  : 'No hay gastos para los filtros seleccionados.'}
              </p>
              <p className="mx-auto mt-1 max-w-[230px] text-[0.64rem] font-semibold leading-5 text-slate-500 dark:text-slate-300">
                Registra un gasto nuevo para empezar a gestionarlo.
              </p>
            </div>
          ) : null}

          {!loading
            ? gastosFiltrados.map((gasto) => (
                <article
                  key={gasto.id}
                  className="rounded-[12px] border border-[#eeeeee] bg-white px-3 py-3 shadow-[0_3px_10px_rgba(15,23,42,0.035)] dark:border-slate-700 dark:bg-slate-950"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[0.76rem] font-black text-[#202020] dark:text-slate-100">
                        {gasto.conceptoGasto}
                      </p>
                      <p className="mt-1 text-[0.58rem] font-bold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-300">
                        {titleCase(gasto.tipoGasto)}
                      </p>
                    </div>
                    <p className="shrink-0 text-[0.78rem] font-black text-[#102d92] dark:text-blue-100">
                      {formatCurrency(gasto.montoGasto)}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-[0.6rem] font-semibold text-slate-500 dark:text-slate-300">
                    <span>{formatRelativeDate(gasto.fechaGasto)}</span>
                    <span
                      className={`rounded-full px-2 py-1 text-[0.52rem] font-black uppercase ${
                        gasto.estadoPago === 'PAGADO'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200'
                      }`}
                    >
                      {titleCase(gasto.estadoPago)}
                    </span>
                  </div>
                  <div
                    className={`mt-3 grid gap-2 ${
                      gasto.estadoPago === 'PENDIENTE'
                        ? 'grid-cols-[1fr_auto_auto]'
                        : 'grid-cols-2'
                    }`}
                  >
                    {gasto.estadoPago === 'PENDIENTE' ? (
                      <button
                        type="button"
                        onClick={() => void marcarPagado(gasto.id)}
                        disabled={actualizandoId === gasto.id}
                        className="inline-flex min-h-[34px] items-center justify-center rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 text-[0.62rem] font-black text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-70 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-100 dark:hover:bg-emerald-500/25"
                      >
                        {actualizandoId === gasto.id ? 'Actualizando...' : 'Marcar como pagado'}
                      </button>
                    ) : null}
                      <button
                        type="button"
                        onClick={() => abrirEditar(gasto)}
                        className="inline-flex min-h-[34px] items-center justify-center gap-1 rounded-[10px] border border-[#d5deee] bg-white px-3 text-[0.62rem] font-black text-[#334b85] dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                        aria-label="Editar gasto"
                      >
                        <Edit2 size={14} />
                        <span className={gasto.estadoPago === 'PENDIENTE' ? 'sr-only' : ''}>Editar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setGastoAEliminar(gasto)}
                        className="inline-flex min-h-[34px] items-center justify-center gap-1 rounded-[10px] border border-rose-200 bg-rose-50 px-3 text-[0.62rem] font-black text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-100"
                        aria-label="Eliminar gasto"
                      >
                        <Trash2 size={14} />
                        <span className={gasto.estadoPago === 'PENDIENTE' ? 'sr-only' : ''}>Eliminar</span>
                      </button>
                  </div>
                </article>
              ))
            : null}
        </section>
      </main>

      {editandoGasto && editForm ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/55 px-3 pb-3 pt-3 backdrop-blur-sm sm:items-center">
          <section className="max-h-[calc(100dvh-1.5rem)] w-full max-w-[430px] overflow-y-auto rounded-[18px] bg-white p-4 shadow-[0_24px_60px_rgba(15,23,42,0.22)] dark:border dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950 dark:text-slate-100">Editar gasto</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-300">
                  Actualiza los datos sin crear un registro nuevo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditandoGasto(null);
                  setEditForm(null);
                  setEditFechaPickerOpen(false);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-200"
                aria-label="Cerrar edición"
              >
                <X size={17} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className={fieldLabelClass}>
                  Concepto del gasto
                </span>
                <input
                  value={editForm.conceptoGasto}
                  maxLength={60}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current ? { ...current, conceptoGasto: event.target.value } : current,
                    )
                  }
                  className={fieldInputClass}
                />
              </label>
              <label className="block">
                <span className={fieldLabelClass}>
                  Observación
                </span>
                <textarea
                  value={editForm.descripcion}
                  maxLength={200}
                  rows={2}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current ? { ...current, descripcion: event.target.value } : current,
                    )
                  }
                  className={`${fieldTextareaClass} max-h-36 min-h-[96px] resize-y overflow-y-auto`}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className={fieldLabelClass}>
                    Monto
                  </span>
                  <input
                    value={editForm.montoGasto}
                    inputMode="numeric"
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? { ...current, montoGasto: sanitizeMoneyInput(event.target.value) }
                          : current,
                      )
                    }
                    className={fieldInputClass}
                  />
                </label>
                <div className="block">
                  <span className={fieldLabelClass}>
                    Fecha
                  </span>
                  <GastosDatePicker
                    value={editForm.fechaGasto}
                    open={editFechaPickerOpen}
                    onToggle={() => setEditFechaPickerOpen((open) => !open)}
                    onClose={() => setEditFechaPickerOpen(false)}
                    onChange={(value) =>
                      setEditForm((current) =>
                        current ? { ...current, fechaGasto: value } : current,
                      )
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className={fieldLabelClass}>
                    Tipo
                  </span>
                  <SmartSelect
                    value={editForm.tipoGasto}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? { ...current, tipoGasto: event.target.value as GastoTipo }
                          : current,
                      )
                    }
                    className="min-h-[44px] rounded-[12px] text-[0.72rem]"
                    aria-label="Tipo de gasto"
                  >
                    {TIPOS_GASTO.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {titleCase(tipo)}
                      </option>
                    ))}
                  </SmartSelect>
                </label>
                <label className="block">
                  <span className={fieldLabelClass}>
                    Estado
                  </span>
                  <SmartSelect
                    value={editForm.estadoPago}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? { ...current, estadoPago: event.target.value as GastoEstadoPago }
                          : current,
                      )
                    }
                    className="min-h-[44px] rounded-[12px] text-[0.72rem]"
                    aria-label="Estado del gasto"
                  >
                    <option value="PENDIENTE">Pendiente</option>
                    <option value="PAGADO">Pagado</option>
                  </SmartSelect>
                </label>
              </div>
              {editError ? (
                <p className="rounded-[12px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  {editError}
                </p>
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void guardarEdicion()}
                disabled={guardandoEdicion}
                className={`${primaryButtonClass} rounded-[12px]`}
              >
                {guardandoEdicion ? 'Guardando...' : 'Guardar cambios'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditandoGasto(null);
                  setEditForm(null);
                  setEditFechaPickerOpen(false);
                }}
                disabled={guardandoEdicion}
                className={`${secondaryButtonClass} rounded-[12px]`}
              >
                Cancelar
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {gastoAEliminar ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 px-4 backdrop-blur-sm">
          <section className="w-full max-w-[360px] rounded-[18px] bg-white p-5 text-center shadow-[0_24px_60px_rgba(15,23,42,0.22)] dark:border dark:border-slate-700 dark:bg-slate-900">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-700">
              <Trash2 size={20} />
            </div>
            <h2 className="mt-4 text-lg font-black text-slate-950 dark:text-slate-100">
              ¿Eliminar este gasto?
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500 dark:text-slate-300">
              Esta acción quitará el gasto del registro. No podrás recuperarlo después.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGastoAEliminar(null)}
                disabled={Boolean(eliminandoId)}
                className={`${secondaryButtonClass} rounded-[12px]`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmarEliminar()}
                disabled={Boolean(eliminandoId)}
                className={`${dangerButtonClass} rounded-[12px]`}
              >
                {eliminandoId ? 'Eliminando...' : 'Eliminar gasto'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
