import React from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeDollarSign,
  CalendarDays,
  Check,
  CheckCircle2,
  Forklift,
  HandCoins,
  Loader2,
  PackageSearch,
  ReceiptText,
  Truck,
  UtensilsCrossed,
  WalletCards,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppBottomNav } from '../components/AppBottomNav';
import { CloudStatusBadge } from '../components/CloudStatusBadge';
import { EmptyState } from '../components/EmptyState';
import { SystemSaveError } from '../components/SystemSaveError';
import {
  createGuidedErrorFromUi,
  InlineGuidedError,
} from '../components/forms/GuidedError';
import {
  registrarGastoLocal,
  type GastoAplicaA,
  type GastoEstadoPago,
  type GastoTipo,
} from '../services/gastosService';
import { obtenerLotes, type LoteResumen } from '../services/lotesService';
import {
  BUSINESS_MIN_DATE_VALUE,
  getTodayLocalDateValue,
  validateBusinessDateRange,
} from '../utils/date';
import { UI_MESSAGES } from '../utils/uiMessages';

type ModalState = 'none' | 'confirm' | 'error' | 'success';

type GastoForm = {
  concepto: string;
  descripcion: string;
  monto: string;
  fecha: string;
  tipo: GastoTipo;
  estadoPago: GastoEstadoPago;
  aplicaA: GastoAplicaA;
  lotesIds: string[];
};

const TIPOS_GASTO: Array<{
  id: GastoTipo;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: 'TRANSPORTE', label: 'Transporte', icon: <Truck size={16} /> },
  { id: 'COMIDA', label: 'Comida', icon: <UtensilsCrossed size={16} /> },
  { id: 'SECADO', label: 'Secado', icon: <WalletCards size={16} /> },
  { id: 'CARGUE', label: 'Cargue', icon: <Forklift size={16} /> },
  { id: 'DESCARGUE', label: 'Descargue', icon: <PackageSearch size={16} /> },
  { id: 'OTROS', label: 'Otros', icon: <BadgeDollarSign size={16} /> },
];

const FORM_INICIAL: GastoForm = {
  concepto: '',
  descripcion: '',
  monto: '',
  fecha: getTodayLocalDateValue(),
  tipo: 'TRANSPORTE',
  estadoPago: 'PAGADO',
  aplicaA: 'GENERAL',
  lotesIds: [],
};
const CONCEPTO_MAX_LENGTH = 60;
const DESCRIPCION_MAX_LENGTH = 200;
const MONTO_MAX_LENGTH = 11;

function generarId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatoMoneda(valor: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(valor);
}

function formatoMontoInput(valor: string) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0
    ? formatoMoneda(numero)
    : 'Ingresa el valor del gasto para ver el total.';
}

function resumenLote(lote: LoteResumen) {
  return `${lote.codigo} · ${lote.tipoCafe} ${lote.calidad} · ${lote.pesoActual.toLocaleString(
    'es-CO',
    {
      maximumFractionDigits: 2,
    },
  )} kg`;
}

export default function Gastos() {
  const navigate = useNavigate();
  const [form, setForm] = React.useState<GastoForm>(FORM_INICIAL);
  const [modal, setModal] = React.useState<ModalState>('none');
  const [error, setError] = React.useState<string | null>(null);
  const [saveErrorDetail, setSaveErrorDetail] = React.useState<unknown>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [lotes, setLotes] = React.useState<LoteResumen[]>([]);
  const [loadingLotes, setLoadingLotes] = React.useState(false);
  const [loadLotesError, setLoadLotesError] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => {
    const cargarLotes = async () => {
      setLoadingLotes(true);
      setLoadLotesError(null);
      try {
        const data = await obtenerLotes();
        setLotes(data.filter((lote) => lote.pesoActual > 0));
      } catch (err) {
        setLoadLotesError(
          err instanceof Error
            ? err.message
            : 'No pude cargar los lotes disponibles.',
        );
        setLotes([]);
      } finally {
        setLoadingLotes(false);
      }
    };

    void cargarLotes();
  }, []);

  const montoNumero = Number(form.monto);
  const lotesSeleccionados = lotes.filter((lote) =>
    form.lotesIds.includes(lote.id),
  );
  const fechaValidacion = React.useMemo(
    () => validateBusinessDateRange(form.fecha),
    [form.fecha],
  );

  const validar = React.useCallback(() => {
    if (!form.concepto.trim()) {
      return UI_MESSAGES.forms.incompleteData.mensaje;
    }

    if (!fechaValidacion.isValid) {
      return UI_MESSAGES.forms.invalidDate.mensaje;
    }

    if (!Number.isFinite(montoNumero) || montoNumero <= 0) {
      return UI_MESSAGES.forms.invalidValue.mensaje;
    }

    if (form.aplicaA === 'SUBLOTES' && form.lotesIds.length === 0) {
      return UI_MESSAGES.forms.incompleteData.mensaje;
    }

    return null;
  }, [fechaValidacion.isValid, form, montoNumero]);

  const abrirConfirmacion = () => {
    const mensaje = validar();
    if (mensaje) {
      setError(mensaje);
      return;
    }

    setError(null);
    setModal('confirm');
  };

  const guardarGasto = async () => {
    setSubmitting(true);
    setError(null);
    setSaveErrorDetail(null);

    try {
      await registrarGastoLocal({
        id: generarId(),
        concepto: form.concepto.trim(),
        descripcion: form.descripcion.trim(),
        monto: montoNumero,
        fecha: form.fecha,
        tipo: form.tipo,
        estadoPago: form.estadoPago,
        aplicaA: form.aplicaA,
        lotesIds: form.aplicaA === 'SUBLOTES' ? form.lotesIds : [],
      });

      setModal('success');
    } catch (err) {
      setSaveErrorDetail(err);
      setModal('error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleLote = (loteId: string) => {
    setForm((actual) => ({
      ...actual,
      lotesIds: actual.lotesIds.includes(loteId)
        ? actual.lotesIds.filter((id) => id !== loteId)
        : [...actual.lotesIds, loteId],
    }));
  };

  const cerrarExito = () => {
    setModal('none');
    setForm(FORM_INICIAL);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f2fb_100%)] px-4 py-5 pb-[150px] text-slate-900">
      <div className="mx-auto flex w-full max-w-[430px] flex-col gap-5">
        <header className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/ajustes')}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#102d92] shadow-sm"
            aria-label="Volver a ajustes"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-center text-[1.1rem] font-black text-[#121826]">
              Registro de Gastos
            </p>
          </div>
          <CloudStatusBadge compact className="max-w-[160px]" />
        </header>

        <section className="rounded-[24px] border border-[#e6e8f3] bg-white p-4 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-black text-slate-700">
                Concepto del gasto
              </label>
              <input
                type="text"
                value={form.concepto}
                onChange={(event) =>
                  setForm((actual) => ({
                    ...actual,
                    concepto: event.target.value.slice(0, CONCEPTO_MAX_LENGTH),
                  }))
                }
                maxLength={CONCEPTO_MAX_LENGTH}
                placeholder="Ej. Pago de jornaleros - Cosecha Oct"
                className="w-full rounded-[16px] border border-[#e1e5f0] bg-[#f7f8fd] px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#2558e5]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-black text-slate-700">
                Descripción breve
              </label>
              <textarea
                value={form.descripcion}
                onChange={(event) =>
                  setForm((actual) => ({
                    ...actual,
                    descripcion: event.target.value.slice(
                      0,
                      DESCRIPCION_MAX_LENGTH,
                    ),
                  }))
                }
                maxLength={DESCRIPCION_MAX_LENGTH}
                placeholder="Detalles adicionales..."
                rows={3}
                className="w-full rounded-[16px] border border-[#e1e5f0] bg-[#f7f8fd] px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#2558e5]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-sm font-black text-slate-700">
                  Monto ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.monto}
                  onChange={(event) =>
                    setForm((actual) => ({
                      ...actual,
                      monto: event.target.value.slice(0, MONTO_MAX_LENGTH),
                    }))
                  }
                  placeholder="$ 0.00"
                  className="w-full rounded-[16px] border border-[#e1e5f0] bg-[#f7f8fd] px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-[#2558e5]"
                />
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  {formatoMontoInput(form.monto)}
                </p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-black text-slate-700">
                  Fecha
                </label>
                <div className="flex items-center gap-3 rounded-[16px] border border-[#e1e5f0] bg-[#f7f8fd] px-4 py-3">
                  <input
                    type="date"
                    value={form.fecha}
                    min={BUSINESS_MIN_DATE_VALUE}
                    max={getTodayLocalDateValue()}
                    onChange={(event) =>
                      setForm((actual) => ({
                        ...actual,
                        fecha: event.target.value,
                      }))
                    }
                    className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none"
                  />
                  <CalendarDays size={16} className="text-slate-400" />
                </div>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-black text-slate-700">
                Tipo de gasto
              </label>
              <div className="grid grid-cols-3 gap-2">
                {TIPOS_GASTO.map((tipo) => {
                  const active = form.tipo === tipo.id;
                  return (
                    <button
                      key={tipo.id}
                      type="button"
                      onClick={() =>
                        setForm((actual) => ({ ...actual, tipo: tipo.id }))
                      }
                      className={`rounded-[16px] border px-2 py-3 text-[11px] font-black uppercase tracking-[0.04em] ${
                        active
                          ? 'border-[#2558e5] bg-[#eef3ff] text-[#2558e5]'
                          : 'border-[#e2e6f1] bg-white text-slate-500'
                      }`}
                    >
                      <span className="mb-1 flex justify-center">
                        {tipo.icon}
                      </span>
                      {tipo.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-black text-slate-700">
                Estado del pago
              </label>
              <div className="grid grid-cols-2 gap-2 rounded-[16px] bg-[#eef2f8] p-1">
                {(['PAGADO', 'PENDIENTE'] as GastoEstadoPago[]).map(
                  (estado) => {
                    const active = form.estadoPago === estado;
                    return (
                      <button
                        key={estado}
                        type="button"
                        onClick={() =>
                          setForm((actual) => ({
                            ...actual,
                            estadoPago: estado,
                          }))
                        }
                        className={`rounded-[12px] px-3 py-3 text-sm font-black ${
                          active
                            ? 'bg-white text-[#2558e5] shadow-sm'
                            : 'text-slate-500'
                        }`}
                      >
                        {estado === 'PAGADO' ? 'Pagado' : 'Pendiente'}
                      </button>
                    );
                  },
                )}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-black text-slate-700">
                ¿A qué aplica este gasto?
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    {
                      id: 'GENERAL',
                      label: 'Gasto general',
                      icon: <ReceiptText size={16} />,
                    },
                    {
                      id: 'SUBLOTES',
                      label: 'Asociar a sublotes',
                      icon: <HandCoins size={16} />,
                    },
                  ] as Array<{
                    id: GastoAplicaA;
                    label: string;
                    icon: React.ReactNode;
                  }>
                ).map((option) => {
                  const active = form.aplicaA === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        setForm((actual) => ({
                          ...actual,
                          aplicaA: option.id,
                          lotesIds:
                            option.id === 'GENERAL' ? [] : actual.lotesIds,
                        }))
                      }
                      className={`rounded-[16px] border px-3 py-4 text-sm font-black ${
                        active
                          ? 'border-[#2558e5] bg-[#eef3ff] text-[#2558e5]'
                          : 'border-[#e2e6f1] bg-white text-slate-500'
                      }`}
                    >
                      <span className="mb-1 flex justify-center">
                        {option.icon}
                      </span>
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {form.aplicaA === 'SUBLOTES' ? (
              <div>
                <label className="mb-2 block text-sm font-black text-slate-700">
                  Selecciona sublotes o lotes
                </label>
                <div className="rounded-[18px] border border-[#e2e6f1] bg-[#fbfcff] p-3">
                  {loadingLotes ? (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Loader2 size={16} className="animate-spin" />
                      Cargando lotes...
                    </div>
                  ) : loadLotesError ? (
                    <p className="text-sm text-rose-600">{loadLotesError}</p>
                  ) : lotes.length === 0 ? (
                    <EmptyState
                      icon={PackageSearch}
                      title="No hay lotes disponibles"
                      description="Registra una compra primero o guarda este gasto como general si no aplica a un lote específico."
                      className="border-[#e2e6f1] bg-white"
                    />
                  ) : (
                    <div className="space-y-2">
                      {lotes.map((lote) => {
                        const active = form.lotesIds.includes(lote.id);
                        return (
                          <button
                            key={lote.id}
                            type="button"
                            onClick={() => toggleLote(lote.id)}
                            className={`flex w-full items-start justify-between gap-3 rounded-[14px] border px-3 py-3 text-left ${
                              active
                                ? 'border-[#2558e5] bg-[#eef3ff]'
                                : 'border-[#e2e6f1] bg-white'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-black text-slate-900">
                                {lote.codigo}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {resumenLote(lote)}
                              </p>
                            </div>
                            <span
                              className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${
                                active
                                  ? 'bg-[#2558e5] text-white'
                                  : 'bg-slate-100 text-slate-400'
                              }`}
                            >
                              <Check size={14} />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {lotesSeleccionados.length > 0 ? (
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    Seleccionados: {lotesSeleccionados.length}
                  </p>
                ) : null}
              </div>
            ) : null}

            {error ? (
              <InlineGuidedError
                message={createGuidedErrorFromUi(
                  error === UI_MESSAGES.forms.invalidDate.mensaje
                    ? UI_MESSAGES.forms.invalidDate
                    : error === UI_MESSAGES.forms.invalidValue.mensaje
                      ? UI_MESSAGES.forms.invalidValue
                      : UI_MESSAGES.forms.incompleteData,
                )}
              />
            ) : null}

            <button
              type="button"
              onClick={abrirConfirmacion}
              className="inline-flex min-h-[52px] w-full items-center justify-center rounded-[16px] bg-[#2558e5] px-4 py-3 text-sm font-black text-white shadow-[0_18px_32px_rgba(37,88,229,0.25)]"
            >
              Guardar gasto
            </button>

            <button
              type="button"
              onClick={() => navigate('/ajustes')}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[16px] px-4 py-2 text-sm font-semibold text-slate-500"
            >
              Cancelar
            </button>
          </div>
        </section>
      </div>

      {modal !== 'none' ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-5 backdrop-blur-sm">
          <div className="w-full max-w-[360px] rounded-[28px] bg-white p-6 text-center shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
            {modal === 'confirm' ? (
              <>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#eef3ff] text-[#2558e5]">
                  <AlertTriangle size={22} />
                </div>
                <h2 className="mt-4 text-[1.3rem] font-black text-[#121826]">
                  ¿Registrar este gasto?
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Se guardará este gasto en el sistema.
                </p>
                <button
                  type="button"
                  onClick={() => void guardarGasto()}
                  disabled={submitting}
                  className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center rounded-[16px] bg-[#2558e5] px-4 py-3 text-sm font-black text-white"
                >
                  {submitting ? 'Registrando...' : 'Registrar gasto'}
                </button>
                <button
                  type="button"
                  onClick={() => setModal('none')}
                  className="mt-3 inline-flex min-h-[46px] w-full items-center justify-center rounded-[16px] border border-[#e3e7f3] px-4 py-3 text-sm font-semibold text-slate-500"
                >
                  Cancelar
                </button>
              </>
            ) : null}

            {modal === 'error' ? (
              <SystemSaveError
                operation="Registrar gasto"
                error={saveErrorDetail}
                onRetry={() => void guardarGasto()}
                onHome={() => navigate('/inicio', { replace: true })}
                retrying={submitting}
                className="border-0 p-0 shadow-none"
              />
            ) : null}

            {modal === 'success' ? (
              <>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] bg-emerald-50 text-emerald-600">
                  <CheckCircle2 size={22} />
                </div>
                <h2 className="mt-4 text-[1.3rem] font-black text-[#121826]">
                  {UI_MESSAGES.success.expenseCreated.titulo}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {UI_MESSAGES.success.expenseCreated.mensaje}
                </p>
                <button
                  type="button"
                  onClick={cerrarExito}
                  className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center rounded-[16px] bg-[#2558e5] px-4 py-3 text-sm font-black text-white"
                >
                  Registrar otro gasto
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/inicio')}
                  className="mt-3 inline-flex min-h-[46px] w-full items-center justify-center rounded-[16px] border border-[#e3e7f3] px-4 py-3 text-sm font-semibold text-slate-500"
                >
                  Ir a inicio
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <AppBottomNav hidden={modal !== 'none'} />
    </div>
  );
}
