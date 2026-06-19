import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Preferences } from '@capacitor/preferences';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  PackageCheck,
  Scale,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  SunMedium,
  Warehouse,
  X,
} from 'lucide-react';
import { AppBottomNav } from '../components/AppBottomNav';
import { AppFeedbackMessage } from '../components/AppFeedbackMessage';
import { CafeSmartProcessingScreen } from '../components/CafeSmartProcessingScreen';
import { RefreshButton } from '../components/RefreshButton';
import { useCloudStatus } from '../context/CloudStatusContext';
import { useUser } from '../context/UserContext';
import {
  obtenerDashboardInicio,
  obtenerDashboardSummary,
  type DashboardInicioBodegaItem,
  type DashboardSummary,
} from '../services/dashboardService';
import { guardarConfiguracionBodega } from '../services/bodegaApi';
import { obtenerLotes, type LoteResumen } from '../services/lotesService';
import { getOfflineCache, saveOfflineCache } from '../services/offlineCacheService';
import { prepareOfflineData } from '../services/offlinePreparationService';
import { applySecadoToLots } from '../utils/secadoFlow';
import { getDaysInBodega } from '../utils/date';
import { ENABLE_SECADO_PROTOTYPE } from '../config/features';
import {
  BODEGA_CAPACITY_MAX_KG,
  BODEGA_NAME_MAX_LENGTH,
  sanitizeLimitedText,
  sanitizePositiveIntegerInput,
} from '../utils/inputLimits';

const sectionTitleClass =
  'text-[0.74rem] font-black uppercase tracking-[0.16em] text-[#73829a] dark:text-slate-300';
const cardClass =
  'cs-card rounded-[18px] border border-[#dbe2ee] bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)] dark:border-slate-600 dark:bg-slate-900';
const DASHBOARD_HOME_CACHE_KEY = 'cached_dashboard_home';
const LIMITS_ONBOARDING_KEY_PREFIX = 'cafesmart:limits-onboarding:v1';

type CachedDashboardHome = {
  summary: DashboardSummary;
  lotesBodega: LoteResumen[];
  inventarioBodega?: DashboardInicioBodegaItem[];
  savedAt: string;
};

function formatInteger(value: number) {
  return new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatKg(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)} kg`;
}

function formatPercentage(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

function formatKgUpper(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)} KG`;
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

  return 'No pudimos cargar el inicio. Vuelve a intentarlo.';
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

function formatUpdatedAgo(updatedAt: string | null, now: number) {
  if (!updatedAt) {
    return 'Sin actualizar';
  }

  const timestamp = new Date(updatedAt).getTime();
  if (!Number.isFinite(timestamp)) {
    return 'Actualizacion reciente';
  }

  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) {
    return `Actualizado hace ${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `Actualizado hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
  }

  const hours = Math.floor(minutes / 60);
  return `Actualizado hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <div className="min-h-[86px] rounded-[14px] border border-[#e4eaf3] bg-[#f8fbff] p-3 dark:border-slate-600 dark:bg-slate-800">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[0.68rem] font-black text-[#64748b] dark:text-slate-300">
          {label}
        </span>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-white text-[#102d92] shadow-sm dark:bg-slate-900 dark:text-blue-200">
          <Icon size={15} strokeWidth={2.4} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 text-[1.25rem] font-black leading-none text-[#111827] dark:text-white">
        {value}
      </p>
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
  key: string;
  codigo: string;
  tipo: string;
  calidad: string;
  pesoDisponibleKg: number;
  diasEnBodega: number;
  fechaIngreso: string;
};

function BodegaCoffeeRow({ item }: { item: BodegaCoffeeItem }) {
  const isGood = item.calidad.toLowerCase() === 'bueno';
  const isDry = item.tipo.toLowerCase() === 'seco';
  const Icon = isDry ? SunMedium : isGood ? ShieldCheck : Sparkles;
  const iconClass = isDry
    ? 'bg-[#fff1da] text-[#c4670e] dark:bg-amber-500/20 dark:text-amber-100'
    : isGood
      ? 'bg-[#dcfce7] text-[#16845a] dark:bg-emerald-500/20 dark:text-emerald-100'
      : 'bg-[#fff7d6] text-[#b77905] dark:bg-amber-500/20 dark:text-amber-100';
  const qualityClass = isGood
    ? 'border border-emerald-200 bg-[#dcfce7] text-[#16845a] dark:border-emerald-400/50 dark:bg-emerald-500/20 dark:text-emerald-100'
    : 'border border-amber-200 bg-[#fff3c4] text-[#a15c00] dark:border-amber-400/50 dark:bg-amber-500/20 dark:text-amber-100';

  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] ${iconClass}`}
        >
          <Icon size={17} strokeWidth={2.35} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[0.78rem] font-black leading-tight text-[#1f2937] dark:text-slate-100">
            {item.codigo || item.tipo}
          </p>
          <p className="mt-1 flex items-center gap-1 text-[0.58rem] font-bold uppercase tracking-[0.04em] text-[#8a98ad] dark:text-slate-300">
            <CalendarDays size={10} strokeWidth={2.2} />
            {item.tipo} · {item.diasEnBodega} días en bodega
          </p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[0.78rem] font-black text-[#18479d] dark:text-blue-200">
          {formatKgUpper(item.pesoDisponibleKg)}
        </p>
        <span
          className={`mt-1 inline-flex rounded-full px-1.5 py-0.5 text-[0.46rem] font-black uppercase ${qualityClass}`}
        >
          {item.calidad}
        </span>
      </div>
    </div>
  );
}

function EmptyDashboardState({
  onRegisterPurchase,
}: {
  onRegisterPurchase: () => void;
}) {
  return (
    <section className="px-5 pt-6">
      <style>
        {`
          @keyframes cafesmartFadeUp {
            0% { opacity: 0; transform: translateY(14px); }
            100% { opacity: 1; transform: translateY(0); }
          }

          @keyframes cafesmartFloatSoft {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-7px); }
          }

          @keyframes cafesmartGlowBreath {
            0%, 100% { opacity: .52; transform: scale(.96); }
            50% { opacity: .9; transform: scale(1.06); }
          }
        `}
      </style>
      <div className="relative overflow-hidden rounded-[30px] border border-[#e1e8f3] bg-white px-6 pb-8 pt-9 text-center shadow-[0_22px_54px_rgba(15,23,42,0.1)]">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24">
          <svg
            className="absolute bottom-0 h-full w-full"
            viewBox="0 0 390 112"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M0 51C48 29 89 39 133 60C184 85 226 53 276 47C318 42 352 58 390 76V112H0V51Z"
              fill="#dbeafe"
              opacity="0.7"
            />
            <path
              d="M0 76C52 55 101 62 151 82C199 101 238 78 284 72C328 66 357 79 390 94V112H0V76Z"
              fill="#bfdbfe"
              opacity="0.48"
            />
          </svg>
        </div>

        <div className="relative z-10 mx-auto h-36 w-36 animate-[cafesmartFadeUp_300ms_ease-out_both]">
          <div className="absolute inset-0 rounded-full bg-[#e9f3ff] animate-[cafesmartGlowBreath_3.2s_ease-in-out_infinite]" />
          <div className="absolute inset-4 rounded-full bg-[#bfdbfe]/55 blur-sm animate-[cafesmartGlowBreath_3.6s_ease-in-out_infinite]" />
          <span className="absolute left-0 top-10 h-2 w-2 rounded-full bg-[#7db5ff] opacity-70 animate-[cafesmartFloatSoft_3.8s_ease-in-out_infinite]" />
          <span className="absolute right-3 top-6 h-2.5 w-2.5 rounded-full bg-white shadow-[0_0_16px_rgba(22,131,247,0.32)] animate-[cafesmartGlowBreath_3.4s_ease-in-out_infinite]" />
          <div className="absolute inset-3 flex items-center justify-center rounded-full bg-[#eef6ff] shadow-[0_22px_46px_rgba(37,99,235,0.13)] animate-[cafesmartFloatSoft_3.7s_ease-in-out_infinite]">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-[26px] bg-white shadow-[0_14px_32px_rgba(37,99,235,0.12)]">
              <PackageCheck
                size={38}
                className="text-[#1683f7]"
                strokeWidth={2.25}
                aria-hidden="true"
              />
              <span className="absolute -right-3 -top-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-[#e7f1ff] text-[#102d92] shadow-[0_10px_24px_rgba(16,45,146,0.12)]">
                <ShoppingCart size={19} strokeWidth={2.5} aria-hidden="true" />
              </span>
            </div>
          </div>
          <img
            src="/imagenes-de-proyecto/granito-inteligente.png"
            alt=""
            className="absolute bottom-4 left-5 h-9 w-9 object-contain drop-shadow-sm"
          />
        </div>

        <h2 className="relative z-10 mt-6 text-[1.34rem] font-black leading-tight text-[#101828] animate-[cafesmartFadeUp_320ms_ease-out_80ms_both]">
          Registra tu primera compra
        </h2>
        <p className="relative z-10 mx-auto mt-3 max-w-[292px] text-[0.9rem] font-semibold leading-6 text-[#52627a] animate-[cafesmartFadeUp_320ms_ease-out_140ms_both]">
          Agrega tu primera compra para comenzar a organizar tu café.
        </p>
        <button
          type="button"
          onClick={onRegisterPurchase}
          className="relative z-10 mt-7 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[17px] bg-[#173b9c] px-5 text-[0.92rem] font-black text-white shadow-[0_16px_32px_rgba(23,59,156,0.24),0_0_22px_rgba(22,131,247,0.14)] transition duration-200 hover:bg-[#123384] hover:shadow-[0_20px_38px_rgba(23,59,156,0.28),0_0_28px_rgba(22,131,247,0.18)] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#173b9c]/20 animate-[cafesmartFadeUp_320ms_ease-out_200ms_both]"
        >
          <ShoppingCart size={17} strokeWidth={2.5} aria-hidden="true" />
          Registrar compra
        </button>
      </div>
    </section>
  );
}

function DashboardLoadingState() {
  return (
    <CafeSmartProcessingScreen
      title="Cargando inicio"
      subtitle="Estamos preparando la información de tu negocio."
      helperText="Actualizando dashboard, bodega, inventario y movimientos recientes."
      trustTitle="CaféSmart está sincronizando tus datos"
      trustText="La pantalla se cerrará automáticamente cuando todo esté listo."
      variant="purchase"
    />
  );
}

function DashboardErrorState({
  onRetry,
  title = 'No pudimos cargar el inicio',
  message = 'Revisa tu conexión e intenta nuevamente.',
}: {
  onRetry: () => void;
  title?: string;
  message?: string;
}) {
  return (
    <section className="px-5 pt-6">
      <div className="rounded-[18px] border border-rose-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.06)]">
        <p className="text-[0.8rem] font-black text-[#1f2937]">
          {title}
        </p>
        <p className="mt-1 text-[0.68rem] font-semibold leading-5 text-[#65758f]">
          {message}
        </p>
        <RefreshButton
          onClick={onRetry}
          aria-label="Recargar"
          className="mt-4 w-full"
        >
          Recargar
        </RefreshButton>
      </div>
    </section>
  );
}

export default function Inicio() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { tone, isOnline, backendReachable, refreshHealth } = useCloudStatus();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [lotesBodega, setLotesBodega] = useState<LoteResumen[]>([]);
  const [inventarioBodegaInicio, setInventarioBodegaInicio] = useState<
    DashboardInicioBodegaItem[]
  >([]);
  const [usingCachedDashboard, setUsingCachedDashboard] = useState(false);
  const [offlineCacheMissing, setOfflineCacheMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [mostrarOnboardingBodega, setMostrarOnboardingBodega] = useState(false);
  const [capacidadInicialKg, setCapacidadInicialKg] = useState('');
  const [guardandoCapacidadInicial, setGuardandoCapacidadInicial] =
    useState(false);
  const [capacidadInicialError, setCapacidadInicialError] =
    useState<string | null>(null);
  const [mostrarEditorBodega, setMostrarEditorBodega] = useState(false);
  const [nombreBodegaLocal, setNombreBodegaLocal] = useState('Bodega principal');
  const [capacidadBodegaLocal, setCapacidadBodegaLocal] = useState('');
  const [bodegaLocalError, setBodegaLocalError] = useState<string | null>(null);
  const [bodegaLimitNotice, setBodegaLimitNotice] = useState<string | null>(null);
  const [storageAlertClosed, setStorageAlertClosed] = useState(false);
  const [preparingOffline, setPreparingOffline] = useState(false);
  const [offlinePrepFeedback, setOfflinePrepFeedback] = useState<{
    variant: 'success' | 'error';
    title: string;
    description: string;
  } | null>(null);
  const [showLimitsOnboarding, setShowLimitsOnboarding] = useState(false);

  useEffect(() => {
    let active = true;
    const key = `${LIMITS_ONBOARDING_KEY_PREFIX}:${user?.id ?? 'anon'}`;

    const loadLimitsOnboarding = async () => {
      const { value } = await Preferences.get({ key });
      if (active) {
        setShowLimitsOnboarding(value !== 'dismissed' && value !== 'configured');
      }
    };

    void loadLimitsOnboarding();

    return () => {
      active = false;
    };
  }, [user?.id]);

  const markLimitsOnboarding = async (status: 'dismissed' | 'configured') => {
    const key = `${LIMITS_ONBOARDING_KEY_PREFIX}:${user?.id ?? 'anon'}`;
    setShowLimitsOnboarding(false);
    await Preferences.set({ key, value: status });
  };

  const abrirLimitesDesdeInicio = () => {
    void markLimitsOnboarding('configured');
    navigate('/ajustes', { state: { openLimits: true } });
  };

  const cargarDashboardDesdeCache = useCallback(async () => {
    const cachedHome = await getOfflineCache<CachedDashboardHome>(
      DASHBOARD_HOME_CACHE_KEY,
    );

    if (!cachedHome) {
      setSummary(null);
      setLotesBodega([]);
      setInventarioBodegaInicio([]);
      setUsingCachedDashboard(false);
      setOfflineCacheMissing(true);
      setError(null);
      return false;
    }

    setSummary(cachedHome.summary);
    setLotesBodega(cachedHome.lotesBodega);
    setInventarioBodegaInicio(cachedHome.inventarioBodega ?? []);
    setMostrarOnboardingBodega(false);
    setUsingCachedDashboard(true);
    setOfflineCacheMissing(false);
    setError(null);
    return true;
  }, []);

  const cargarDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const hasNoInternet = !isOnline;
      if (hasNoInternet) {
        await cargarDashboardDesdeCache();
        return;
      }

      const dashboardInicioResult = await Promise.allSettled([
        obtenerDashboardInicio(),
        obtenerLotes(),
      ]);
      const [dashboardResult, lotesResult] =
        dashboardInicioResult[0].status === 'fulfilled'
          ? dashboardInicioResult
          : await Promise.allSettled([obtenerDashboardSummary(), obtenerLotes()]);

      if (dashboardResult.status === 'fulfilled') {
        setSummary(dashboardResult.value);
        setInventarioBodegaInicio(
          'inventarioBodega' in dashboardResult.value
            ? dashboardResult.value.inventarioBodega
            : [],
        );
        setUsingCachedDashboard(false);
        setOfflineCacheMissing(false);
        setMostrarOnboardingBodega(
          !dashboardResult.value.kgCapacidad ||
            dashboardResult.value.kgCapacidad <= 0,
        );
        setError(null);
      } else {
        setUsingCachedDashboard(false);
        setOfflineCacheMissing(false);
        setInventarioBodegaInicio([]);
        setError(
          backendReachable === false
            ? 'No pudimos conectar con la nube'
            : resolveDashboardErrorMessage(dashboardResult.reason),
        );
      }

      if (lotesResult.status === 'fulfilled') {
        const nextLotes = (
          ENABLE_SECADO_PROTOTYPE
            ? applySecadoToLots(lotesResult.value)
            : lotesResult.value
        );
        setLotesBodega(nextLotes);

        if (dashboardResult.status === 'fulfilled') {
          void saveOfflineCache<CachedDashboardHome>(DASHBOARD_HOME_CACHE_KEY, {
            summary: dashboardResult.value,
            lotesBodega: nextLotes,
            inventarioBodega:
              'inventarioBodega' in dashboardResult.value
                ? dashboardResult.value.inventarioBodega
                : [],
            savedAt: new Date().toISOString(),
          });
          void saveOfflineCache('cached_inventory_summary', nextLotes);
          void saveOfflineCache(
            'cached_recent_movements',
            dashboardResult.value.movimientosRecientes,
          );
          void saveOfflineCache('cached_financial_summary', {
            totalComprasHoy: dashboardResult.value.totalComprasHoy,
            totalVentasHoy: dashboardResult.value.totalVentasHoy,
            totalGastosHoy: dashboardResult.value.totalGastosHoy,
            utilidadTotalAcumulada: dashboardResult.value.utilidadTotalAcumulada,
          });
          void saveOfflineCache('cached_sync_status', {
            savedAt: new Date().toISOString(),
          });
          void saveOfflineCache('inventory_sublotes', nextLotes);
          void saveOfflineCache('inventory_summary', {
            kgActual: dashboardResult.value.kgActual,
            kgCapacidad: dashboardResult.value.kgCapacidad,
            inventarioPorTipo: dashboardResult.value.inventarioPorTipo,
            updatedAt: dashboardResult.value.updatedAt,
          });
          void saveOfflineCache('dashboard_inventory_summary', {
            kgActual: dashboardResult.value.kgActual,
            kgCapacidad: dashboardResult.value.kgCapacidad,
            inventarioPorTipo: dashboardResult.value.inventarioPorTipo,
            updatedAt: dashboardResult.value.updatedAt,
          });
        }
      } else {
        setLotesBodega([]);
        if (dashboardResult.status === 'fulfilled') {
          void saveOfflineCache<CachedDashboardHome>(DASHBOARD_HOME_CACHE_KEY, {
            summary: dashboardResult.value,
            lotesBodega: [],
            inventarioBodega:
              'inventarioBodega' in dashboardResult.value
                ? dashboardResult.value.inventarioBodega
                : [],
            savedAt: new Date().toISOString(),
          });
        }
      }
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [backendReachable, cargarDashboardDesdeCache, isOnline]);

  useEffect(() => {
    void cargarDashboard();
  }, [cargarDashboard]);

  useEffect(() => {
    const timerId = window.setInterval(() => setNow(Date.now()), 60000);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  const handleReload = useCallback(async () => {
    await Promise.allSettled([cargarDashboard(true), refreshHealth()]);
  }, [cargarDashboard, refreshHealth]);

  const handlePrepareOffline = useCallback(async () => {
    setPreparingOffline(true);
    setOfflinePrepFeedback(null);
    try {
      const result = await prepareOfflineData();
      setOfflinePrepFeedback({
        variant: 'success',
        title: 'Datos guardados para uso sin conexión',
        description:
          result.savedKeys.length > 0
            ? 'Catálogos, inventario y resumen quedaron listos en este dispositivo.'
            : 'No encontramos datos nuevos para guardar, pero el cache existente se mantiene disponible.',
      });
    } catch {
      setOfflinePrepFeedback({
        variant: 'error',
        title: 'No pudimos preparar el modo sin conexión',
        description: 'Revisa la conexión con el servidor e intenta nuevamente.',
      });
    } finally {
      setPreparingOffline(false);
    }
  }, []);

  const guardarCapacidadInicial = useCallback(async () => {
    const capacidad = Number(capacidadInicialKg);
    if (!Number.isFinite(capacidad) || capacidad <= 0) {
      setCapacidadInicialError('Ingresa una capacidad mayor a 0.');
      return;
    }

    setGuardandoCapacidadInicial(true);
    setCapacidadInicialError(null);
    try {
      await guardarConfiguracionBodega({
        nombreBodega: 'Bodega principal',
        capacidadKg: capacidad,
      });
      setMostrarOnboardingBodega(false);
      setCapacidadInicialKg('');
      await cargarDashboard(true);
    } catch {
      setCapacidadInicialError('No pudimos guardar la capacidad. Intenta otra vez.');
    } finally {
      setGuardandoCapacidadInicial(false);
    }
  }, [capacidadInicialKg, cargarDashboard]);

  const abrirEditorBodegaLocal = () => {
    setNombreBodegaLocal('Bodega principal');
    setCapacidadBodegaLocal(
      summary?.kgCapacidad ? String(Math.min(summary.kgCapacidad, BODEGA_CAPACITY_MAX_KG)) : '',
    );
    setBodegaLocalError(null);
    setMostrarEditorBodega(true);
  };

  const guardarBodegaLocal = async () => {
    const capacidad = Number(capacidadBodegaLocal);
    if (!nombreBodegaLocal.trim()) {
      setBodegaLocalError('Escribe un nombre para la bodega.');
      return;
    }
    if (!Number.isFinite(capacidad) || capacidad <= 0) {
      setBodegaLocalError('Ingresa un valor válido para continuar.');
      return;
    }
    if (capacidad > BODEGA_CAPACITY_MAX_KG) {
      setBodegaLocalError('La capacidad no puede superar 100.000 kg.');
      return;
    }
    await guardarConfiguracionBodega({
      nombreBodega: nombreBodegaLocal.trim(),
      capacidadKg: capacidad,
    });
    setMostrarEditorBodega(false);
    await cargarDashboard(true);
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
        porcentajeVisual: 0,
        etiqueta: loading ? '...' : '0%',
        excedida: false,
        nivel: 'normal' as const,
      };
    }

    const porcentajeReal = Math.max(0, (kgActual / kgCapacidad) * 100);

    return {
      porcentaje: porcentajeReal,
      porcentajeVisual: Math.min(100, porcentajeReal),
      etiqueta: formatPercentage(porcentajeReal),
      excedida: porcentajeReal > 100,
      nivel:
        porcentajeReal > 100
          ? 'alert'
          : porcentajeReal >= 95
          ? 'alert'
          : porcentajeReal >= 80
            ? 'warning'
            : 'normal',
    };
  }, [loading, summary?.kgActual, summary?.kgCapacidad]);

  const ocupacionVisual = useMemo(() => {
    if (ocupacion.nivel === 'alert') {
      return {
        card: 'border-red-300 bg-red-50 text-red-900 dark:border-red-600 dark:bg-red-950/40 dark:text-red-100',
        text: 'text-red-800 dark:text-red-100',
        bar: 'bg-red-500 dark:bg-red-400',
        track: 'border-red-300 bg-red-100 dark:border-red-600 dark:bg-red-950/50',
        badge: 'border border-red-300 bg-red-100 text-red-900 dark:border-red-600 dark:bg-red-900/50 dark:text-red-100',
      };
    }
    if (ocupacion.nivel === 'warning') {
      return {
        card: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-600 dark:bg-amber-950/35 dark:text-amber-100',
        text: 'text-amber-900 dark:text-amber-100',
        bar: 'bg-amber-500 dark:bg-amber-400',
        track: 'border-amber-300 bg-amber-100 dark:border-amber-600 dark:bg-amber-950/50',
        badge: 'border border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-600 dark:bg-amber-900/50 dark:text-amber-100',
      };
    }
    return {
      card: 'border-[#e6e8f3] bg-white dark:border-slate-700 dark:bg-slate-900',
      text: 'text-[#102d92] dark:text-blue-200',
        bar: 'bg-blue-600 dark:bg-blue-400',
      track: 'border-[#c7d2fe] bg-[#e8efff] dark:border-blue-700 dark:bg-blue-950/35',
      badge: 'border border-blue-200 bg-blue-100 text-blue-900 dark:border-blue-700 dark:bg-blue-900/50 dark:text-blue-200',
    };
  }, [ocupacion.nivel]);

  const alertaBodega = useMemo(() => {
    const kgActual = summary?.kgActual ?? null;
    const kgCapacidad = summary?.kgCapacidad ?? null;
    if (
      kgActual === null ||
      kgCapacidad === null ||
      !Number.isFinite(kgActual) ||
      !Number.isFinite(kgCapacidad) ||
      kgCapacidad <= 0
    ) {
      return null;
    }

    const porcentajeReal = (kgActual / kgCapacidad) * 100;
    const data = {
      occupancyPercent: porcentajeReal,
      capacityKg: kgCapacidad,
      usedKg: kgActual,
    };
    if (porcentajeReal > 100) {
      return {
        title: 'Bodega casi llena.',
        text: 'Revisa el espacio antes de continuar.',
        variant: 'error' as const,
        primary: 'Ir a ventas',
        secondary: 'Editar bodega',
        secondaryPath: '/ajustes',
        data,
      };
    }
    if (porcentajeReal >= 95) {
      return {
        title: 'Bodega casi llena.',
        text: 'Revisa el espacio antes de continuar.',
        variant: 'error' as const,
        primary: 'Ir a ventas',
        secondary: 'Editar bodega',
        secondaryPath: '/ajustes',
        data,
      };
    }
    if (porcentajeReal >= 80) {
      return {
        title: 'Bodega casi llena.',
        text: 'Revisa el espacio antes de continuar.',
        variant: 'warning' as const,
        primary: 'Ir a ventas',
        primaryPath: '/ventas',
        secondary: 'Editar bodega',
        secondaryPath: '/ajustes',
        data,
      };
    }
    return null;
  }, [summary?.kgActual, summary?.kgCapacidad]);

  useEffect(() => {
    setStorageAlertClosed(false);
  }, [
    alertaBodega?.title,
    alertaBodega?.data.occupancyPercent,
    alertaBodega?.data.capacityKg,
    alertaBodega?.data.usedKg,
  ]);

  const mostrarAlertaBodega = Boolean(alertaBodega && !storageAlertClosed);

  const cafeEnBodega = useMemo(() => {
    if (inventarioBodegaInicio.length > 0) {
      return inventarioBodegaInicio
        .map((item) => {
          const legacyItem = item as DashboardInicioBodegaItem & {
            key?: string;
            totalKg?: number;
            averageDays?: number;
          };
          return {
            key: item.id ?? legacyItem.key ?? `${item.tipoCafeId}-${item.calidadId}`,
            codigo: item.codigo ?? legacyItem.key ?? item.tipo,
            tipo: item.tipo,
            calidad: item.calidad,
            pesoDisponibleKg: item.pesoDisponibleKg ?? legacyItem.totalKg ?? 0,
            diasEnBodega: item.diasEnBodega ?? legacyItem.averageDays ?? 0,
            fechaIngreso:
              item.fechaIngreso ?? item.creadoEn ?? new Date(0).toISOString(),
          };
        })
        .filter((item) => item.pesoDisponibleKg > 0)
        .sort((a, b) => {
          const dateA = new Date(a.fechaIngreso).getTime();
          const dateB = new Date(b.fechaIngreso).getTime();
          if (dateA !== dateB) return dateA - dateB;
          return a.key.localeCompare(b.key);
        })
        .slice(0, 3);
    }

    return lotesBodega
      .filter((lot) => lot.pesoActual > 0)
      .map((lot) => ({
        key: lot.id,
        codigo: lot.codigo,
        tipo: lot.tipoCafe,
        calidad: lot.calidad,
        pesoDisponibleKg: lot.pesoActual,
        diasEnBodega: lotDays(lot),
        fechaIngreso: lot.fechaPrimerIngreso || lot.fecha || lot.creadoEn,
      }))
      .sort((a, b) => {
        const dateA = new Date(a.fechaIngreso).getTime();
        const dateB = new Date(b.fechaIngreso).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return a.key.localeCompare(b.key);
      })
      .slice(0, 3);
  }, [inventarioBodegaInicio, lotesBodega]);

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
  const dashboardState = loading
    ? 'loading'
    : (error || offlineCacheMissing) && !summary
      ? 'error'
      : 'valid';

  if (dashboardState === 'loading') {
    return <DashboardLoadingState />;
  }

  return (
    <div className="relative min-h-screen bg-[#f4f7fb] pb-32 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {refreshing ? (
        <div className="fixed inset-0 z-40 bg-white/82 backdrop-blur-sm dark:bg-slate-950/82">
          <DashboardLoadingState />
        </div>
      ) : null}
      <div className="mx-auto w-full max-w-[430px]">
        <header className="px-5 pb-4 pt-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[1.35rem] font-black text-[#111827] dark:text-slate-50">
                Caf&eacute; Smart
              </h1>
              <div className="mt-1.5 inline-flex items-center gap-2 rounded-full bg-white px-2.5 py-1 text-[0.58rem] font-black uppercase tracking-[0.12em] text-[#72809a] shadow-sm dark:bg-slate-900 dark:text-slate-200">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${resolveCloudDotClass(tone)}`}
                  aria-hidden="true"
                />
                <span>{resolveCloudLabel(tone)}</span>
              </div>
              {usingCachedDashboard ? (
                <p className="mt-2 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[0.62rem] font-black text-amber-800">
                  Información guardada en este dispositivo
                </p>
              ) : dashboardState === 'valid' ? (
                <p className="mt-2 text-[0.68rem] font-bold text-[#72809a] dark:text-slate-300">
                  {formatUpdatedAgo(summary?.updatedAt ?? null, now)}
                </p>
              ) : null}
            </div>

            <RefreshButton
              onClick={() => void handleReload()}
              loading={refreshing}
              aria-label="Recargar"
            >
              Recargar
            </RefreshButton>
          </div>
        </header>

        {dashboardState === 'error' ? (
          <DashboardErrorState
            onRetry={() => void handleReload()}
            title={
              offlineCacheMissing
                ? 'No hay información guardada'
                : error === 'No pudimos conectar con la nube'
                  ? 'Conexión inestable'
                  : 'No pudimos cargar el inicio'
            }
            message={
              offlineCacheMissing
                ? 'Conéctate a internet una vez para cargar tus datos y poder consultarlos sin conexión.'
                : error === 'No pudimos conectar con la nube'
                  ? 'Puedes seguir usando los datos guardados. Intentaremos sincronizar cuando vuelva la conexión.'
                  : 'Revisa tu conexión e intenta nuevamente.'
            }
          />
        ) : null}

        {dashboardState === 'valid' && error ? (
          <section className="px-5 pb-3">
            <div className="rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-400/30 dark:bg-amber-500/10">
              <p className="text-[0.76rem] font-black text-amber-900 dark:text-amber-100">
                Conexión inestable
              </p>
              <p className="mt-1 text-[0.68rem] font-semibold leading-5 text-amber-800 dark:text-amber-200">
                Puedes seguir usando los datos guardados. Intentaremos sincronizar cuando vuelva la conexión.
              </p>
            </div>
          </section>
        ) : null}

        {dashboardState === 'valid' && showLimitsOnboarding ? (
          <section className="px-5 pb-3">
            <div className="rounded-[18px] border border-blue-100 bg-blue-50/80 px-4 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.06)] dark:border-blue-400/20 dark:bg-blue-500/10">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-blue-700 shadow-sm dark:bg-slate-900 dark:text-blue-200">
                  <Scale size={17} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.82rem] font-black text-slate-950 dark:text-slate-50">
                    Configura tus límites de transacción
                  </p>
                  <p className="mt-1 text-[0.68rem] font-semibold leading-5 text-slate-600 dark:text-slate-200">
                    Define valores mínimos y máximos para compras y ventas. Esto ayuda a evitar errores al registrar movimientos.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={abrirLimitesDesdeInicio}
                      className="inline-flex min-h-[38px] items-center justify-center rounded-[12px] bg-[#102d92] px-3 text-[0.68rem] font-black text-white dark:bg-blue-600"
                    >
                      Configurar límites
                    </button>
                    <button
                      type="button"
                      onClick={() => void markLimitsOnboarding('dismissed')}
                      className="inline-flex min-h-[38px] items-center justify-center rounded-[12px] border border-blue-200 bg-white px-3 text-[0.68rem] font-black text-[#102d92] dark:border-blue-400/30 dark:bg-slate-900 dark:text-blue-100"
                    >
                      Ahora no
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {dashboardState === 'valid' ? (
          <section className="px-5 pb-3">
            <div className="rounded-[18px] border border-[#dbe2ee] bg-white px-4 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.06)] dark:border-slate-600 dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[0.78rem] font-black text-[#111827] dark:text-slate-50">
                    Preparar modo sin conexión
                  </p>
                  <p className="mt-1 text-[0.66rem] font-semibold leading-5 text-[#65758f] dark:text-slate-300">
                    Guarda catálogos, inventario y resumen para trabajar offline.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handlePrepareOffline()}
                  disabled={preparingOffline || !isOnline}
                  className="inline-flex min-h-[38px] shrink-0 items-center justify-center gap-2 rounded-[12px] bg-emerald-700 px-3 text-[0.68rem] font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Sparkles size={14} aria-hidden="true" />
                  {preparingOffline ? 'Guardando' : 'Preparar'}
                </button>
              </div>
              {offlinePrepFeedback ? (
                <AppFeedbackMessage
                  className="mt-3"
                  variant={offlinePrepFeedback.variant}
                  title={offlinePrepFeedback.title}
                  description={offlinePrepFeedback.description}
                />
              ) : null}
            </div>
          </section>
        ) : null}

        {dashboardState === 'valid' && mostrarOnboardingBodega ? (
          <section className="px-5 pb-3">
            <div className="rounded-[18px] border border-[#f59e0b] bg-[#fff4cc] px-4 py-3 text-[#5f370e] shadow-[0_10px_24px_rgba(180,83,9,0.16)] dark:border-amber-500/80 dark:bg-amber-950/45 dark:text-amber-50">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/80 text-[#92400e] dark:bg-amber-900/60 dark:text-amber-100">
                  <Warehouse size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.88rem] font-black">
                    Configura la capacidad de tu bodega
                  </p>
                  <p className="mt-1 text-[0.74rem] font-bold leading-5">
                    Necesitamos este dato para validar compras, inventario y ventas.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMostrarOnboardingBodega(false)}
                      className="inline-flex min-h-[34px] items-center rounded-full bg-white/70 px-3 text-[0.72rem] font-black text-[#5f370e] dark:border dark:border-amber-400/50 dark:bg-slate-900 dark:text-amber-50"
                    >
                      Más tarde
                    </button>
                    <button
                      type="button"
                      onClick={() => setCapacidadInicialKg((value) => value || '6000')}
                      className="inline-flex min-h-[34px] items-center rounded-full bg-[#102d92] px-3 text-[0.72rem] font-black text-white"
                    >
                      Configurar bodega
                    </button>
                  </div>
                  {capacidadInicialKg ? (
                    <div className="mt-3 rounded-[14px] bg-white/75 p-3 dark:bg-slate-900/80">
                      <label htmlFor="inicio-capacidad-inicial" className="text-[0.72rem] font-black text-[#5f370e] dark:text-amber-100">
                        Capacidad máxima (kg)
                      </label>
                      <input
                        id="inicio-capacidad-inicial"
                        type="number"
                        min="1"
                        value={capacidadInicialKg}
                        onChange={(event) => {
                          setCapacidadInicialKg(event.target.value);
                          setCapacidadInicialError(null);
                        }}
                        className="mt-1 h-10 w-full rounded-[12px] border border-[#f3c363] bg-white px-3 text-sm font-black text-slate-900 outline-none placeholder:text-slate-400 dark:border-amber-400/70 dark:bg-slate-950 dark:text-slate-50 dark:placeholder:text-slate-400"
                        placeholder="Ej. 6000"
                      />
                      {capacidadInicialError ? (
                        <p className="mt-2 text-xs font-black text-[#b42318]">
                          {capacidadInicialError}
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void guardarCapacidadInicial()}
                        disabled={guardandoCapacidadInicial}
                        className="mt-2 inline-flex min-h-[38px] w-full items-center justify-center rounded-[12px] bg-[#102d92] px-3 text-xs font-black text-white disabled:cursor-wait disabled:opacity-70"
                      >
                        {guardandoCapacidadInicial ? 'Guardando...' : 'Guardar capacidad'}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {mostrarEditorBodega ? (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0f172a]/45 px-5 py-6 backdrop-blur-sm">
            <section className="w-full max-w-[390px] rounded-[22px] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.24)]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-black text-slate-950">
                  Editar capacidad de bodega
                </h2>
                <button
                  type="button"
                  onClick={() => setMostrarEditorBodega(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                  aria-label="Cerrar"
                >
                  ×
                </button>
              </div>
              {bodegaLimitNotice ? (
                <AppFeedbackMessage
                  variant="warning"
                  description={bodegaLimitNotice}
                  className="mt-3"
                />
              ) : null}
              <label htmlFor="inicio-nombre-bodega" className="mt-4 block text-xs font-black text-slate-700">
                Nombre de bodega
              </label>
              <input
                id="inicio-nombre-bodega"
                type="text"
                aria-label="Nombre de bodega"
                title="Nombre de bodega"
                value={nombreBodegaLocal}
                maxLength={BODEGA_NAME_MAX_LENGTH}
                onChange={(event) => {
                  if (event.target.value.length >= BODEGA_NAME_MAX_LENGTH) {
                    setBodegaLimitNotice('Llegaste al máximo permitido.');
                    window.setTimeout(() => setBodegaLimitNotice(null), 1800);
                  }
                  setNombreBodegaLocal(
                    sanitizeLimitedText(event.target.value, BODEGA_NAME_MAX_LENGTH),
                  );
                }}
                className="mt-2 h-11 w-full rounded-[14px] border border-[#dbe2f0] bg-[#f8faff] px-4 text-sm font-bold outline-none"
              />
              <p className="mt-1 text-right text-xs font-bold text-slate-500">
                {nombreBodegaLocal.length}/{BODEGA_NAME_MAX_LENGTH}
              </p>
              <label htmlFor="inicio-capacidad-bodega" className="mt-3 block text-xs font-black text-slate-700">
                Capacidad máxima kg
              </label>
              <input
                id="inicio-capacidad-bodega"
                type="text"
                inputMode="numeric"
                value={capacidadBodegaLocal}
                onChange={(event) =>
                  setCapacidadBodegaLocal(
                    sanitizePositiveIntegerInput(event.target.value, BODEGA_CAPACITY_MAX_KG),
                  )
                }
                className="mt-2 h-11 w-full rounded-[14px] border border-[#dbe2f0] bg-[#f8faff] px-4 text-sm font-bold outline-none"
                placeholder="100000"
              />
              {bodegaLocalError ? (
                <AppFeedbackMessage
                  variant="error"
                  description={bodegaLocalError}
                  className="mt-3"
                />
              ) : null}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void guardarBodegaLocal()}
                  className="min-h-[42px] rounded-[14px] bg-[#102d92] px-3 text-sm font-black text-white"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setMostrarEditorBodega(false)}
                  className="min-h-[42px] rounded-[14px] border border-[#d5deee] bg-white px-3 text-sm font-black text-[#334b85]"
                >
                  Cancelar
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {dashboardState === 'valid' && isEmptyDashboard ? (
          <EmptyDashboardState
            onRegisterPurchase={() => navigate('/compras')}
          />
        ) : dashboardState === 'valid' ? (
          <>
            <section className="px-5 py-3">
              <div className={`mt-3 ${cardClass}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={sectionTitleClass}>Resumen del d&iacute;a</p>
                    <p className="mt-1 text-[0.72rem] font-semibold text-[#65758f] dark:text-slate-300">
                      Actividad principal de tu negocio.
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 rounded-full border border-[#dbe5ff] bg-[#f7f9ff] px-3 py-1 text-[0.64rem] font-black uppercase tracking-[0.08em] text-[#102d92] dark:border-blue-500/60 dark:bg-blue-500/20 dark:text-blue-100">
                    Hoy
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  <MetricCard
                    label="Compras"
                    value={formatMetric(
                      loading,
                      summary?.comprasHoy ?? null,
                      formatInteger,
                    )}
                    icon={ShoppingCart}
                  />
                  <MetricCard
                    label="Ventas"
                    value={formatMetric(
                      loading,
                      summary?.ventasHoy ?? null,
                      formatInteger,
                    )}
                    icon={CalendarDays}
                  />
                  <MetricCard
                    label="Kg comprados"
                    value={formatMetric(
                      loading,
                      summary?.kgCompradosHoy ?? null,
                      formatKg,
                    )}
                    icon={PackageCheck}
                  />
                  <MetricCard
                    label="Productores"
                    value={formatMetric(
                      loading,
                      summary?.totalProductores ?? null,
                      formatInteger,
                    )}
                    icon={ShieldCheck}
                  />
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/gastos')}
                  className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center rounded-[14px] bg-[#102d92] px-4 text-sm font-black text-white shadow-[0_12px_24px_rgba(16,45,146,0.18)] transition hover:bg-[#173ea6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:bg-blue-600 dark:hover:bg-blue-500"
                >
                  Registrar gasto
                </button>
              </div>
            </section>

            <section className="px-5 py-3">
              <p className={sectionTitleClass}>Capacidad en bodega</p>

              <div className={`mt-3 rounded-[18px] border p-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)] ${ocupacionVisual.card}`}>
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-[0.9rem] font-black text-[#1f2937] dark:text-slate-100">
                    Ocupaci&oacute;n actual
                  </h2>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[1rem] font-black ${ocupacionVisual.badge}`}
                  >
                    {ocupacion.etiqueta}
                  </span>
                </div>

                <div
                  role="progressbar"
                  aria-label="Porcentaje de ocupación de bodega"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  aria-valuenow={String(Math.round(ocupacion.porcentajeVisual))}
                  aria-valuetext={`${ocupacion.etiqueta} de ocupación de bodega`}
                  className={`mt-3 h-4 overflow-hidden rounded-full border p-0.5 shadow-inner ${ocupacionVisual.track}`}
                >
                  <div
                    className={`h-full min-w-2 rounded-full shadow-[0_1px_4px_rgba(15,23,42,0.24)] transition-[width] duration-500 ${ocupacionVisual.bar}`}
                    style={{ width: `${ocupacion.porcentajeVisual}%` }}
                  />
                </div>

                <div className={`mt-2 flex items-center justify-between gap-4 text-[0.58rem] font-black ${ocupacionVisual.text}`}>
                  <span>
                    {formatMetric(loading, summary?.kgActual ?? null, formatKg)}{' '}
                    usados
                  </span>
                  <span>
                    {formatMetric(
                      loading,
                      summary?.kgCapacidad ?? null,
                      formatKg,
                    )}{' '}
                    total
                  </span>
                </div>
                {alertaBodega && mostrarAlertaBodega ? (
                  <div className="relative mt-3">
                    <AppFeedbackMessage
                      variant={alertaBodega.variant}
                      title={alertaBodega.title}
                      description={alertaBodega.text}
                      autoClose={false}
                      className="shadow-[0_12px_30px_rgba(15,23,42,0.10)]"
                      action={
                        <button
                          type="button"
                          onClick={() => setStorageAlertClosed(true)}
                          aria-label="Cerrar alerta de bodega"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-slate-700 transition-all hover:border-slate-300 hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50 dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-900 dark:hover:text-white"
                        >
                          <X size={15} aria-hidden="true" />
                        </button>
                      }
                    >
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            alertaBodega.secondary === 'Editar bodega'
                              ? abrirEditorBodegaLocal()
                              : navigate(alertaBodega.secondaryPath)
                          }
                          className="inline-flex min-h-[32px] items-center rounded-full bg-blue-700 px-3 text-[0.7rem] font-black text-white shadow-sm hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500"
                        >
                          {alertaBodega.secondary}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            navigate(alertaBodega.primaryPath ?? '/ventas')
                          }
                          className="inline-flex min-h-[32px] items-center rounded-full border border-slate-300 bg-white px-3 text-[0.7rem] font-black text-slate-800 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/40 dark:border-slate-500 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                        >
                          {alertaBodega.primary}
                        </button>
                      </div>
                    </AppFeedbackMessage>
                  </div>
                ) : null}
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
                    Aún no hay café disponible en esta bodega.
                  </div>
                ) : (
                  <div>
                    {cafeEnBodega.map((item, index) => (
                      <div
                        key={item.key}
                        className={index > 0 ? 'border-t border-[#edf1f7]' : ''}
                      >
                        <BodegaCoffeeRow item={item} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        ) : null}
      </div>

      <AppBottomNav />
    </div>
  );
}
