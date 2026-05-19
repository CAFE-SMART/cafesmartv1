import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CircleDashed, Package2, X } from 'lucide-react';
import {
  getActiveSecadoSessions,
  removeSecadoSession,
} from '../utils/secadoFlow';

type ActiveSecadoSession = ReturnType<typeof getActiveSecadoSessions>[number];
type SecadoSort = 'recent' | 'oldest';
type SecadoQualityFilter = 'TODOS' | 'BUENO' | 'REGULAR' | 'MALO';

function kg(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value)} kg`;
}

function totalEntrada(session: ActiveSecadoSession) {
  return session.sublotes.reduce((sum, sublote) => sum + sublote.pesoActual, 0);
}

function daysSince(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  const now = new Date();
  const currentDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const targetDay = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
  return Math.max(0, Math.floor((currentDay - targetDay) / 86400000));
}

function startedLabel(value: string) {
  const days = daysSince(value);
  if (days === 0) return 'Iniciado hoy';
  if (days === 1) return 'Iniciado hace 1 dia';
  return `Iniciado hace ${days} dias`;
}

function qualityKey(value: string) {
  return value.trim().toUpperCase();
}

function qualityTone(value: string) {
  const key = qualityKey(value);
  if (key === 'BUENO') return 'bg-emerald-400';
  if (key === 'REGULAR') return 'bg-amber-400';
  return 'bg-rose-500';
}

export default function SecadosActivos() {
  const navigate = useNavigate();
  const location = useLocation();
  const originPath =
    (location.state as { from?: string } | null)?.from === '/ajustes'
      ? '/ajustes'
      : '/inventario';
  const [showAll, setShowAll] = useState(false);
  const [sort, setSort] = useState<SecadoSort>('recent');
  const [qualityFilter, setQualityFilter] =
    useState<SecadoQualityFilter>('TODOS');
  const [interruptionTarget, setInterruptionTarget] =
    useState<ActiveSecadoSession | null>(null);
  const [interruptedVersion, setInterruptedVersion] = useState(0);
  const handleBack = () => {
    navigate('/inventario/secado/inicio', {
      state: {
        from: originPath,
        secadoView: 'start',
      },
    });
  };
  const sessions = useMemo(
    () => {
      const onlyGreen = getActiveSecadoSessions().filter(
        (session) => qualityKey(session.tipoCafe) === 'VERDE',
      );
      const byQuality = qualityFilter !== 'TODOS'
        ? onlyGreen.filter((session) => qualityKey(session.calidad) === qualityFilter)
        : onlyGreen;

      return [...byQuality].sort(
        (a, b) =>
          sort === 'oldest'
            ? new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
            : new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      );
    },
    [interruptedVersion, qualityFilter, sort],
  );
  const visibleSessions = showAll ? sessions : sessions.slice(0, 3);
  const hiddenCount = Math.max(0, sessions.length - visibleSessions.length);

  return (
    <div className="min-h-screen bg-[#f6f6f6] text-slate-950">
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#fbfbfb]">
        <header className="relative flex h-12 items-center justify-center border-b border-slate-100 px-4">
          <button
            type="button"
            onClick={handleBack}
            className="absolute left-4 inline-flex h-8 w-8 items-center justify-center text-[#1f4fd8]"
            aria-label="Volver"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-sm font-extrabold">Secados activos</h1>
        </header>

        <main className="px-4 py-4">
          <section>
            <h2 className="text-[1.05rem] font-black leading-tight">
              Café en proceso de secado
            </h2>
            <p className="mt-2 text-[0.72rem] leading-5 text-slate-500">
              Revisa los procesos iniciados y registra el resultado cuando
              estén listos.
            </p>
          </section>

          <section className="mt-4 rounded-[18px] border border-[#e3e8f2] bg-white p-3 shadow-sm">
            <div className="grid grid-cols-2 gap-2">
              <label className="min-w-0">
                <span className="mb-1 block text-[0.64rem] font-black uppercase tracking-[0.08em] text-slate-500">
                  Filtro
                </span>
                <select
                  value={sort}
                  onChange={(event) => {
                    setSort(event.target.value as SecadoSort);
                    setShowAll(false);
                  }}
                  className="h-10 w-full rounded-[14px] border border-[#dfe5f2] bg-[#f5f6fb] px-3 text-xs font-black text-slate-800 outline-none focus:border-[#102d92]"
                >
                  <option value="recent">Más recientes</option>
                  <option value="oldest">Más antiguos</option>
                </select>
              </label>
              <label className="min-w-0">
                <span className="mb-1 block text-[0.64rem] font-black uppercase tracking-[0.08em] text-slate-500">
                  Tipo de calidad
                </span>
                <select
                  value={qualityFilter}
                  onChange={(event) => {
                    setQualityFilter(event.target.value as SecadoQualityFilter);
                    setShowAll(false);
                  }}
                  className="h-10 w-full rounded-[14px] border border-[#dfe5f2] bg-[#f5f6fb] px-3 text-xs font-black text-slate-800 outline-none focus:border-[#102d92]"
                >
                  <option value="TODOS">Todos</option>
                  <option value="BUENO">Verde Bueno</option>
                  <option value="REGULAR">Verde Regular</option>
                  <option value="MALO">Verde Malo</option>
                </select>
              </label>
            </div>
          </section>

          {sessions.length === 0 ? (
            <section className="mt-5 rounded-[18px] border border-slate-200 bg-white px-5 py-8 text-center shadow-sm">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                <Package2 size={20} />
              </div>
              <p className="mt-4 text-sm font-black text-slate-800">
                No hay secados activos
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Cuando inicies un secado, aparecera aqui para continuar el
                proceso.
              </p>
            </section>
          ) : (
            <section className="mt-5 space-y-3">
              {visibleSessions.map((session) => (
                <article
                  key={session.id}
                  className="rounded-[18px] border border-slate-200 bg-white px-4 py-3.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-slate-500">
                        En seguimiento
                      </p>
                      <div className="mt-1 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[1.05rem] font-black leading-tight text-slate-900">
                            {session.tipoCafe} - {session.calidad}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-[0.7rem] font-black uppercase text-slate-600">
                            <span
                              className={`h-2 w-2 rounded-full ${qualityTone(session.calidad)}`}
                            />
                            {session.sublotes.length} sublote
                            {session.sublotes.length === 1 ? '' : 's'}
                          </p>
                        </div>
                        <p className="shrink-0 text-right text-[0.95rem] font-black text-[#102d92]">
                          {kg(totalEntrada(session))}
                        </p>
                      </div>
                      <p className="mt-1 text-[0.68rem] font-semibold text-slate-500">
                        {startedLabel(session.startedAt)}
                      </p>
                    </div>
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#102d92]">
                      <CircleDashed size={16} />
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setInterruptionTarget(session)}
                      className="inline-flex h-11 items-center justify-center rounded-[14px] border border-slate-200 bg-slate-100 px-3 text-[0.78rem] font-black text-slate-700"
                    >
                      Interrumpir
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/inventario/secado/${session.id}/finalizar?step=finish`,
                          { state: { from: originPath } },
                        )
                      }
                      className="inline-flex h-11 items-center justify-center rounded-[14px] bg-slate-900 px-3 text-[0.78rem] font-black text-white"
                    >
                      Finalizar
                    </button>
                  </div>
                </article>
              ))}
              {hiddenCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="inline-flex h-11 w-full items-center justify-center rounded-[14px] bg-white text-[0.78rem] font-black text-[#102d92] shadow-sm"
                >
                  Ver mas ({hiddenCount})
                </button>
              ) : null}
            </section>
          )}
        </main>
      </div>

      {interruptionTarget ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/55 px-4 pb-4 pt-4 backdrop-blur-sm sm:items-center">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="interrupt-secado-title"
            className="w-full max-w-[390px] rounded-[22px] bg-white p-5 shadow-[0_24px_70px_rgba(15,23,42,0.28)]"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-amber-50 text-amber-700">
                <AlertTriangle size={20} />
              </span>
              <button
                type="button"
                onClick={() => setInterruptionTarget(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500"
                aria-label="Cerrar confirmación"
              >
                <X size={16} />
              </button>
            </div>
            <h2 id="interrupt-secado-title" className="mt-4 text-lg font-black leading-tight text-slate-950">
              ¿Está seguro de que desea interrumpir el proceso de secado?
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              El café regresará a su estado de inventario original.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setInterruptionTarget(null)}
                className="inline-flex min-h-[44px] items-center justify-center rounded-[14px] border border-[#d5deee] bg-white px-4 text-sm font-black text-[#334b85]"
              >
                No
              </button>
              <button
                type="button"
                onClick={() => {
                  removeSecadoSession(interruptionTarget.id);
                  setInterruptionTarget(null);
                  setShowAll(false);
                  setInterruptedVersion((version) => version + 1);
                }}
                className="inline-flex min-h-[44px] items-center justify-center rounded-[14px] bg-[#102d92] px-4 text-sm font-black text-white"
              >
                Sí
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
