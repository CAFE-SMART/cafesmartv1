import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Leaf,
  LoaderCircle,
  LogOut,
  RefreshCcw,
  Save,
  SunMedium,
  X,
} from 'lucide-react';
import { AppBottomNav } from '../components/AppBottomNav';
import { useCloudStatus } from '../context/CloudStatusContext';
import { useUser } from '../context/UserContext';
import {
  obtenerDashboardSummary,
  type DashboardSummary,
} from '../services/dashboardService';
import { obtenerLotes, type LoteResumen } from '../services/lotesService';
import {
  guardarConfiguracionBodega,
  obtenerConfiguracionBodega,
} from '../services/bodegaApi';
import { applySecadoToLots } from '../utils/secadoFlow';
import { getDaysInBodega } from '../utils/date';
import { ENABLE_SECADO_PROTOTYPE } from '../config/features';

const sectionTitleClass =
  'text-[0.74rem] font-black uppercase tracking-[0.16em] text-[#73829a]';
const cardClass =
  'rounded-[18px] border border-[#dbe2ee] bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)]';

function formatInteger(value: number) {
  return new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
  }).format(value);
}

function sanitizeCapacidadInput(value: string) {
  return value.replace(/\D/g, '').slice(0, 6);
}

function sanitizeNombreBodegaInput(value: string) {
  return value.replace(/[^\p{L}0-9\s&.'/-]/gu, '').slice(0, 50);
}

function formatKg(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)} kg`;
}

function formatKgUpper(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)} KG`;
}

function formatMoney(value: number) {
  return `$${new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function getCapacityTone(percentage: number) {
  if (percentage > 100) {
    return {
      label: 'Bodega llena',
      text: 'text-[#b42318]',
      bar: 'bg-[#d92d20]',
      note: 'Vende café para seguir comprando.',
    };
  }

  if (percentage >= 85) {
    return {
      label: 'Capacidad crítica',
      text: 'text-[#b42318]',
      bar: 'bg-[#d92d20]',
      note: 'La bodega está cerca del límite.',
    };
  }

  if (percentage >= 60) {
    return {
      label: 'Capacidad alta',
      text: 'text-[#b77900]',
      bar: 'bg-[#d29309]',
      note: 'La bodega está cerca de su capacidad máxima.',
    };
  }

  return {
    label: 'Capacidad normal',
    text: 'text-[#0d7b67]',
    bar: 'bg-[#0d7b67]',
    note: '',
  };
}

function resolveCloudLabel(tone: string) {
  if (tone === 'offline' || tone === 'error') {
    return 'SIN CONEXION';
  }

  if (tone === 'checking') {
    return 'VERIFICANDO';
  }

  if (tone === 'syncing') {
    return 'SINCRONIZANDO';
  }

  if (tone === 'degraded') {
    return 'CONEXION INESTABLE';
  }

  return 'CONECTADO';
}

function keyOf(value: string) {
  return value.trim().toUpperCase();
}

function resolveDashboardErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';

  if (/^Cannot\s+(GET|POST|PUT|PATCH|DELETE)\s+/i.test(message)) {
    return 'Inicio no disponible por el momento.';
  }

  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return 'Revisa la conexión a internet y vuelve a intentarlo.';
  }

  if (
    /terminal|backend|internal server error|server error|stack|exception|endpoint/i.test(
      message,
    )
  ) {
    return 'No pudimos cargar el inicio. Vuelve a intentarlo.';
  }

  return message || 'No pudimos cargar el inicio.';
}

function resolveCloudDotClass(tone: string) {
  if (tone === 'offline' || tone === 'error') {
    return 'bg-[#a0aec0]';
  }

  if (tone === 'checking') {
    return 'bg-[#c7d2e3]';
  }

  if (tone === 'syncing') {
    return 'bg-[#d6a64d]';
  }

  if (tone === 'degraded') {
    return 'bg-[#e38b47]';
  }

  return 'bg-[#3d8b5f]';
}

function formatMetric(
  loading: boolean,
  value: number | null,
  formatter: (value: number) => string,
) {
  if (loading) {
    return '...';
  }

  if (value === null) {
    return '-';
  }

  return formatter(value);
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-[0.76rem]">
      <span className="text-[#5a6b84]">{label}</span>
      <span className="font-black text-[#1f2937]">{value}</span>
    </div>
  );
}

function lotDays(lot: LoteResumen) {
  return Math.max(
    getDaysInBodega(lot.fechaPrimerIngreso || lot.fecha),
    getDaysInBodega(lot.fechaUltimoIngreso || lot.fecha),
    lot.diasEnBodegaMax || 0,
  );
}

type BodegaCoffeeItem = {
  key: 'VERDE_BUENO' | 'VERDE_REGULAR' | 'SECO_BUENO';
  tipo: 'Verde' | 'Seco';
  calidad: 'Bueno' | 'Regular';
  tipoCafeId: string;
  calidadId: string;
  totalKg: number;
  lots: number;
  averageDays: number;
  dayWeight: number;
};

function BodegaCoffeeRow({ item, onClick }: { item: BodegaCoffeeItem; onClick?: () => void }) {
  const isGood = item.calidad === 'Bueno';
  const isDry = item.tipo === 'Seco';
  const Icon = isDry ? SunMedium : Leaf;
  const iconClass = isDry
    ? isGood
      ? 'bg-[#fff7df] text-[#d29309]'
      : 'bg-[#fff1da] text-[#c4670e]'
    : isGood
      ? 'bg-[#e9fbf4] text-[#0d7b67]'
      : 'bg-[#fff7d6] text-[#b77905]';
  const qualityClass = isGood
    ? 'bg-[#dcfce7] text-[#16845a]'
    : 'bg-[#fff3c4] text-[#a15c00]';

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition active:bg-[#f0f4fa]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] ${iconClass}`}
        >
          <Icon size={15} strokeWidth={2.35} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[0.78rem] font-black leading-tight text-[#1f2937]">
            {item.tipo}
          </p>
          <p className="mt-1 flex items-center gap-1 text-[0.56rem] font-bold uppercase tracking-[0.03em] text-[#8a98ad]">
            <CalendarDays size={10} strokeWidth={2.2} />
            {item.averageDays} dias
          </p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="whitespace-nowrap text-[0.72rem] font-black text-[#18479d]">
          {formatKgUpper(item.totalKg)}
        </p>
        <span
          className={`mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[0.46rem] font-black uppercase ${qualityClass}`}
        >
          {item.calidad}
        </span>
      </div>
    </button>
  );
}

function EmptyDashboardState({
  onRegisterPurchase,
}: {
  onRegisterPurchase: () => void;
}) {
  return (
    <section className="px-5 pt-6">
      <div className="rounded-[28px] border border-[#e1e8f3] bg-white px-6 py-9 text-center shadow-[0_18px_44px_rgba(15,23,42,0.09)]">
        <img
          src="/imagenes-de-proyecto/granito-inteligente.png"
          alt=""
          className="mx-auto h-14 w-14 object-contain"
        />
        <h2 className="mt-5 text-[1.18rem] font-black text-[#101828]">
          Registra tu primera compra
        </h2>
        <p className="mx-auto mt-2 max-w-[270px] text-[0.84rem] font-semibold leading-6 text-[#52627a]">
          Para ver tu inventario y empezar a vender.
        </p>
        <button
          type="button"
          onClick={onRegisterPurchase}
          className="mt-6 inline-flex min-h-[48px] w-full items-center justify-center rounded-[16px] bg-[#173b9c] px-4 text-[0.84rem] font-black text-white shadow-[0_12px_24px_rgba(23,59,156,0.22)]"
        >
          Registrar compra
        </button>
      </div>
    </section>
  );
}

export default function Inicio() {
  const navigate = useNavigate();
  const { tone, refreshHealth } = useCloudStatus();
  const { logout } = useUser();
  const [cerrandoSesion, setCerrandoSesion] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [lotesBodega, setLotesBodega] = useState<LoteResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalBodegaAbierto, setModalBodegaAbierto] = useState(false);
  const [nombreBodegaForm, setNombreBodegaForm] = useState('Bodega principal');
  const [capacidadBodegaForm, setCapacidadBodegaForm] = useState('');
  const [guardandoBodega, setGuardandoBodega] = useState(false);
  const [errorBodega, setErrorBodega] = useState<string | null>(null);

  const cargarDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [dashboardResult, lotesResult] = await Promise.allSettled([
        obtenerDashboardSummary(),
        obtenerLotes(),
      ]);

      if (dashboardResult.status === 'fulfilled') {
        setSummary(dashboardResult.value);
        setError(null);
      } else {
        setError(resolveDashboardErrorMessage(dashboardResult.reason));
      }

      if (lotesResult.status === 'fulfilled') {
        setLotesBodega(
          ENABLE_SECADO_PROTOTYPE
            ? applySecadoToLots(lotesResult.value)
            : lotesResult.value,
        );
      } else {
        setLotesBodega([]);
      }

    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void cargarDashboard();
  }, [cargarDashboard]);

  const handleReload = useCallback(async () => {
    await Promise.allSettled([cargarDashboard(true), refreshHealth()]);
  }, [cargarDashboard, refreshHealth]);

  const abrirModalBodega = async () => {
    setErrorBodega(null);
    setNombreBodegaForm('Bodega principal');
    setCapacidadBodegaForm(
      summary?.kgCapacidad ? String(summary.kgCapacidad) : '',
    );
    setModalBodegaAbierto(true);

    try {
      const config = await obtenerConfiguracionBodega();
      setNombreBodegaForm(
        sanitizeNombreBodegaInput(config.nombreBodega || 'Bodega principal'),
      );
      setCapacidadBodegaForm(config.capacidadKg ? String(config.capacidadKg) : '');
    } catch {
      // El modal sigue usable con los datos del resumen.
    }
  };

  const guardarBodegaLocal = async () => {
    const capacidad = Number(capacidadBodegaForm);
    const inventarioActual = summary?.kgActual ?? 0;

    if (!nombreBodegaForm.trim()) {
      setErrorBodega('Escribe un nombre para la bodega.');
      return;
    }

    if (!Number.isFinite(capacidad) || capacidad <= 0) {
      setErrorBodega('Ingresa una capacidad válida.');
      return;
    }

    if (capacidad < inventarioActual) {
      setErrorBodega('La capacidad no puede ser menor al café almacenado.');
      return;
    }

    setGuardandoBodega(true);
    setErrorBodega(null);

    try {
      await guardarConfiguracionBodega({
        nombreBodega: sanitizeNombreBodegaInput(nombreBodegaForm).trim(),
        capacidadKg: capacidad,
      });
      setModalBodegaAbierto(false);
      await cargarDashboard(true);
    } catch {
      setErrorBodega('No se pudo guardar la capacidad de bodega.');
    } finally {
      setGuardandoBodega(false);
    }
  };

  const ocupacion = useMemo(() => {
    const kgActual = summary?.kgActual ?? null;
    const kgCapacidad = summary?.kgCapacidad ?? null;

    if (
      kgActual === null ||
      kgCapacidad === null ||
      !Number.isFinite(kgCapacidad) ||
      kgCapacidad <= 0
    ) {
      return {
        porcentaje: 0,
        etiqueta: loading ? '...' : '0%',
        excedida: false,
        tono: getCapacityTone(0),
      };
    }

    const porcentajeReal = Math.max(0, (kgActual / kgCapacidad) * 100);

    return {
      porcentaje: Math.min(100, porcentajeReal),
      etiqueta: `${Math.round(porcentajeReal)}%`,
      excedida: porcentajeReal > 100,
      tono: getCapacityTone(porcentajeReal),
    };
  }, [loading, summary?.kgActual, summary?.kgCapacidad]);

  const cafeEnBodega = useMemo(() => {
    const sections: BodegaCoffeeItem[] = [
      {
        key: 'VERDE_BUENO',
        tipo: 'Verde',
        calidad: 'Bueno',
        tipoCafeId: '',
        calidadId: '',
        totalKg: 0,
        lots: 0,
        averageDays: 0,
        dayWeight: 0,
      },
      {
        key: 'VERDE_REGULAR',
        tipo: 'Verde',
        calidad: 'Regular',
        tipoCafeId: '',
        calidadId: '',
        totalKg: 0,
        lots: 0,
        averageDays: 0,
        dayWeight: 0,
      },
      {
        key: 'SECO_BUENO',
        tipo: 'Seco',
        calidad: 'Bueno',
        tipoCafeId: '',
        calidadId: '',
        totalKg: 0,
        lots: 0,
        averageDays: 0,
        dayWeight: 0,
      },
    ];

    lotesBodega.forEach((lot) => {
      const typeKey = keyOf(lot.tipoCafe);
      const qualityKey = keyOf(lot.calidad);
      const section = sections.find(
        (item) => item.key === `${typeKey}_${qualityKey}`,
      );
      if (!section) return;

      if (!section.tipoCafeId) {
        section.tipoCafeId = lot.tipoCafeId;
        section.calidadId = lot.calidadId;
      }

      const weight = Math.max(1, lot.sublotes);
      section.totalKg += lot.pesoActual;
      section.lots += lot.sublotes;
      section.dayWeight += lotDays(lot) * weight;
    });

    return sections
      .map((section) => ({
        ...section,
        averageDays:
          section.totalKg > 0
            ? Math.round(section.dayWeight / Math.max(1, section.lots))
            : 0,
      }))
      .filter((section) => section.totalKg > 0)
      .sort((a, b) => {
        if (b.averageDays !== a.averageDays) {
          return b.averageDays - a.averageDays;
        }

        return b.totalKg - a.totalKg;
      });
  }, [lotesBodega]);

  const isEmptyDashboard =
    !loading &&
    !error &&
    summary !== null &&
    summary.comprasHoy === 0 &&
    summary.ventasHoy === 0 &&
    summary.gastosHoy === 0 &&
    summary.totalVentasHoy === 0 &&
    summary.totalGastosHoy === 0 &&
    summary.kgActual === 0 &&
    lotesBodega.length === 0;

  return (
    <div className="min-h-screen bg-[#f4f7fb] pb-32 text-slate-900">
      <div className="mx-auto w-full max-w-[430px]">
        <header className="px-5 pb-4 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[1.35rem] font-black text-[#111827]">
                Caf&eacute; Smart
              </h1>
              <div className="mt-1.5 inline-flex items-center gap-2 rounded-full bg-white px-2.5 py-1 text-[0.58rem] font-black uppercase tracking-[0.12em] text-[#72809a] shadow-sm">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${resolveCloudDotClass(tone)}`}
                  aria-hidden="true"
                />
                <span>{resolveCloudLabel(tone)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleReload()}
                disabled={refreshing}
                className="inline-flex h-11 items-center gap-2 rounded-[16px] border border-[#e1e7f0] bg-white px-4 text-[0.74rem] font-black text-[#4b5c77] shadow-[0_8px_22px_rgba(15,23,42,0.06)] transition hover:bg-[#f8fafc] disabled:cursor-wait disabled:opacity-80"
              >
                {refreshing ? (
                  <LoaderCircle
                    size={13}
                    className="animate-spin text-[#4b5c77]"
                  />
                ) : (
                  <RefreshCcw size={13} className="text-[#4b5c77]" />
                )}
                Recargar
              </button>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(true)}
                disabled={cerrandoSesion}
                className="inline-flex h-11 w-11 items-center justify-center rounded-[16px] border border-[#f0d4d4] bg-white text-[#b44a4a] shadow-[0_8px_22px_rgba(15,23,42,0.06)] transition hover:bg-[#fff5f5] disabled:cursor-not-allowed disabled:opacity-60"
                title="Cerrar sesión"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </header>

        {error ? (
          <section className="px-5 pb-3">
            <div className="rounded-[16px] border border-[#dbe2ee] bg-white px-4 py-3">
              <p className="text-[0.76rem] font-black text-[#1f2937]">
                No se pudo cargar el resumen
              </p>
              <p className="mt-1 text-[0.68rem] font-semibold leading-5 text-[#65758f]">
                Presiona Recargar para intentarlo de nuevo.
              </p>
            </div>
          </section>
        ) : null}

        {isEmptyDashboard ? (
          <EmptyDashboardState
            onRegisterPurchase={() => navigate('/compras')}
          />
        ) : (
          <>
            <section className="px-5 py-3">
              <p className={sectionTitleClass}>Resumen del d&iacute;a</p>

              <div className={`mt-3 ${cardClass}`}>
                <div className="space-y-2.5">
                  <MetricRow
                    label="Compras hoy:"
                    value={formatMetric(
                      loading,
                      summary?.comprasHoy ?? null,
                      formatInteger,
                    )}
                  />
                  <MetricRow
                    label="Ventas hoy:"
                    value={formatMetric(
                      loading,
                      summary?.ventasHoy ?? null,
                      formatInteger,
                    )}
                  />
                  <MetricRow
                    label="Kg comprados hoy:"
                    value={formatMetric(
                      loading,
                      summary?.kgCompradosHoy ?? null,
                      formatKg,
                    )}
                  />
                  <MetricRow
                    label="Productores registrados:"
                    value={formatMetric(
                      loading,
                      summary?.totalProductores ?? null,
                      formatInteger,
                    )}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/gastos/registro')}
                  className="mt-3 flex min-h-[30px] w-full items-center justify-center rounded-[10px] border border-[#e4e9f4] bg-[#f8faff] text-[0.66rem] font-black text-[#173b9c]"
                >
                  Registrar gasto
                </button>
              </div>
            </section>

            <section className="px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className={sectionTitleClass}>Capacidad en bodega</p>
                <button
                  type="button"
                  onClick={() => void abrirModalBodega()}
                  className="text-[0.64rem] font-black uppercase tracking-[0.08em] text-slate-400 transition hover:text-[#18479d]"
                >
                  Ajustar bodega
                </button>
              </div>

              <div className={`mt-3 ${cardClass}`}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-[0.9rem] font-black text-[#1f2937]">
                      Ocupaci&oacute;n actual
                    </h2>
                    {ocupacion.tono.note ? (
                      <p className={`mt-0.5 text-[0.68rem] font-semibold ${ocupacion.tono.text}`}>
                        {ocupacion.tono.note}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`shrink-0 text-[1rem] font-black ${ocupacion.tono.text}`}
                  >
                    {ocupacion.etiqueta}
                  </span>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#eef2f8]">
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ${ocupacion.tono.bar}`}
                    style={{ width: `${ocupacion.porcentaje}%` }}
                  />
                </div>

                <div className="mt-2 grid grid-cols-2 gap-3 text-[0.58rem] font-black text-[#74839a]">
                  <span className="min-w-0">
                    <span className="block text-[0.52rem] uppercase tracking-[0.08em]">
                      Usados
                    </span>
                    <span className="block truncate text-[0.66rem] text-[#4b5c77]">
                      {formatMetric(loading, summary?.kgActual ?? null, formatKg)}
                    </span>
                  </span>
                  <span className="min-w-0 text-right">
                    <span className="block text-[0.52rem] uppercase tracking-[0.08em]">
                      Total
                    </span>
                    <span className="block truncate text-[0.66rem] text-[#4b5c77]">
                      {formatMetric(
                        loading,
                        summary?.kgCapacidad ?? null,
                        formatKg,
                      )}
                    </span>
                  </span>
                </div>
              </div>
            </section>

            <section className="px-5 py-3">
              <p className={sectionTitleClass}>Inventario en bodega</p>

              <div className={`mt-3 overflow-hidden ${cardClass} p-0`}>
                {loading && !summary ? (
                  <div className="px-5 py-6 text-sm font-medium text-[#7f8ca1]">
                    Cargando bodega...
                  </div>
                ) : cafeEnBodega.length === 0 ? (
                  <div className="px-5 py-6 text-sm font-medium text-[#7f8ca1]">
                    Aún no hay café disponible en bodega.
                  </div>
                ) : (
                  <div
                    className={
                      cafeEnBodega.length > 4
                        ? 'max-h-[216px] overflow-y-scroll pr-[6px] [scrollbar-color:#c5ccda_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-[6px] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-[8px] [&::-webkit-scrollbar-thumb]:bg-[#c5ccda]'
                        : ''
                    }
                  >
                    {cafeEnBodega.map((item, index) => (
                      <div
                        key={item.key}
                        className={index > 0 ? 'border-t border-[#edf1f7]' : ''}
                      >
                        <BodegaCoffeeRow
                          item={item}
                          onClick={() => {
                            if (item.tipoCafeId && item.calidadId) {
                              navigate(
                                `/inventario/${item.tipoCafeId}/${item.calidadId}/sublotes`,
                                { state: { from: 'inicio' } },
                              );
                            }
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

          </>
        )}
      </div>

      <AppBottomNav />

      {modalBodegaAbierto ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/45 px-5 py-6 backdrop-blur-sm">
          <div className="w-full max-w-[390px] rounded-[22px] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.22)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[1.1rem] font-black text-slate-900">
                Capacidad de bodega
              </h2>
              <button
                type="button"
                onClick={() => setModalBodegaAbierto(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1.5 block text-[0.76rem] font-black text-slate-600">
                  Nombre
                </label>
                <input
                  type="text"
                  maxLength={50}
                  value={nombreBodegaForm}
                  onChange={(event) => {
                    setNombreBodegaForm(
                      sanitizeNombreBodegaInput(event.target.value),
                    );
                    setErrorBodega(null);
                  }}
                  className="w-full rounded-[14px] border border-[#dde4f1] bg-[#f7f9fd] px-4 py-3 text-[0.92rem] font-semibold text-slate-900 outline-none focus:border-[#102d92]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[0.76rem] font-black text-slate-600">
                  Capacidad max. (kg)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={capacidadBodegaForm}
                  onChange={(event) => {
                    setCapacidadBodegaForm(
                      sanitizeCapacidadInput(event.target.value),
                    );
                    setErrorBodega(null);
                  }}
                  className="w-full rounded-[14px] border border-[#dde4f1] bg-[#f7f9fd] px-4 py-3 text-[0.92rem] font-semibold text-slate-900 outline-none focus:border-[#102d92]"
                  placeholder="600000"
                />
                <p className="mt-1 text-[0.66rem] font-semibold text-slate-400">
                  Máx. 999.999 kg · En bodega: {formatInteger(summary?.kgActual ?? 0)} kg
                </p>
              </div>

              {errorBodega ? (
                <p className="rounded-[12px] border border-rose-200 bg-rose-50 px-3 py-2 text-[0.76rem] font-semibold text-rose-600">
                  {errorBodega}
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => void guardarBodegaLocal()}
                disabled={guardandoBodega}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#102d92] px-4 text-[0.9rem] font-black text-white disabled:opacity-60"
              >
                <Save size={15} />
                {guardandoBodega ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0f172a]/40 px-5 py-6 backdrop-blur-sm">
          <div className="w-full max-w-[320px] rounded-[24px] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.15)] animate-in zoom-in-95 duration-200">
            <h3 className="text-[1.25rem] font-black text-slate-900 text-center">
              ¿Cerrar sesión?
            </h3>
            <p className="mt-2 text-center text-[0.9rem] font-medium text-slate-500">
              ¿Estás seguro de que deseas salir del sistema?
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={async () => {
                  setCerrandoSesion(true);
                  try {
                    await logout();
                    navigate('/login', { replace: true });
                  } finally {
                    setCerrandoSesion(false);
                  }
                }}
                disabled={cerrandoSesion}
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[14px] bg-[#b44a4a] text-[0.95rem] font-bold text-white transition hover:bg-[#9b3f3f] disabled:opacity-70"
              >
                {cerrandoSesion ? 'Saliendo...' : 'Sí, salir'}
              </button>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                disabled={cerrandoSesion}
                className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[14px] bg-[#f4f7fb] text-[0.95rem] font-bold text-slate-600 transition hover:bg-[#e2e8f0]"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
