import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardList,
  Droplets,
  RefreshCcw,
  SunMedium,
} from 'lucide-react';
import { AppBottomNav } from '../components/AppBottomNav';
import { CafeSmartErrorState } from '../components/CafeSmartErrorState';
import { EmptyState } from '../components/EmptyState';
import { obtenerLotes, type LoteResumen } from '../services/lotesService';
import {
  applySecadoToLots,
  loadSecadoSessions,
  type SecadoSession,
} from '../utils/secadoFlow';
import { UI_MESSAGES } from '../utils/uiMessages';
import {
  classifyHumidity,
  formatHumidityWithClassification,
} from '../utils/humidity';

type SecadoView = 'start' | 'pending';

function keyOf(value: string) {
  return value.trim().toUpperCase();
}

function formatKg(value: number) {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function totalSecadoKg(session: SecadoSession) {
  return session.sublotes.reduce((sum, sublote) => sum + sublote.pesoActual, 0);
}

function humedadInicial(session: SecadoSession) {
  const conHumedad = session.sublotes.filter(
    (sublote) => sublote.humedad !== null,
  );
  if (conHumedad.length === 0) return null;

  const totalKg = conHumedad.reduce(
    (sum, sublote) => sum + sublote.pesoActual,
    0,
  );
  if (totalKg <= 0) return null;

  const promedio =
    conHumedad.reduce(
      (sum, sublote) => sum + (sublote.humedad as number) * sublote.pesoActual,
      0,
    ) / totalKg;

  return Number(promedio.toFixed(1));
}

function estadoLabel(session: SecadoSession) {
  return session.estado === 'READY'
    ? 'Secado pendiente'
    : 'En proceso de secado';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

export default function SecadoInicio() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as {
    secadoView?: SecadoView;
    from?: string;
  } | null;
  const initialView = locationState?.secadoView;
  const originPath = locationState?.from === '/ajustes' ? '/ajustes' : '/inventario';
  const [view, setView] = useState<SecadoView>(
    initialView === 'pending' ? 'pending' : 'start',
  );
  const [lotes, setLotes] = useState<LoteResumen[]>([]);
  const [pendingSessions, setPendingSessions] = useState<SecadoSession[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarPendientes = () => {
    const pendientes = loadSecadoSessions()
      .filter((session) => session.estado !== 'COMPLETED')
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );

    setPendingSessions(pendientes);
  };

  const cargar = async () => {
    setLoading(true);
    setError(null);
    const sessions = loadSecadoSessions();
    const pendientes = sessions
      .filter((session) => session.estado !== 'COMPLETED')
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    const pendingLotIds = new Set(pendientes.map((session) => session.loteId));
    setPendingSessions(pendientes);

    try {
      const data = await obtenerLotes();
      const lotesVisuales = applySecadoToLots(data);
      const verdesDisponibles = lotesVisuales.filter(
        (lote) =>
          keyOf(lote.tipoCafe) === 'VERDE' &&
          lote.pesoActual > 0 &&
          !pendingLotIds.has(lote.id),
      );
      setLotes(verdesDisponibles);
      setSelectedId((current) =>
        current && verdesDisponibles.some((lote) => lote.id === current)
          ? current
          : (verdesDisponibles[0]?.id ?? null),
      );
    } catch (err) {
      setError('No pudimos cargar el flujo de secado. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargar();
  }, []);

  const loteSeleccionado = useMemo(
    () => lotes.find((lote) => lote.id === selectedId) ?? null,
    [lotes, selectedId],
  );

  const hasPending = pendingSessions.length > 0;
  const activeSession = pendingSessions[0] ?? null;
  const activeHumidity = activeSession ? humedadInicial(activeSession) : null;

  const volver = () => {
    navigate(
      originPath,
      originPath === '/inventario'
        ? { state: { preferredTypeKey: 'VERDE' } }
        : undefined,
    );
  };

  const iniciarSeleccionado = () => {
    if (!loteSeleccionado || hasPending) return;
    navigate(
      `/inventario/${loteSeleccionado.tipoCafeId}/${loteSeleccionado.calidadId}/secado`,
      { state: { from: originPath } },
    );
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] px-4 py-5 pb-[150px] text-slate-900">
      <div className="mx-auto flex w-full max-w-[430px] flex-col gap-4">
        <header className="rounded-[22px] bg-white px-4 py-4 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={volver}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eef2ff] text-[#102d92]"
              aria-label="Volver"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[1.25rem] font-black text-[#111827]">
                {view === 'pending'
                  ? 'Secados pendientes'
                  : 'Proceso de secado'}
              </h1>
              <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">
                {view === 'pending'
                  ? 'Finaliza lotes que ya están en proceso.'
                  : 'Revisa secados activos o inicia un nuevo proceso.'}
              </p>
            </div>
          </div>
        </header>

        {view === 'pending' ? (
          <section className="rounded-[22px] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  Secados pendientes
                </p>
                <h2 className="mt-2 text-[1.2rem] font-black text-[#111827]">
                  Lotes por finalizar
                </h2>
              </div>
              <button
                type="button"
                onClick={cargarPendientes}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#eef2ff] text-[#102d92]"
                aria-label="Actualizar pendientes"
              >
                <RefreshCcw size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {pendingSessions.length > 0 ? (
                pendingSessions.map((session) => (
                  <article
                    key={session.id}
                    className="rounded-[18px] border border-[#e7ebf4] bg-[#fbfcff] p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <span className="inline-flex rounded-xl bg-[#fff7df] p-2 text-[#d29309]">
                        <SunMedium size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-black text-[#111827]">
                          {session.loteCodigo}
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[#9a5b00]">
                          {estadoLabel(session)}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                          <span>{formatKg(totalSecadoKg(session))} kg</span>
                          <span>
                            {session.sublotes.length} sublote
                            {session.sublotes.length === 1 ? '' : 's'}
                          </span>
                          <span>{session.calidad}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/inventario/secado/${session.id}/finalizar`, {
                          state: { from: originPath },
                        })
                      }
                      className="mt-4 inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#102d92] px-4 text-sm font-black text-white"
                    >
                      Finalizar secado
                      <ArrowRight size={16} />
                    </button>
                  </article>
                ))
              ) : (
                <EmptyState
                  icon={ClipboardList}
                  title="No hay secados pendientes"
                  description="Cuando inicies un secado, aparecerá aquí hasta finalizarlo."
                  actionLabel="Iniciar secado"
                  onAction={() => setView('start')}
                />
              )}
            </div>
          </section>
        ) : null}

        {view === 'start' ? (
          <>
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
                onClick={() =>
                  navigate('/inventario/secados', { state: { from: originPath } })
                }
                className="inline-flex h-11 min-w-0 flex-1 items-center justify-center rounded-[8px] border border-[#1e3a8a] bg-white px-3 text-center text-sm font-black text-[#1e3a8a] transition hover:bg-[#f3f4f6] active:scale-[0.99]"
              >
                Ver secados activos
              </button>
              <button
                type="button"
                onClick={iniciarSeleccionado}
                disabled={!loteSeleccionado || hasPending}
                className="inline-flex h-11 min-w-0 flex-1 items-center justify-center rounded-[8px] bg-[#102d92] px-3 text-center text-sm font-black text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Iniciar secado
              </button>
              </div>
            </section>

            {!activeSession ? (
              <>
                {error ? (
                  <CafeSmartErrorState
                    title="No pudimos cargar la información"
                    message="Verifica tu conexión o vuelve a intentarlo."
                    primaryLabel="Reintentar"
                    secondaryLabel="Volver"
                    onPrimary={() => void cargar()}
                    onSecondary={volver}
                    primaryBusy={loading}
                    className="rounded-[20px] px-4 py-5"
                  />
                ) : null}

                <section className="rounded-[22px] bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                        Lotes verdes
                      </p>
                      <h2 className="mt-2 text-[1.2rem] font-black text-[#111827]">
                        Selección de secado
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => void cargar()}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#eef2ff] text-[#102d92]"
                      aria-label="Actualizar lotes"
                    >
                      <RefreshCcw size={16} />
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {loading ? (
                      <div className="space-y-3" role="status" aria-label={UI_MESSAGES.loading.lotsForDrying}>
                        {[0, 1, 2].map((item) => (
                          <div
                            key={item}
                            className="h-[92px] animate-pulse rounded-[18px] bg-[#eef2f7]"
                          />
                        ))}
                      </div>
                    ) : lotes.length > 0 ? (
                      lotes.map((lote) => {
                        const selected = lote.id === selectedId;
                        return (
                          <button
                            key={lote.id}
                            type="button"
                            onClick={() => setSelectedId(lote.id)}
                            className={`flex w-full items-start gap-3 rounded-[18px] border px-4 py-4 text-left shadow-sm ${
                              selected
                                ? 'border-[#2954d8] bg-[#eef2ff]'
                                : 'border-[#e7ebf4] bg-[#fbfcff]'
                            }`}
                          >
                            <span
                              className={`mt-1 inline-flex h-6 w-6 items-center justify-center rounded-full border ${
                                selected
                                  ? 'border-[#2954d8] bg-[#2954d8] text-white'
                                  : 'border-slate-300 bg-white text-transparent'
                              }`}
                            >
                              <Check size={14} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="inline-flex rounded-xl bg-[#ecfdf5] p-2 text-[#0f766e]">
                                  <Droplets size={15} />
                                </span>
                                <p className="text-base font-black text-[#111827]">
                                  {lote.codigo}
                                </p>
                              </div>
                              <p className="mt-2 text-sm text-slate-600">
                                Calidad {lote.calidad}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                                <span>{formatKg(lote.pesoActual)} kg</span>
                                <span>
                                  {lote.sublotes} sublote
                                  {lote.sublotes === 1 ? '' : 's'}
                                </span>
                                <span>
                                  {lote.humedadPromedio === null
                                    ? 'Sin humedad'
                                    : formatHumidityWithClassification(
                                        lote.humedadPromedio,
                                      )}
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <EmptyState
                        icon={Droplets}
                        title="Sin lotes disponibles"
                        description="Todos los lotes verdes ya fueron enviados a secado o no tienen cantidad disponible."
                        actionLabel="Ver secados pendientes"
                        onAction={() => {
                          cargarPendientes();
                          setView('pending');
                        }}
                      />
                    )}
                  </div>
                </section>

                <section className="rounded-[20px] bg-white p-4 shadow-sm">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                    Total seleccionado
                  </p>
                  <p className="mt-2 text-[1.6rem] font-black text-[#102d92]">
                    {loteSeleccionado
                      ? `${formatKg(loteSeleccionado.pesoActual)} kg`
                      : '0 kg'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {loteSeleccionado
                      ? `Continuarás con el lote ${loteSeleccionado.codigo}.`
                      : 'Selecciona un lote para continuar con el secado.'}
                  </p>
                </section>

                <button
                  type="button"
                  onClick={iniciarSeleccionado}
                  disabled={!loteSeleccionado || hasPending}
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[16px] bg-[#2954d8] px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Continuar
                  <ArrowRight size={16} />
                </button>
              </>
            ) : null}
          </>
        ) : null}
      </div>

      <AppBottomNav />
    </div>
  );
}
