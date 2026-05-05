import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, FlaskConical, Info, Pencil, RefreshCcw, Scale, Tag } from 'lucide-react';
import { useCloudStatus } from '../context/CloudStatusContext';
import {
  InlineGuidedError,
  type GuidedErrorMessage,
  createGuidedErrorFromUi,
} from '../components/forms/GuidedError';
import { getDaysInBodega } from '../utils/date';
import {
  guardarFactoresSublotes,
  guardarHumedadesSublotes,
  guardarPesosSublotes,
  obtenerDetalleLote,
  type LoteDetalle,
} from '../services/lotesService';
import { applySecadoToDetalle } from '../utils/secadoFlow';
import { createUiMessage, UI_MESSAGES } from '../utils/uiMessages';

type LoteDetalleVisual = LoteDetalle;
type SubloteVisual = LoteDetalleVisual['sublotes'][number];
type EditField = 'humedad' | 'factor' | 'peso';

type PendingHumidityEdit = {
  tipoCafeId: string;
  calidadId: string;
  subloteId: string;
  humedad: number | null;
  updatedAt: number;
};

type PendingFactorEdit = {
  tipoCafeId: string;
  calidadId: string;
  subloteId: string;
  factor: number | null;
  updatedAt: number;
};

const DETAIL_CACHE_KEY = 'cafesmart-sublote-detail-cache-v1';
const PENDING_HUMIDITY_KEY = 'cafesmart-sublote-humedad-queue-v1';
const PENDING_FACTOR_KEY = 'cafesmart-sublote-factor-queue-v1';

function titleCase(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1).toLowerCase()}`;
}

function formatKg(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value)} kg`;
}

function formatPricePerKg(value: number) {
  return `$ ${new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
  }).format(value)}`;
}

function formatDateShort(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const parts = date.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return parts.replace(/\b([a-záéíóúñ])/i, (match) => match.toUpperCase());
}

function formatDays(value: number) {
  return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(value)} días`;
}

function formatHumedad(value: number | null) {
  if (value === null) return 'Sin dato';

  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value)} %`;
}

function formatFactor(value: number | null) {
  if (value === null) return 'Sin dato';

  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function readCachedDetail(tipoCafeId: string, calidadId: string) {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(DETAIL_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Record<string, LoteDetalleVisual>;
    return parsed[`${tipoCafeId}:${calidadId}`] ?? null;
  } catch {
    return null;
  }
}

function writeCachedDetail(tipoCafeId: string, calidadId: string, detail: LoteDetalleVisual) {
  if (typeof window === 'undefined') return;

  try {
    const raw = window.localStorage.getItem(DETAIL_CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, LoteDetalleVisual>) : {};
    parsed[`${tipoCafeId}:${calidadId}`] = detail;
    window.localStorage.setItem(DETAIL_CACHE_KEY, JSON.stringify(parsed));
  } catch {
    // Cache local de respaldo.
  }
}

function readPendingHumidityEdits() {
  if (typeof window === 'undefined') return [] as PendingHumidityEdit[];

  try {
    const raw = window.localStorage.getItem(PENDING_HUMIDITY_KEY);
    if (!raw) return [] as PendingHumidityEdit[];

    const parsed = JSON.parse(raw) as PendingHumidityEdit[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as PendingHumidityEdit[];
  }
}

function writePendingHumidityEdits(edits: PendingHumidityEdit[]) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(PENDING_HUMIDITY_KEY, JSON.stringify(edits));
}

function upsertPendingHumidityEdit(edit: PendingHumidityEdit) {
  const current = readPendingHumidityEdits();
  const next = current.filter(
    (item) =>
      !(
        item.tipoCafeId === edit.tipoCafeId &&
        item.calidadId === edit.calidadId &&
        item.subloteId === edit.subloteId
      ),
  );

  next.push(edit);
  writePendingHumidityEdits(next);
}

function removePendingHumidityEdit(tipoCafeId: string, calidadId: string, subloteId: string) {
  const next = readPendingHumidityEdits().filter(
    (item) =>
      !(
        item.tipoCafeId === tipoCafeId &&
        item.calidadId === calidadId &&
        item.subloteId === subloteId
      ),
  );

  writePendingHumidityEdits(next);
}

function readPendingHumidityForSublote(tipoCafeId: string, calidadId: string, subloteId: string) {
  const pending = readPendingHumidityEdits().find(
    (item) =>
      item.tipoCafeId === tipoCafeId &&
      item.calidadId === calidadId &&
      item.subloteId === subloteId,
  );

  return pending?.humedad ?? null;
}

function readPendingFactorEdits() {
  if (typeof window === 'undefined') return [] as PendingFactorEdit[];

  try {
    const raw = window.localStorage.getItem(PENDING_FACTOR_KEY);
    if (!raw) return [] as PendingFactorEdit[];

    const parsed = JSON.parse(raw) as PendingFactorEdit[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as PendingFactorEdit[];
  }
}

function writePendingFactorEdits(edits: PendingFactorEdit[]) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(PENDING_FACTOR_KEY, JSON.stringify(edits));
}

function upsertPendingFactorEdit(edit: PendingFactorEdit) {
  const current = readPendingFactorEdits();
  const next = current.filter(
    (item) =>
      !(
        item.tipoCafeId === edit.tipoCafeId &&
        item.calidadId === edit.calidadId &&
        item.subloteId === edit.subloteId
      ),
  );

  next.push(edit);
  writePendingFactorEdits(next);
}

function removePendingFactorEdit(tipoCafeId: string, calidadId: string, subloteId: string) {
  const next = readPendingFactorEdits().filter(
    (item) =>
      !(
        item.tipoCafeId === tipoCafeId &&
        item.calidadId === calidadId &&
        item.subloteId === subloteId
      ),
  );

  writePendingFactorEdits(next);
}

function readPendingFactorForSublote(tipoCafeId: string, calidadId: string, subloteId: string) {
  const pending = readPendingFactorEdits().find(
    (item) =>
      item.tipoCafeId === tipoCafeId &&
      item.calidadId === calidadId &&
      item.subloteId === subloteId,
  );

  return pending?.factor ?? null;
}

function getDaysForSublote(sublote: { fechaIngreso: string; diasEnBodega: number }) {
  return Math.max(getDaysInBodega(sublote.fechaIngreso), sublote.diasEnBodega || 0);
}

function getSublotesGuidance(message: string): GuidedErrorMessage {
  if (message.includes('humedad')) {
    return createGuidedErrorFromUi(
      createUiMessage(
        UI_MESSAGES.forms.invalidValue.titulo,
        'La humedad ingresada no es válida.',
        'Escribe un número entre 0 y 100',
      ),
    );
  }

  if (message.includes('factor')) {
    return createGuidedErrorFromUi(
      createUiMessage(
        UI_MESSAGES.forms.invalidValue.titulo,
        'Revisa el valor ingresado.',
        'Corrige el dato',
      ),
    );
  }

  if (message.includes('No se encontró el lote')) {
    return createGuidedErrorFromUi(UI_MESSAGES.inventory.notFound);
  }

  if (message.includes('cargar el detalle')) {
    return createGuidedErrorFromUi(UI_MESSAGES.system.internalError);
  }

  return createGuidedErrorFromUi(
    createUiMessage(
      UI_MESSAGES.system.saveFailed.titulo,
      message || UI_MESSAGES.system.saveFailed.mensaje,
      UI_MESSAGES.system.saveFailed.accion,
    ),
  );
}

export default function Sublotes() {
  const navigate = useNavigate();
  const { tipoCafeId, calidadId } = useParams<{ tipoCafeId: string; calidadId: string }>();
  const { isOnline, refreshHealth } = useCloudStatus();

  const [detalle, setDetalle] = useState<LoteDetalleVisual | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offlineNoticeVisible, setOfflineNoticeVisible] = useState(false);
  const [factorNotice, setFactorNotice] = useState<string | null>(null);
  const [editModal, setEditModal] = useState<{ field: EditField; value: string } | null>(null);

  const subloteActivo = useMemo<SubloteVisual | null>(() => {
    if (!detalle || detalle.sublotes.length === 0) return null;
    return detalle.sublotes[0] ?? null;
  }, [detalle]);

  const cargar = useCallback(async () => {
    if (!tipoCafeId || !calidadId) {
      setError('No se encontró el lote solicitado.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let raw: LoteDetalle | null = null;

      if (isOnline) {
        try {
          raw = await obtenerDetalleLote(tipoCafeId, calidadId);
        } catch {
          raw = null;
        }
      }

      if (!raw) {
        const cached = readCachedDetail(tipoCafeId, calidadId);
        if (cached) {
          setDetalle(cached);
          setOfflineNoticeVisible(!isOnline);
          return;
        }

        throw new Error('No se pudo cargar el detalle del sublote.');
      }

      const visual = applySecadoToDetalle(raw, tipoCafeId, calidadId) as LoteDetalleVisual | null;
      if (!visual) {
        throw new Error('No se pudo cargar el detalle del sublote.');
      }

      const hydrated: LoteDetalleVisual = {
        ...visual,
        sublotes: visual.sublotes.map((sublote) => ({
          ...sublote,
          humedad:
            readPendingHumidityForSublote(tipoCafeId, calidadId, sublote.id) ?? sublote.humedad,
          factor: readPendingFactorForSublote(tipoCafeId, calidadId, sublote.id) ?? sublote.factor,
        })) as LoteDetalleVisual['sublotes'],
      };

      setDetalle(hydrated);
      writeCachedDetail(tipoCafeId, calidadId, hydrated);
      setOfflineNoticeVisible(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el detalle del sublote.');
      setDetalle(null);
    } finally {
      setLoading(false);
    }
  }, [calidadId, isOnline, tipoCafeId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (!isOnline || !detalle || !tipoCafeId || !calidadId) return;

    const pending = readPendingHumidityEdits().filter(
      (item) => item.tipoCafeId === tipoCafeId && item.calidadId === calidadId,
    );

    if (pending.length === 0) return;

    void (async () => {
      try {
        await guardarHumedadesSublotes(
          pending.map((item) => ({ id: item.subloteId, humedad: item.humedad })),
        );

        pending.forEach((item) => removePendingHumidityEdit(item.tipoCafeId, item.calidadId, item.subloteId));
        await cargar();
      } catch {
        // La cola se mantiene para un nuevo intento cuando vuelva a haber conexión.
      }
    })();
  }, [calidadId, cargar, detalle, isOnline, tipoCafeId]);

  useEffect(() => {
    if (!isOnline || !detalle || !tipoCafeId || !calidadId) return;

    const pending = readPendingFactorEdits().filter(
      (item) => item.tipoCafeId === tipoCafeId && item.calidadId === calidadId,
    );

    if (pending.length === 0) return;

    void (async () => {
      try {
        await guardarFactoresSublotes(
          pending.map((item) => ({ id: item.subloteId, factor: item.factor })),
        );

        pending.forEach((item) => removePendingFactorEdit(item.tipoCafeId, item.calidadId, item.subloteId));
        await cargar();
      } catch {
        // La cola se mantiene para un nuevo intento cuando vuelva a haber conexión.
      }
    })();
  }, [calidadId, cargar, detalle, isOnline, tipoCafeId]);

  const handleReload = useCallback(async () => {
    if (!isOnline) {
      setOfflineNoticeVisible(true);
      return;
    }

    setOfflineNoticeVisible(false);
    setRefreshing(true);

    try {
      await Promise.all([cargar(), refreshHealth()]);
    } finally {
      setRefreshing(false);
    }
  }, [cargar, isOnline, refreshHealth]);

  const handleEditHumedad = useCallback(() => {
    if (!subloteActivo) return;

    const currentValue = subloteActivo.humedad === null ? '' : String(subloteActivo.humedad);
    setEditModal({ field: 'humedad', value: currentValue });
  }, [subloteActivo]);

  const handleEditFactor = useCallback(() => {
    if (!subloteActivo) return;

    const currentValue = subloteActivo.factor;
    setEditModal({ field: 'factor', value: currentValue === null ? '' : String(currentValue) });
  }, [subloteActivo]);

  const handleEditPeso = useCallback(() => {
    if (!subloteActivo) return;

    setEditModal({ field: 'peso', value: String(subloteActivo.pesoActual) });
  }, [subloteActivo]);

  const handleConfirmEdit = useCallback(() => {
    if (!editModal || !subloteActivo || !tipoCafeId || !calidadId) return;

    const trimmed = editModal.value.trim();
    const parsed = trimmed === '' ? null : Number(trimmed.replace(',', '.'));

    if (editModal.field === 'humedad') {
      if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0 || parsed > 100)) {
        setError('La humedad no es válida. Debe estar entre 0 y 100.');
        return;
      }

      setError(null);
      setEditModal(null);

      const nextHumedad = parsed === null ? null : Number(parsed.toFixed(1));

      setDetalle((current) => {
        if (!current) return current;

        const nextDetail: LoteDetalleVisual = {
          ...current,
          sublotes: current.sublotes.map((sublote) =>
            sublote.id === subloteActivo.id ? { ...sublote, humedad: nextHumedad } : sublote,
          ) as LoteDetalleVisual['sublotes'],
        };

        writeCachedDetail(tipoCafeId, calidadId, nextDetail);
        return nextDetail;
      });

      if (!isOnline) {
        upsertPendingHumidityEdit({
          tipoCafeId,
          calidadId,
          subloteId: subloteActivo.id,
          humedad: nextHumedad,
          updatedAt: Date.now(),
        });
        setOfflineNoticeVisible(true);
        return;
      }

      void (async () => {
        try {
          await guardarHumedadesSublotes([{ id: subloteActivo.id, humedad: nextHumedad }]);
          removePendingHumidityEdit(tipoCafeId, calidadId, subloteActivo.id);
          await cargar();
        } catch (err) {
          upsertPendingHumidityEdit({
            tipoCafeId,
            calidadId,
            subloteId: subloteActivo.id,
            humedad: nextHumedad,
            updatedAt: Date.now(),
          });
          setError(err instanceof Error ? err.message : 'No se pudo guardar la humedad.');
        }
      })();

      return;
    }

    if (editModal.field === 'peso') {
      if (parsed === null || !Number.isFinite(parsed) || parsed < 0) {
        setError('El peso no es valido. Debe ser un numero mayor o igual a cero.');
        return;
      }

      if (parsed > subloteActivo.pesoInicial) {
        setError('El peso actual no puede superar el peso inicial del sublote.');
        return;
      }

      if (!isOnline) {
        setError('Conectate a internet para ajustar el peso del sublote.');
        setOfflineNoticeVisible(true);
        return;
      }

      setError(null);
      setEditModal(null);

      const nextPeso = Number(parsed.toFixed(2));
      setDetalle((current) => {
        if (!current) return current;

        const nextDetail: LoteDetalleVisual = {
          ...current,
          sublotes: current.sublotes.map((sublote) =>
            sublote.id === subloteActivo.id ? { ...sublote, pesoActual: nextPeso } : sublote,
          ) as LoteDetalleVisual['sublotes'],
        };

        writeCachedDetail(tipoCafeId, calidadId, nextDetail);
        return nextDetail;
      });

      void (async () => {
        try {
          await guardarPesosSublotes([{ id: subloteActivo.id, pesoActual: nextPeso }]);
          await cargar();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'No se pudo guardar el peso.');
          await cargar();
        }
      })();

      return;
    }

    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) {
      setError('El factor no es válido. No puede ser negativo.');
      return;
    }

    setError(null);
    setEditModal(null);

    if (parsed !== null && (parsed < 84 || parsed > 100)) {
      setFactorNotice(
        'Rango recomendado: 84-100. Si confirmas que el dato es correcto según la Federación Nacional de Cafeteros, puedes continuar.',
      );
    }

    const nextFactor = parsed === null ? null : Number(parsed.toFixed(2));

    setDetalle((current) => {
      if (!current) return current;

      const nextDetail: LoteDetalleVisual = {
        ...current,
        sublotes: current.sublotes.map((sublote) =>
          sublote.id === subloteActivo.id ? { ...sublote, factor: nextFactor } : sublote,
        ) as LoteDetalleVisual['sublotes'],
      };

      writeCachedDetail(tipoCafeId, calidadId, nextDetail);
      return nextDetail;
    });

    if (!isOnline) {
      upsertPendingFactorEdit({
        tipoCafeId,
        calidadId,
        subloteId: subloteActivo.id,
        factor: nextFactor,
        updatedAt: Date.now(),
      });
      setOfflineNoticeVisible(true);
      return;
    }

    void (async () => {
      try {
        await guardarFactoresSublotes([{ id: subloteActivo.id, factor: nextFactor }]);
        removePendingFactorEdit(tipoCafeId, calidadId, subloteActivo.id);
        await cargar();
      } catch (err) {
        upsertPendingFactorEdit({
          tipoCafeId,
          calidadId,
          subloteId: subloteActivo.id,
          factor: nextFactor,
          updatedAt: Date.now(),
        });
        setError(err instanceof Error ? err.message : 'No se pudo guardar el factor.');
      }
    })();
  }, [calidadId, cargar, editModal, isOnline, subloteActivo, tipoCafeId]);

  const diasSubloteActivo = useMemo(() => {
    if (!subloteActivo) return 0;
    return getDaysForSublote(subloteActivo);
  }, [subloteActivo]);

  const factorActivo = subloteActivo?.factor ?? null;

  return (
    <div className="min-h-screen bg-[#f4f4f4] text-[#1f1f1f]">
      <header className="sticky top-0 z-20 border-b border-[#e6e6e6] bg-white">
        <div className="mx-auto grid h-[58px] w-full max-w-[390px] grid-cols-[48px_1fr_48px] items-center px-3">
          <button
            type="button"
            onClick={() => navigate('/inventario')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#2b2b2b]"
            aria-label="Volver"
          >
            <ArrowLeft size={22} strokeWidth={2.25} />
          </button>

          <h1 className="text-center text-[18px] font-semibold leading-none tracking-[-0.01em] text-[#1c1c1c]">
            Detalles
          </h1>

          <button
            type="button"
            onClick={() => void handleReload()}
            aria-label="Recargar"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#7f7f7f]"
          >
            <RefreshCcw size={18} className={refreshing ? 'animate-spin' : ''} strokeWidth={2.2} />
          </button>
        </div>
      </header>

      {(offlineNoticeVisible || !isOnline) && (
        <div className="border-b border-[#ececec] bg-white px-4 py-3">
          <div className="mx-auto max-w-[390px] rounded-[14px] border border-[#ececec] bg-[#fafafa] px-4 py-3 text-[12px] leading-5 text-[#707070] whitespace-pre-line">
            Para refrescar los datos necesitas conexión a internet.
            {'\n'}
            Tus cambios están guardados y se sincronizarán automáticamente.
          </div>
        </div>
      )}

      <main className="mx-auto w-full max-w-[390px] px-3 pb-[128px] pt-5">
        {error ? <InlineGuidedError message={getSublotesGuidance(error)} className="mb-4" /> : null}

        {loading && !detalle ? (
          <div className="space-y-4">
            <section className="rounded-[22px] border border-[#dcdcdc] bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
              <div className="h-4 w-44 rounded-full bg-[#f1f1f1]" />
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="space-y-2">
                    <div className="h-3 w-20 rounded-full bg-[#f1f1f1]" />
                    <div className="h-4 w-24 rounded-full bg-[#ececec]" />
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}

        {!loading && subloteActivo ? (
          <div className="space-y-4">
            <section className="rounded-[22px] border border-[#dcdcdc] bg-white px-4 py-4 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-2 text-[#1c1c1c]">
                <span className="inline-flex h-5 w-5 items-center justify-center text-[#9a9a9a]">
                  <Info size={18} strokeWidth={2.4} />
                </span>
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#3a3a3a]">
                  Información básica
                </h2>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-[#f0f0f0] pt-4">
                <InfoField label="Tipo" value={titleCase(subloteActivo.tipoCafe)} />
                <InfoField label="Calidad" value={titleCase(subloteActivo.calidad)} />
                <InfoField label="Peso" value={formatKg(subloteActivo.pesoActual)} />
                <InfoField label="Precio/kg" value={formatPricePerKg(subloteActivo.precioKg)} accent="price" />
                <InfoField label="Fecha de compra" value={formatDateShort(subloteActivo.fechaIngreso)} />
                <InfoField label="Tiempo en bodega" value={formatDays(diasSubloteActivo)} />
              </div>
            </section>

            <section className="rounded-[22px] border border-[#dcdcdc] bg-white px-4 py-4 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-2 text-[#1c1c1c]">
                <span className="inline-flex h-5 w-5 items-center justify-center text-[#9a9a9a]">
                  <FlaskConical size={18} strokeWidth={2.3} />
                </span>
                <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[#3a3a3a]">
                  Datos técnicos
                </h2>
              </div>

              <div className="mt-4 space-y-5 border-t border-[#f0f0f0] pt-4">
                <TechnicalField
                  label="Humedad"
                  value={formatHumedad(subloteActivo.humedad)}
                  onEdit={handleEditHumedad}
                />
                <TechnicalField
                  label="Factor"
                  value={formatFactor(factorActivo)}
                  onEdit={handleEditFactor}
                />
              </div>
            </section>
          </div>
        ) : null}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-[#ededed] bg-white/96 px-3 pb-[16px] pt-3 backdrop-blur-[8px]">
        <div className="mx-auto w-full max-w-[390px] space-y-2.5">
          <button
            type="button"
            onClick={() => navigate('/ventas')}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#2f4aa4] text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(47,74,164,0.18)]"
          >
            <Tag size={18} strokeWidth={2.2} />
            Vender sublote
          </button>

          <button
            type="button"
            onClick={handleEditPeso}
            className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] border border-[#e9e9e9] bg-[#f7f7f7] text-[15px] font-semibold text-[#5a5a5a]"
          >
            <Scale size={18} strokeWidth={2.15} />
            Ajustar peso
          </button>
        </div>
      </footer>

      {editModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0f172a]/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[360px] rounded-[18px] border border-[#ececec] bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.25)]">
            <p className="text-center text-[16px] font-semibold text-[#1f1f1f]">
              {editModal.field === 'humedad'
                ? 'Editar humedad'
                : editModal.field === 'peso'
                  ? 'Ajustar peso'
                  : 'Editar factor'}
            </p>
            <input
              type="number"
              inputMode="decimal"
              step={editModal.field === 'humedad' ? '0.1' : '0.01'}
              min="0"
              max={
                editModal.field === 'humedad'
                  ? '100'
                  : editModal.field === 'peso'
                    ? subloteActivo?.pesoInicial
                    : undefined
              }
              value={editModal.value}
              onChange={(event) =>
                setEditModal((current) =>
                  current ? { ...current, value: event.target.value } : current,
                )
              }
              className="mt-3 w-full rounded-[12px] border border-[#dcdcdc] bg-white px-3 py-2.5 text-[18px] font-semibold text-[#1f1f1f] outline-none focus:border-[#2f4aa4]"
              placeholder={
                editModal.field === 'humedad'
                  ? 'Ej: 12.0'
                  : editModal.field === 'peso'
                    ? 'Ej: 120.5'
                    : 'Ej: 86'
              }
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEditModal(null)}
                className="rounded-[10px] border border-[#e2e2e2] bg-white py-2 text-sm font-semibold text-[#5a5a5a]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmEdit}
                className="rounded-[10px] bg-[#2f4aa4] py-2 text-sm font-semibold text-white"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {factorNotice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[340px] rounded-[18px] border border-amber-200 bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.25)]">
            <div className="mb-2 flex justify-center text-amber-500">
              <AlertTriangle size={22} strokeWidth={2.3} />
            </div>
            <p className="text-center text-[13px] leading-5 text-[#4a4a4a]">{factorNotice}</p>
            <button
              type="button"
              onClick={() => setFactorNotice(null)}
              className="mt-3 w-full rounded-[10px] bg-amber-500 py-2 text-sm font-semibold text-white"
            >
              OK
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InfoField({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'price';
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b1b1b1]">{label}</p>
      <p className={`mt-1 text-[17px] font-semibold leading-[1.15] text-[#232323] ${accent === 'price' ? 'text-[#c4551d]' : ''}`}>
        {value}
      </p>
    </div>
  );
}

function TechnicalField({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#b1b1b1]">{label}</p>
      <div className="mt-2 flex h-[52px] items-center justify-between rounded-[10px] border border-[#e2e2e2] bg-white px-3">
        <p className="text-[28px] font-semibold leading-none tracking-[-0.04em] text-[#222222]">
          <span>{value}</span>
        </p>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Editar ${label.toLowerCase()}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#c2c2c2]"
        >
          <Pencil size={16} strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
