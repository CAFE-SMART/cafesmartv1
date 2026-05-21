import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CircleDashed, Package2, X } from 'lucide-react';
import { SmartSelect } from '../components/SmartSelect';
import {
  getActiveSecadoSessions,
  getSecadoSelectedKg,
  removeSecadoSession,
} from '../utils/secadoFlow';
import {
  formatCoffeeFullName,
  getCoffeeCodePrefix,
} from '../utils/coffeeCodes';

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
  return session.sublotes.reduce(
    (sum, sublote) => sum + getSecadoSelectedKg(sublote),
    0,
  );
}

function formatOriginCodes(session: ActiveSecadoSession) {
  const prefix = getCoffeeCodePrefix(session);
  return session.sublotes
    .map((sublote, index) => {
      const code = sublote.codigo || sublote.etiqueta;
      return code && code.toUpperCase().startsWith(`${prefix}-`)
        ? code.toUpperCase()
        : `${prefix}-${String(index + 1).padStart(2, '0')}`;
    })
    .join(', ');
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
    <div className="min-h-screen bg-[#f6f8ff] text-slate-950">
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#fbfdff]">
        <header className="relative flex h-12 items-center justify-center border-b border-[#dbe7ff] px-4">
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

          <section className="mt-4 rounded-[18px] border border-[#dbe7ff] bg-white p-3 shadow-[0_8px_24px_rgba(47,99,216,0.07)]">
            <div className="grid grid-cols-2 gap-2">
              <label className="min-w-0">
                <span className="mb-1 block text-[0.64rem] font-black uppercase tracking-[0.08em] text-slate-500">
                  Filtro
                </span>
                  <SmartSelect
                    value={sort}
                    onChange={(event) => {
                      setSort(event.target.value as SecadoSort);
                      setShowAll(false);
                    }}
                  >
                    <option value="recent">Más recientes</option>
                    <option value="oldest">Más antiguos</option>
                  </SmartSelect>
              </label>
              <label className="min-w-0">
                <span className="mb-1 block text-[0.64rem] font-black uppercase tracking-[0.08em] text-slate-500">
                  Tipo de calidad
                </span>
                  <SmartSelect
                    value={qualityFilter}
                    onChange={(event) => {
                      setQualityFilter(event.target.value as SecadoQualityFilter);
                      setShowAll(false);
                    }}
                  >
                    <option value="TODOS">Todos</option>
                    <option value="BUENO">Verde Bueno</option>
                    <option value="REGULAR">Verde Regular</option>
                    <option value="MALO">Verde Malo</option>
                  </SmartSelect>
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
                  title={`${getCoffeeCodePrefix(session)} · ${formatCoffeeFullName(session)}`}
                  className="rounded-[18px] border border-[#c7d8ff] bg-[linear-gradient(135deg,#f4f8ff_0%,#ffffff_100%)] px-4 py-3.5 shadow-[0_12px_28px_rgba(47,99,216,0.10)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-[#5570a8]">
                        En seguimiento
                      </p>
                      <div className="mt-1 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="inline-flex shrink-0 rounded-[9px] border border-[#c7d8ff] bg-white px-2 py-1 text-[0.68rem] font-black text-[#102d92]">
                              {formatOriginCodes(session)}
                            </span>
                            <p className="truncate text-[1.05rem] font-black leading-tight text-[#0f235c]">
                              {formatCoffeeFullName(session)}
                            </p>
                          </div>
                          <p className="mt-0.5 flex items-center gap-1.5 text-[0.7rem] font-black uppercase text-[#334b85]">
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
                      <p className="mt-1 text-[0.68rem] font-semibold text-[#5570a8]">
                        {startedLabel(session.startedAt)} · Resultado seco pendiente
                      </p>
                    </div>
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eaf2ff] text-[#102d92] shadow-sm">
                      <CircleDashed size={16} />
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setInterruptionTarget(session)}
                      className="inline-flex h-11 items-center justify-center rounded-[14px] border border-[#9bbcff] bg-white px-3 text-[0.78rem] font-black text-[#102d92] transition hover:bg-[#f4f8ff]"
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
                      className="inline-flex h-11 items-center justify-center rounded-[14px] bg-[#102d92] px-3 text-[0.78rem] font-black text-white shadow-[0_12px_24px_rgba(16,45,146,0.22)] transition hover:bg-[#18358f]"
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
