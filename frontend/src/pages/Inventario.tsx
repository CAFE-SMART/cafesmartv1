import React, { useEffect, useMemo, useState } from 'react';

function generarCodigoLote(tipo: string, calidad: string, numero: number): string {
  const tipoMap: Record<string, string> = {
    Verde: 'V',
    'Verde Bueno': 'VB',
    Seco: 'S',
    'Seco Bueno': 'SB',
    'Seco Regular': 'SR',
    'Verde Regular': 'VR',
  };

  const calMap: Record<string, string> = {
    Bueno: 'B',
    Regular: 'R',
    Excelente: 'E',
  };

  const t = tipoMap[tipo] || tipo.substring(0, 2).toUpperCase();
  const c = calMap[calidad] || calidad.substring(0, 1).toUpperCase();
  return `${t}-${c}-${String(numero).padStart(2, '0')}`;
}

import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeAlert,
  CircleDashed,
  Coffee,
  Leaf,
  Package2,
  RefreshCcw,
  ShoppingCart,
  SunMedium,
  WifiOff,
} from 'lucide-react';
import { AppBottomNav } from '../components/AppBottomNav';
import { obtenerLotes, type LoteResumen } from '../services/lotesService';
import { guardarConfiguracionBodega, obtenerConfiguracionBodega } from '../services/bodegaApi';
import { ApiRequestError } from '../services/apiService';
import {
  applySecadoToLots,
  getActiveSecadoSession,
  getActiveSecadoSessions,
} from '../utils/secadoFlow';
import { getDaysInBodega } from '../utils/date';
import { ENABLE_SECADO_PROTOTYPE } from '../config/features';
import {
  classifyHumidity,
  formatHumidityWithClassification,
} from '../utils/humidity';
import {
  BODEGA_CAPACITY_MAX_KG,
  BODEGA_NAME_MAX_LENGTH,
  sanitizeLimitedText,
  sanitizePositiveIntegerInput,
} from '../utils/inputLimits';

const TYPE_ORDER = [
  'VERDE',
  'EN SECADO',
  'SECO',
  'TRILLADO',
  'PASILLA',
] as const;
const BULTO_KG = 40.7;
const QUALITY_SECTIONS = [
  { key: 'BUENO', title: 'BUENO', dot: 'bg-[#74e3dd]' },
  { key: 'REGULAR', title: 'REGULAR', dot: 'bg-[#f6b81a]' },
  { key: 'MALO', title: 'MALO', dot: 'bg-[#d82433]' },
] as const;

function keyOf(value: string) {
  return value.trim().toUpperCase();
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(
    value,
  );
}

function formatSacks(valueKg: number) {
  const sacks = valueKg / BULTO_KG;
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(sacks);
}

function formatShortSacks(valueKg: number) {
  return formatSacks(valueKg);
}

function pluralLabel(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function displayCoffeeName(value: string) {
  const key = keyOf(value);
  if (key === 'EN SECADO') return 'En secado';
  return value.toLowerCase();
}

function getLotDays(lot: LoteResumen) {
  const oldest = getDaysInBodega(lot.fechaPrimerIngreso || lot.fecha);
  const newest = getDaysInBodega(lot.fechaUltimoIngreso || lot.fecha);

  return {
    max: Math.max(oldest, newest),
    min: Math.min(oldest, newest),
  };
}

function coffeeVisual(name: string) {
  const key = keyOf(name);

  if (key === 'VERDE') {
    return {
      icon: <Leaf size={18} />,
      bg: 'bg-[#e9fbf4]',
      text: 'text-[#0d7b67]',
      ring: '#0d7b67',
    };
  }

  if (key === 'SECO') {
    return {
      icon: <SunMedium size={18} />,
      bg: 'bg-[#fff7df]',
      text: 'text-[#d29309]',
      ring: '#d29309',
    };
  }

  if (key === 'EN SECADO') {
    return {
      icon: <CircleDashed size={18} />,
      bg: 'bg-[#fff7df]',
      text: 'text-[#b77900]',
      ring: '#b77900',
    };
  }

  if (key === 'PASILLA') {
    return {
      icon: <BadgeAlert size={18} />,
      bg: 'bg-[#ffe7e8]',
      text: 'text-[#c92c32]',
      ring: '#c92c32',
    };
  }

  return {
    icon: <Coffee size={18} />,
    bg: 'bg-[#eef1ff]',
    text: 'text-[#102d92]',
    ring: '#102d92',
  };
}

function isSecadoProcessLot(lot: LoteResumen) {
  return keyOf(lot.tipoCafe) === 'EN SECADO';
}

function secadoProgress(estado: string) {
  return estado === 'READY' ? 82 : 45;
}

function secadoStatusLabel(estado: string) {
  return estado === 'READY' ? 'Listo para finalizar' : 'Secado en proceso';
}

type InventarioError = {
  titulo: string;
  mensaje: string;
  detalle: string;
};

function EmptyInventoryAnimations() {
  return (
    <style>
      {`
        @keyframes inventoryEmptyFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes inventoryEmptyFloat {
          0%, 100% { transform: translateY(0) rotate(-1deg); }
          50% { transform: translateY(-9px) rotate(1deg); }
        }

        @keyframes inventoryEmptyGlow {
          0%, 100% { opacity: .72; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.055); }
        }

        @keyframes inventoryEmptyParticle {
          0%, 100% { opacity: .28; transform: translate3d(0, 0, 0); }
          50% { opacity: .82; transform: translate3d(4px, -9px, 0); }
        }

        @keyframes inventoryEmptySteam {
          0%, 100% { opacity: .38; transform: translateY(0) scaleX(1); }
          50% { opacity: .78; transform: translateY(-6px) scaleX(.95); }
        }
      `}
    </style>
  );
}

function EmptyInventoryIllustration() {
  return (
    <div className="relative mx-auto h-[190px] w-[230px] sm:h-[210px] sm:w-[252px]">
      <div className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#dbeeff] blur-2xl animate-[inventoryEmptyGlow_3.2s_ease-in-out_infinite]" />
      <div className="absolute left-1/2 top-9 h-28 w-44 -translate-x-1/2 rounded-full border border-white/70 bg-white/45 shadow-[0_28px_70px_rgba(37,99,235,0.13)] backdrop-blur-sm" />

      <span className="absolute left-6 top-9 h-2.5 w-2.5 rounded-full bg-[#8cc8ff] animate-[inventoryEmptyParticle_3.1s_ease-in-out_infinite]" />
      <span className="absolute right-9 top-5 h-2 w-2 rounded-full bg-[#b8dcff] animate-[inventoryEmptyParticle_3.6s_ease-in-out_infinite_180ms]" />
      <span className="absolute right-2 top-24 h-3 w-3 rounded-full bg-[#d6ebff] animate-[inventoryEmptyParticle_3.4s_ease-in-out_infinite_80ms]" />
      <span className="absolute left-2 bottom-16 h-2 w-2 rounded-full bg-[#a8d4ff] animate-[inventoryEmptyParticle_3.8s_ease-in-out_infinite_260ms]" />

      <div className="absolute inset-x-0 bottom-6 mx-auto h-7 w-36 rounded-full bg-[#103b8f]/10 blur-md" />

      <div className="absolute left-1/2 top-7 h-[145px] w-[176px] -translate-x-1/2 animate-[inventoryEmptyFloat_4.2s_ease-in-out_infinite]">
        <div className="absolute left-7 top-14 h-20 w-24 rotate-[-7deg] rounded-[20px] border border-[#d6e4f7] bg-[#f9fbff] shadow-[0_24px_46px_rgba(15,23,42,0.12)]">
          <div className="h-8 rounded-t-[20px] border-b border-[#e6edf8] bg-[#eef6ff]" />
          <div className="absolute left-5 top-4 h-10 w-10 rounded-full bg-white text-[#2f80ed] shadow-[0_10px_22px_rgba(37,99,235,0.12)]">
            <Package2 className="m-2.5" size={20} strokeWidth={2.3} />
          </div>
          <div className="absolute bottom-4 left-5 h-2 w-12 rounded-full bg-[#d9e7f8]" />
          <div className="absolute bottom-8 left-5 h-2 w-8 rounded-full bg-[#edf4fb]" />
        </div>

        <div className="absolute right-6 top-20 h-16 w-20 rotate-[6deg] rounded-[18px] border border-[#d8e6f7] bg-white shadow-[0_20px_40px_rgba(37,99,235,0.12)]">
          <div className="absolute inset-x-4 top-0 h-5 rounded-b-[12px] bg-[#e9f4ff]" />
          <div className="absolute bottom-4 left-4 h-2 w-11 rounded-full bg-[#dbeafe]" />
          <div className="absolute bottom-8 left-4 h-2 w-7 rounded-full bg-[#eef6ff]" />
        </div>

        <div className="absolute left-12 top-3 flex h-[98px] w-[86px] rotate-[4deg] items-end justify-center rounded-[26px] border border-[#dce7f2] bg-[#f4eadb] shadow-[0_24px_48px_rgba(15,23,42,0.12)]">
          <div className="absolute top-5 h-9 w-12 rounded-full border-2 border-[#d7c6ac]" />
          <div className="absolute bottom-0 h-16 w-full rounded-[24px] bg-[#ead9bf]" />
          <Coffee
            className="relative mb-5 text-[#8d642f]"
            size={31}
            strokeWidth={2.3}
          />
        </div>

        <div className="absolute right-12 top-10 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2f80ed] text-white shadow-[0_16px_30px_rgba(47,128,237,0.28)]">
          <ShoppingCart size={20} strokeWidth={2.4} />
        </div>

        <Leaf
          className="absolute left-4 top-32 rotate-[-18deg] text-[#5fc6a7]"
          size={28}
          strokeWidth={2.2}
        />
      </div>

      <div className="absolute left-[102px] top-11 h-10 w-7 text-[#9ccfff] animate-[inventoryEmptySteam_2.9s_ease-in-out_infinite]">
        <div className="mx-auto h-full w-1.5 rounded-full bg-current blur-[1px]" />
      </div>
      <div className="absolute left-[122px] top-8 h-12 w-8 text-[#c4e4ff] animate-[inventoryEmptySteam_3.2s_ease-in-out_infinite_120ms]">
        <div className="mx-auto h-full w-1.5 rounded-full bg-current blur-[1px]" />
      </div>
    </div>
  );
}

function EmptyInventoryWaves() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[170px] overflow-hidden">
      <svg
        className="absolute bottom-0 h-full w-full"
        viewBox="0 0 430 170"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 72C58 42 111 60 162 89C218 121 264 84 316 75C363 67 395 86 430 108V170H0V72Z"
          fill="#e8f4ff"
          opacity="0.92"
        />
        <path
          d="M0 112C62 82 118 94 174 119C226 143 273 113 321 104C365 95 397 113 430 130V170H0V112Z"
          fill="#cfe6ff"
          opacity="0.55"
        />
      </svg>
      <div className="absolute bottom-9 left-7 h-16 w-16 rounded-full border border-white/70 bg-white/35 blur-[1px]" />
      <div className="absolute bottom-5 right-10 h-24 w-24 rounded-full border border-white/60 bg-white/25 blur-[1px]" />
    </div>
  );
}

function traducirErrorInventario(error: unknown): InventarioError {
  const isBrowserOffline =
    typeof navigator !== 'undefined' && navigator.onLine === false;

  if (isBrowserOffline) {
    return {
      titulo: 'Sin conexión',
      mensaje: 'Verifica tu internet e intenta nuevamente.',
      detalle: 'Intenta nuevamente en unos segundos.',
    };
  }

  if (error instanceof ApiRequestError && error.status === 0) {
    return {
      titulo: 'No pudimos conectarnos',
      mensaje: 'El sistema está tardando más de lo esperado.',
      detalle: 'Intenta nuevamente en unos segundos.',
    };
  }

  if (
    error instanceof ApiRequestError &&
    (error.status >= 500 || error.code === 'DATABASE_BUSY')
  ) {
    return {
      titulo: 'Tuvimos un problema',
      mensaje: 'No pudimos completar la acción.',
      detalle: 'Intenta nuevamente en unos segundos.',
    };
  }

  return {
    titulo: 'Tuvimos un problema',
    mensaje: 'No pudimos cargar la información del inventario en este momento.',
    detalle: 'Intenta nuevamente en unos segundos.',
  };
}

function CapacityRing({
  totalKg,
  capacityKg,
}: {
  totalKg: number;
  capacityKg: number | null;
}) {
  if (!capacityKg) {
    return (
      <section className="rounded-[20px] border border-[#e6e8f3] bg-white p-4 shadow-sm">
        <p className="text-[0.95rem] font-black text-black">
          Resumen de Inventario
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-[2.1rem] font-black leading-none text-[#102d92]">
              {formatNumber(totalKg)} kg

            </p>
            <p className="mt-1 text-sm font-bold text-slate-600">
              Capacidad de bodega sin configurar
            </p>

          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#eef2ff] bg-white text-[#102d92] shadow-sm">
            <Coffee size={18} />
          </div>
        </div>
      </section>
    );
  }

  const safeCapacity = Math.max(1, capacityKg);
  const rawPercentage = Math.max(0, (totalKg / safeCapacity) * 100);
  const displayPercentage =
    rawPercentage === 0
      ? '0'
      : rawPercentage < 1
        ? rawPercentage.toFixed(1)
        : rawPercentage.toFixed(0);
  const ringPercentage =
    totalKg > 0 ? Math.max(1.5, Math.min(100, rawPercentage)) : 0;
  const isCapacityExceeded = rawPercentage > 100;
  const accentColor = isCapacityExceeded ? '#d92d20' : '#102d92';
  const accentTextClass = isCapacityExceeded
    ? 'text-[#b42318]'
    : 'text-[#102d92]';
  const circumference = 2 * Math.PI * 58;
  const offset = circumference - (ringPercentage / 100) * circumference;

  return (
    <section className="rounded-[20px] border border-[#e6e8f3] bg-white p-4 shadow-sm">
      <p
        className="text-[0.95rem] font-extrabold text-black"
        style={{ fontWeight: 900 }}
      >
        Resumen de Inventario
      </p>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-end gap-2">
            <p className={`text-[2.1rem] font-black leading-none ${accentTextClass}`}>
              {formatNumber(totalKg)}
            </p>
            <span className="pb-0.5 text-[1.2rem] font-bold text-slate-400">
              / {formatNumber(safeCapacity)} kg
            </span>
          </div>
          <p
            className={`mt-1 text-sm font-bold ${isCapacityExceeded ? 'text-[#b42318]' : 'text-slate-600'}`}
          >
            Capacidad usada: {displayPercentage}%
          </p>
        </div>


        <div className="relative flex h-24 w-24 shrink-0 items-center justify-center self-start">
          <svg viewBox="0 0 140 140" className="h-24 w-24 -rotate-90">
            <circle
              cx="70"
              cy="70"
              r="58"
              stroke="#edf1fa"
              strokeWidth="12"
              fill="none"
            />
            <circle
              cx="70"
              cy="70"
              r="58"
              stroke={accentColor}
              strokeWidth="12"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div
            className={`absolute flex h-12 w-12 items-center justify-center rounded-full border border-[#eef2ff] bg-white shadow-sm ${accentTextClass}`}
          >
            <Coffee size={16} />
          </div>
        </div>
      </div>
    </section>
  );
}
function TypeSummaryCard({
  lot,
  subloteCount,
  onOpen,
}: {
  lot: LoteResumen;
  subloteCount: number;
  onOpen: () => void;
}) {
  const visual = coffeeVisual(lot.tipoCafe);
  const sublotesLabel = pluralLabel(subloteCount, 'sublote', 'sublotes');
  const isProcess = isSecadoProcessLot(lot);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-[20px] border border-[#e5e8f2] bg-white p-4 text-left shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] ${visual.bg} ${visual.text}`}
          >
            {visual.icon}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[1.45rem] font-semibold leading-tight text-slate-900">
              {displayCoffeeName(lot.tipoCafe)}
            </p>
            <p className="mt-0.5 text-sm text-slate-500">
              {formatNumber(lot.pesoActual)} kg ·{' '}
              {formatShortSacks(lot.pesoActual)} bultos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-[12px] px-4 py-2 text-sm font-semibold ${
              isProcess
                ? 'bg-[#fff2cc] text-[#946200]'
                : 'bg-[#f2f3f7] text-slate-700'
            }`}
          >
            {isProcess ? 'Ver secado' : sublotesLabel}
          </span>
          <ArrowRight size={18} className="text-slate-400" />
        </div>
      </div>
    </button>
  );
}

function QualityLotCard({
  lot,
  onOpen,
}: {
  lot: LoteResumen;
  onOpen: () => void;
}) {
  const lotDays = getLotDays(lot).max;
  const sublotesLabel = pluralLabel(lot.sublotes, 'sublote', 'sublotes');
  const humidity = classifyHumidity(lot.humedadPromedio);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-[18px] border border-[#e8ebf4] bg-white p-4 text-left shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[1.05rem] font-semibold text-slate-900">
            {isSecadoProcessLot(lot)
              ? 'En proceso de secado'
              : 'Sublotes disponibles'}
          </p>
          <p className="mt-0.5 text-sm text-slate-500">
            {formatNumber(lot.pesoActual)} kg
          </p>
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            {lotDays} días
          </p>
          {lot.humedadPromedio !== null ? (
            <p
              className={`mt-2 inline-flex rounded-[10px] px-2 py-1 text-[0.68rem] font-black ${humidity.toneClass}`}
            >
              {formatHumidityWithClassification(lot.humedadPromedio)}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-[12px] bg-[#f2f3f7] px-3 py-2 text-xs font-semibold text-slate-700">
            {sublotesLabel}
          </span>
          <ArrowRight size={18} className="text-slate-400" />
        </div>
      </div>
    </button>
  );
}

function SecadoProcessCard({
  session,
  onOpen,
}: {
  session: ReturnType<typeof getActiveSecadoSessions>[number];
  onOpen: () => void;
}) {
  const totalKg = session.sublotes.reduce(
    (sum, sublote) => sum + sublote.pesoActual,
    0,
  );
  const progress = secadoProgress(session.estado);
  const progressWidthClass = `w-[${progress}%]`;

  const startedAt = new Date(session.startedAt);
  const fecha = Number.isNaN(startedAt.getTime())
    ? 'Hoy'
    : startedAt.toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-[18px] border border-amber-200 bg-[#fff8e7] p-4 text-left shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-amber-700">
            {secadoStatusLabel(session.estado)}
          </p>
          <p className="mt-1 truncate text-[1.05rem] font-black text-slate-900">
            {session.tipoCafe} - {session.calidad}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {formatNumber(totalKg)} kg - desde {fecha}
          </p>
        </div>
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-amber-700">
          <CircleDashed size={17} />
        </span>
      </div>

      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white">
        <div
          className="h-full rounded-full bg-[#f6b81a] transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[0.58rem] font-black uppercase tracking-[0.08em] text-amber-800/70">
        <span>Inicio</span>
        <span>{progress}%</span>
        <span>Resultado</span>
      </div>
    </button>
  );
}

export default function Inventario() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state ?? null) as {
    preferredTypeKey?: string;
    activeSecadoId?: string;
    completedSecadoId?: string;
  } | null;

  const [lots, setLots] = useState<LoteResumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<InventarioError | null>(null);
  const [typeKey, setTypeKey] = useState('');
  const [qualityFilterKey, setQualityFilterKey] = useState('');
  const [sortKey, setSortKey] = useState<'OLDEST' | 'NEWEST'>('OLDEST');
  const [preferredApplied, setPreferredApplied] = useState(false);
  const [bodegaConfig, setBodegaConfig] = useState<{
    nombreBodega: string;
    capacidadKg: number | null;
  }>({
    nombreBodega: 'Bodega principal',
    capacidadKg: null,
  });
  const [showBodegaEditor, setShowBodegaEditor] = useState(false);
  const [bodegaNameDraft, setBodegaNameDraft] = useState('Bodega principal');
  const [bodegaCapacityDraft, setBodegaCapacityDraft] = useState('');
  const [bodegaEditorError, setBodegaEditorError] = useState<string | null>(null);
  const [bodegaLimitNotice, setBodegaLimitNotice] = useState<string | null>(null);

  const openBodegaEditor = () => {
    setBodegaNameDraft(bodegaConfig.nombreBodega || 'Bodega principal');
    setBodegaCapacityDraft(bodegaConfig.capacidadKg ? String(bodegaConfig.capacidadKg) : '');
    setBodegaEditorError(null);
    setShowBodegaEditor(true);
  };

  const saveBodegaEditor = async () => {
    const capacidad = Number(bodegaCapacityDraft);
    if (!bodegaNameDraft.trim()) {
      setBodegaEditorError('Escribe un nombre para la bodega.');
      return;
    }
    if (!Number.isFinite(capacidad) || capacidad <= 0) {
      setBodegaEditorError('Ingresa un valor válido para continuar.');
      return;
    }
    if (capacidad > BODEGA_CAPACITY_MAX_KG) {
      setBodegaEditorError('La capacidad no puede superar 100.000 kg.');
      return;
    }
    const saved = await guardarConfiguracionBodega({
      nombreBodega: bodegaNameDraft.trim(),
      capacidadKg: capacidad,
    });
    setBodegaConfig({
      nombreBodega: saved.nombreBodega,
      capacidadKg: saved.capacidadKg,
    });
    setShowBodegaEditor(false);
  };

  const loadLots = async () => {
    setLoading(true);
    setError(null);

    try {
      const [data, config] = await Promise.all([
        obtenerLotes(),
        obtenerConfiguracionBodega(),
      ]);

      setLots(ENABLE_SECADO_PROTOTYPE ? applySecadoToLots(data) : data);
      setBodegaConfig({
        nombreBodega: config.nombreBodega,
        capacidadKg: config.capacidadKg,
      });
    } catch (err) {
      setError(traducirErrorInventario(err));
      setLots([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLots();
  }, []);

  const availableTypes = useMemo(() => {
    const map = new Map<string, { key: string; name: string }>();

    for (const lot of lots) {
      const key = keyOf(lot.tipoCafe);
      if (!map.has(key)) {
        map.set(key, { key, name: lot.tipoCafe });
      }
    }

    return [...map.values()].sort((a, b) => {
      const indexA = TYPE_ORDER.indexOf(a.key as (typeof TYPE_ORDER)[number]);
      const indexB = TYPE_ORDER.indexOf(b.key as (typeof TYPE_ORDER)[number]);

      if (indexA !== -1 || indexB !== -1) {
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      }

      return a.name.localeCompare(b.name, 'es');
    });
  }, [lots]);

  useEffect(() => {
    if (availableTypes.length === 0) {
      if (typeKey !== '') setTypeKey('');
      return;
    }

    const preferred = keyOf(locationState?.preferredTypeKey ?? '');

    if (
      !preferredApplied &&
      preferred &&
      availableTypes.some((type) => type.key === preferred)
    ) {
      setTypeKey(preferred);
      setPreferredApplied(true);
      return;
    }

    if (
      typeKey !== '' &&
      !availableTypes.some((type) => type.key === typeKey)
    ) {
      setTypeKey('');
    }
  }, [
    availableTypes,
    locationState?.preferredTypeKey,
    preferredApplied,
    typeKey,
  ]);

  useEffect(() => {
    if (typeKey !== 'VERDE' && qualityFilterKey) {
      setQualityFilterKey('');
    }
  }, [qualityFilterKey, typeKey]);

  const filteredLots = useMemo(() => {
    if (!typeKey) return [];
    return lots.filter(
      (lot) =>
        keyOf(lot.tipoCafe) === typeKey &&
        (!qualityFilterKey || keyOf(lot.calidad) === qualityFilterKey),
    );
  }, [lots, qualityFilterKey, typeKey]);

  const visibleLots = useMemo(
    () => (typeKey ? filteredLots : lots),
    [filteredLots, lots, typeKey],
  );
  const coffeeFilterValue = useMemo(() => {
    if (!typeKey) return 'TODOS';
    if (typeKey === 'VERDE' && qualityFilterKey === 'BUENO') return 'VERDE_BUENO';
    if (typeKey === 'VERDE' && qualityFilterKey === 'REGULAR') return 'VERDE_REGULAR';
    if (typeKey === 'SECO') return 'SECO';
    return typeKey;
  }, [qualityFilterKey, typeKey]);

  const handleCoffeeFilterChange = (value: string) => {
    if (value === 'EN_SECADO') {
      navigate('/inventario/secados');
      return;
    }

    if (value === 'VERDE_BUENO') {
      setTypeKey('VERDE');
      setQualityFilterKey('BUENO');
      return;
    }

    if (value === 'VERDE_REGULAR') {
      setTypeKey('VERDE');
      setQualityFilterKey('REGULAR');
      return;
    }

    if (value === 'SECO') {
      setTypeKey('SECO');
      setQualityFilterKey('');
      return;
    }

    setTypeKey('');
    setQualityFilterKey('');
  };

  const orderedLots = useMemo(() => {
    const copy = [...visibleLots];
    copy.sort((a, b) => {
      const daysA = getLotDays(a);
      const daysB = getLotDays(b);

      if (sortKey === 'OLDEST') {
        if (daysB.max !== daysA.max) return daysB.max - daysA.max;
        return b.pesoActual - a.pesoActual;
      }

      if (daysA.min !== daysB.min) return daysA.min - daysB.min;
      return a.pesoActual - b.pesoActual;
    });
    return copy;
  }, [visibleLots, sortKey]);

  const typeSummaries = useMemo(() => {
    const grouped = new Map<
      string,
      { key: string; name: string; lots: LoteResumen[] }
    >();

    for (const lot of lots) {
      const key = keyOf(lot.tipoCafe);
      const current = grouped.get(key) ?? {
        key,
        name: lot.tipoCafe,
        lots: [],
      };

      current.lots.push(lot);
      grouped.set(key, current);
    }

    return TYPE_ORDER.flatMap((type) => {
      const current = grouped.get(type);
      if (!current) return [];
      const totalKg = current.lots.reduce(
        (sum, lot) => sum + lot.pesoActual,
        0,
      );
      return [
        {
          key: current.key,
          name: current.name,
          totalKg,
          lots: current.lots,
        },
      ];
    });
  }, [lots]);

  const qualitySections = useMemo(
    () =>
      QUALITY_SECTIONS.map((section) => ({
        ...section,
        lots: orderedLots.filter((lot) => keyOf(lot.calidad) === section.key),
      })),
    [orderedLots],
  );

  const totalKg = useMemo(
    () => lots.reduce((sum, lot) => sum + lot.pesoActual, 0),
    [lots],
  );
  const capacityAlert = useMemo(() => {
    const capacityKg = bodegaConfig.capacidadKg;
    if (!capacityKg || capacityKg <= 0) return null;

    const percentage = (totalKg / capacityKg) * 100;
    if (percentage >= 100) {
      return {
        title: 'La bodega alcanzó su límite.',
        text: 'Libera espacio antes de comprar más café.',
        className: 'border-rose-200 bg-rose-50 text-rose-900',
        primary: 'Ir a ventas',
        secondary: 'Editar bodega',
        secondaryPath: '/ajustes',
      };
    }
    if (percentage >= 90) {
      return {
        title: 'La bodega está casi llena.',
        text: 'Libera espacio antes de comprar más café.',
        className: 'border-amber-200 bg-amber-50 text-amber-950',
        primary: 'Ir a ventas',
        secondary: 'Editar bodega',
        secondaryPath: '/ajustes',
      };
    }
    if (percentage >= 80) {
      return {
        title: 'La bodega se está llenando.',
        text: 'Libera espacio antes de comprar más café.',
        className: 'border-yellow-300 bg-yellow-50 text-yellow-950',
        primary: 'Ir a ventas',
        secondary: 'Editar bodega',
        secondaryPath: '/ajustes',
      };
    }
    return null;
  }, [bodegaConfig.capacidadKg, totalKg]);
  const activeSecadoSessions = useMemo(
    () =>
      ENABLE_SECADO_PROTOTYPE
        ? [...getActiveSecadoSessions()].sort(
            (a, b) =>
              new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
          )
        : [],
    [lots],
  );
  const activeSessionBase = ENABLE_SECADO_PROTOTYPE
    ? getActiveSecadoSession()
    : null;
  const activeSession =
    activeSessionBase && lots.some((lot) => lot.id === activeSessionBase.loteId)
      ? activeSessionBase
      : null;
  const secadoTarget =
    ENABLE_SECADO_PROTOTYPE && typeKey === 'VERDE' && orderedLots.length > 0
      ? orderedLots[0]
      : null;
  const showGlobalEmptyState = !loading && !error && lots.length === 0;

  return (
    <div
      className={`min-h-screen bg-[linear-gradient(180deg,#f7f5ff_0%,#f3f3fb_100%)] text-slate-900 ${
        showGlobalEmptyState ? 'pb-[112px]' : 'pb-[150px]'
      }`}
    >
      <main
        className={`mx-auto flex w-full max-w-[430px] px-4 py-6 ${
          showGlobalEmptyState
            ? 'max-w-none min-h-[calc(100vh-112px)] px-0 py-0 items-center justify-center'
            : 'flex-col gap-5'
        }`}
      >
        {!showGlobalEmptyState ? (
          <CapacityRing
            totalKg={totalKg}
            capacityKg={bodegaConfig.capacidadKg}
          />
        ) : null}

        {!showGlobalEmptyState && capacityAlert ? (
          <section className={`rounded-[18px] border px-4 py-3 shadow-sm ${capacityAlert.className}`}>
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/75">
                <BadgeAlert size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[0.92rem] font-black">{capacityAlert.title}</p>
                <p className="mt-1 text-[0.76rem] font-bold leading-5">
                  {capacityAlert.text}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => navigate('/ventas')}
                    className="inline-flex min-h-[34px] items-center rounded-full bg-[#102d92] px-3 text-[0.72rem] font-black text-white"
                  >
                    {capacityAlert.primary}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      capacityAlert.secondary === 'Editar bodega'
                        ? openBodegaEditor()
                        : navigate(capacityAlert.secondaryPath)
                    }
                    className="inline-flex min-h-[34px] items-center rounded-full bg-white px-3 text-[0.72rem] font-black text-[#173a8a] shadow-sm"
                  >
                    {capacityAlert.secondary}
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {!showGlobalEmptyState ? (
          <section className="rounded-[18px] border border-[#e3e8f2] bg-white p-3 shadow-sm">
            <div className="grid grid-cols-2 gap-2">
              <label className="min-w-0">
                <span className="mb-1 block text-[0.64rem] font-black uppercase tracking-[0.08em] text-slate-500">
                  Filtro
                </span>
                <select
                  aria-label="Filtro"
                  value={sortKey}
                  onChange={(event) =>
                    setSortKey(event.target.value as 'OLDEST' | 'NEWEST')
                  }
                  className="h-10 w-full rounded-[14px] border border-[#dfe5f2] bg-[#f5f6fb] px-3 text-xs font-black text-slate-800 outline-none focus:border-[#102d92]"
                >
                  <option value="NEWEST">Más reciente</option>
                  <option value="OLDEST">Más antiguo</option>
                </select>
              </label>
              <label className="min-w-0">
                <span className="mb-1 block text-[0.64rem] font-black uppercase tracking-[0.08em] text-slate-500">
                  Tipo de café
                </span>
                <select
                  aria-label="Tipo de café"
                  value={coffeeFilterValue}
                  onChange={(event) => handleCoffeeFilterChange(event.target.value)}
                  className="h-10 w-full rounded-[14px] border border-[#dfe5f2] bg-[#f5f6fb] px-3 text-xs font-black text-slate-800 outline-none focus:border-[#102d92]"
                >
                  <option value="TODOS">Todos</option>
                  <option value="VERDE_BUENO">Verde Bueno</option>
                  <option value="VERDE_REGULAR">Verde Regular</option>
                  <option value="EN_SECADO">En secado</option>
                  <option value="SECO">Secado terminado</option>
                </select>
              </label>
            </div>
          </section>
        ) : null}

        {showGlobalEmptyState ? (
          <section className="relative min-h-[calc(100vh-112px)] w-full overflow-hidden bg-[radial-gradient(circle_at_50%_14%,rgba(47,128,237,0.13),transparent_30%),linear-gradient(180deg,#ffffff_0%,#f8fbff_52%,#edf6ff_100%)] px-5 pb-28 pt-8 text-center text-[#07153b]">
            <EmptyInventoryAnimations />
            <div className="pointer-events-none absolute left-6 top-10 h-20 w-20 rounded-full bg-[#e6f3ff]/70 blur-2xl" />
            <div className="pointer-events-none absolute right-0 top-28 h-28 w-28 rounded-full bg-[#dbeeff]/70 blur-3xl" />
            <div className="relative z-10 mx-auto flex min-h-[calc(100vh-14rem)] w-full max-w-[390px] flex-col items-center justify-center">
              <div className="animate-[inventoryEmptyFadeUp_320ms_ease-out_both]">
                <EmptyInventoryIllustration />
              </div>

              <div className="mt-2 animate-[inventoryEmptyFadeUp_340ms_ease-out_80ms_both]">
                <p className="mx-auto mb-3 inline-flex min-h-[34px] items-center rounded-full border border-[#d9ebff] bg-white/70 px-4 text-[0.72rem] font-black uppercase tracking-[0.12em] text-[#4d8ee9] shadow-[0_12px_28px_rgba(37,99,235,0.08)] backdrop-blur">
                  Primer paso
                </p>
                <h2 className="mx-auto max-w-[330px] text-[1.85rem] font-black leading-[1.08] text-[#07153b]">
                  Aún no hay café en inventario
                </h2>
                <p className="mx-auto mt-4 max-w-[315px] text-[0.98rem] font-semibold leading-6 text-slate-500">
                  Comienza registrando tu primera compra para organizar tu
                  inventario y ver crecer tu negocio.
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate('/compras')}
                className="mt-7 inline-flex min-h-[56px] w-full max-w-[318px] items-center justify-center gap-2 rounded-[18px] bg-[#2f80ed] px-6 text-[1rem] font-black text-white shadow-[0_18px_34px_rgba(47,128,237,0.28),0_0_0_6px_rgba(47,128,237,0.08)] transition duration-300 hover:-translate-y-0.5 hover:bg-[#1f6fe0] hover:shadow-[0_22px_42px_rgba(47,128,237,0.34),0_0_0_8px_rgba(47,128,237,0.1)] active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#93c5fd] animate-[inventoryEmptyFadeUp_340ms_ease-out_160ms_both]"
              >
                <ShoppingCart size={19} strokeWidth={2.4} />
                Registrar compra
                <ArrowRight size={18} strokeWidth={2.4} />
              </button>
            </div>
            <EmptyInventoryWaves />
          </section>
        ) : null}

        {typeKey === '' && !showGlobalEmptyState ? (
          <section className="space-y-3">
            <div className="grid gap-3">
              {typeSummaries.map((group) => (
                <TypeSummaryCard
                  key={group.key}
                  lot={{
                    ...group.lots[0],
                    tipoCafe: group.name,
                    pesoActual: group.totalKg,
                  }}
                  subloteCount={group.lots.reduce(
                    (sum, lot) => sum + lot.sublotes,
                    0,
                  )}
                  onOpen={() => {
                    if (group.key === 'EN SECADO') {
                      navigate('/inventario/secados');
                      return;
                    }

                    setTypeKey(group.key);
                    setQualityFilterKey('');
                  }}
                />
              ))}
            </div>
          </section>
        ) : null}

        {typeKey === 'VERDE' && (activeSession || secadoTarget) ? (
          <section className="rounded-[20px] border border-[#e6eaf3] bg-white p-4 shadow-sm">
            <div className="mb-3">
              <h2 className="text-base font-black text-[#102d92]">
                Proceso de secado
              </h2>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                Revisa secados activos o inicia un nuevo proceso.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate('/inventario/secados')}
                disabled={!activeSession}
                className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-[8px] border border-[#1e3a8a] bg-white px-3 text-center text-[0.78rem] font-black text-[#1e3a8a] transition hover:bg-[#f3f4f6] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CircleDashed size={15} />
                Ver secados activos
              </button>
              <button
                type="button"
                onClick={() =>
                  secadoTarget &&
                  navigate(
                    `/inventario/${secadoTarget.tipoCafeId}/${secadoTarget.calidadId}/secado`,
                  )
                }
                disabled={!secadoTarget}
                className="inline-flex h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-[8px] bg-[#102d92] px-3 text-center text-[0.78rem] font-black text-white shadow-[0_12px_24px_rgba(16,45,146,0.16)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <SunMedium size={16} />
                Iniciar secado
              </button>
            </div>
          </section>
        ) : null}

        {typeKey === 'EN SECADO' && !showGlobalEmptyState ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#f6b81a]" />
                <p className="text-sm font-black uppercase tracking-[0.2em] text-[#1d2436]">
                  Procesos de secado
                </p>
              </div>
              <p className="text-sm font-semibold text-slate-500">
                {activeSecadoSessions.length} activo
                {activeSecadoSessions.length === 1 ? '' : 's'}
              </p>
            </div>

            {activeSecadoSessions.map((session) => (
              <SecadoProcessCard
                key={session.id}
                session={session}
                onOpen={() =>
                  navigate(
                    `/inventario/secado/${session.id}/finalizar?step=finish`,
                  )
                }
              />
            ))}
          </section>
        ) : null}

        {ENABLE_SECADO_PROTOTYPE && locationState?.completedSecadoId ? (
          <section className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-700">
            El secado se envió al inventario y ya se refleja como sublote de
            café seco.
          </section>
        ) : null}

        {error ? (
          <section className="rounded-[22px] border border-[#dfe5f2] bg-white px-5 py-5 text-sm text-slate-700 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#eef3ff] text-[#102d92]">
                <WifiOff size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[1rem] font-black text-slate-900">
                  {error.titulo}
                </p>
                <p className="mt-1 text-[0.9rem] font-semibold leading-5 text-slate-600">
                  {error.mensaje}
                </p>
                <p className="mt-1 text-[0.82rem] leading-5 text-slate-500">
                  {error.detalle}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadLots()}
              className="mt-4 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#102d92] px-4 text-[0.92rem] font-black text-white shadow-[0_12px_24px_rgba(16,45,146,0.18)]"
            >
              <RefreshCcw size={16} />
              Reintentar
            </button>
          </section>
        ) : null}

        {loading ? (
          <section className="rounded-[26px] border border-[#dde4f1] bg-white px-5 py-12 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-500">
              Cargando inventario...
            </p>
          </section>
        ) : null}

        {!loading && !error && typeKey !== '' && visibleLots.length === 0 ? (
          <section className="rounded-[26px] border border-dashed border-[#d8dceb] bg-white px-6 py-12 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f6fc] text-slate-400">
              <Package2 size={22} />
            </div>
            <p className="mt-4 text-lg text-slate-600">
              Todavia no hay sublotes registrados en este tipo de cafe.
            </p>
          </section>
        ) : null}

        {!loading &&
        !error &&
        typeKey !== '' &&
        typeKey !== 'EN SECADO' &&
        orderedLots.length > 0 ? (
          <section className="space-y-4">
            {qualitySections
              .filter((section) => section.lots.length > 0)
              .map((section) => (
                <section key={section.key} className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${section.dot}`}
                      />
                      <p className="text-sm font-black uppercase tracking-[0.2em] text-[#1d2436]">
                        {section.title}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-500">
                      {pluralLabel(
                        section.lots.reduce(
                          (sum, lot) => sum + lot.sublotes,
                          0,
                        ),
                        'sublote',
                        'sublotes',
                      )}
                    </p>
                  </div>

                  <div className="space-y-3">
                    {section.lots.map((lot) => (
                      <QualityLotCard
                        key={lot.id}
                        lot={lot}
                        onOpen={() => {
                          if (isSecadoProcessLot(lot)) {
                            navigate('/inventario/secados');
                            return;
                          }

                          navigate(
                            `/inventario/${lot.tipoCafeId}/${lot.calidadId}/sublotes`,
                          );
                        }}
                      />
                    ))}
                  </div>
                </section>
              ))}
          </section>
        ) : null}
      </main>

      {showBodegaEditor ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0f172a]/45 px-5 py-6 backdrop-blur-sm">
          <section className="w-full max-w-[390px] rounded-[22px] bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.24)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-slate-950">
                Editar capacidad de bodega
              </h2>
              <button
                type="button"
                onClick={() => setShowBodegaEditor(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f7fb] text-slate-500"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            {bodegaLimitNotice ? (
              <div className="mt-3 rounded-[14px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800">
                {bodegaLimitNotice}
              </div>
            ) : null}
            <label className="mt-4 block text-xs font-black text-slate-700">
              Nombre de bodega
            </label>
            <input
              type="text"
              value={bodegaNameDraft}
              maxLength={BODEGA_NAME_MAX_LENGTH}
              onChange={(event) => {
                if (event.target.value.length >= BODEGA_NAME_MAX_LENGTH) {
                  setBodegaLimitNotice('Llegaste al máximo permitido.');
                  window.setTimeout(() => setBodegaLimitNotice(null), 1800);
                }
                setBodegaNameDraft(
                  sanitizeLimitedText(event.target.value, BODEGA_NAME_MAX_LENGTH),
                );
              }}
              className="mt-2 h-11 w-full rounded-[14px] border border-[#dbe2f0] bg-[#f8faff] px-4 text-sm font-bold outline-none"
            />
            <p className="mt-1 text-right text-xs font-bold text-slate-500">
              {bodegaNameDraft.length}/{BODEGA_NAME_MAX_LENGTH}
            </p>
            <label className="mt-3 block text-xs font-black text-slate-700">
              Capacidad máxima kg
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={bodegaCapacityDraft}
              onChange={(event) =>
                setBodegaCapacityDraft(
                  sanitizePositiveIntegerInput(event.target.value, BODEGA_CAPACITY_MAX_KG),
                )
              }
              className="mt-2 h-11 w-full rounded-[14px] border border-[#dbe2f0] bg-[#f8faff] px-4 text-sm font-bold outline-none"
              placeholder="100000"
            />
            {bodegaEditorError ? (
              <p className="mt-3 rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700">
                {bodegaEditorError}
              </p>
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void saveBodegaEditor()}
                className="min-h-[42px] rounded-[14px] bg-[#102d92] px-3 text-sm font-black text-white"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setShowBodegaEditor(false)}
                className="min-h-[42px] rounded-[14px] border border-[#d5deee] bg-white px-3 text-sm font-black text-[#334b85]"
              >
                Cancelar
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <AppBottomNav />
    </div>
  );
}
// Legacy helper utilities removed


