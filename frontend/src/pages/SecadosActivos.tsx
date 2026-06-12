import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Coffee,
  Package2,
  Scale,
} from 'lucide-react';
import { getActiveSecadoSessions } from '../utils/secadoFlow';
import { formatCoffeeLabel, formatDisplayLabel } from '../utils/uiMessages';

type ActiveSecadoSession = ReturnType<typeof getActiveSecadoSessions>[number];

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
  if (days === 1) return 'Iniciado hace 1 día';
  return `Iniciado hace ${days} días`;
}

function qualityKey(value: string) {
  return value.trim().toUpperCase();
}

function qualityTone(value: string) {
  const key = qualityKey(value);
  if (key === 'BUENO') {
    return {
      dot: 'bg-[#0d7b67]',
      rightCircle: 'bg-[#e9fbf4] text-[#0d7b67]',
    };
  }

  if (key === 'REGULAR') {
    return {
      dot: 'bg-[#d29309]',
      rightCircle: 'bg-[#fff7df] text-[#d29309]',
    };
  }

  return {
    dot: 'bg-[#d92d20]',
    rightCircle: 'bg-[#ffe7e4] text-[#d92d20]',
  };
}

export default function SecadosActivos() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = (location.state ?? null) as { from?: string } | null;
  const [showAll, setShowAll] = useState(false);
  const sessions = useMemo(
    () =>
      [...getActiveSecadoSessions()].sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      ),
    [],
  );
  const visibleSessions = showAll ? sessions : sessions.slice(0, 3);
  const hiddenCount = Math.max(0, sessions.length - visibleSessions.length);
  const totalKg = sessions.reduce(
    (sum, session) => sum + totalEntrada(session),
    0,
  );
  const totalSublotes = sessions.reduce(
    (sum, session) => sum + session.sublotes.length,
    0,
  );

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-950">
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#fbfbfb]">
        <header className="sticky top-0 z-20 relative flex h-14 items-center justify-center border-b border-[#e9edf3] bg-white px-4">
          <button
            type="button"
            onClick={() =>
              navigate(
                locationState?.from === 'ajustes' ? '/ajustes' : '/inventario',
                {
                  state:
                    locationState?.from === 'ajustes'
                      ? undefined
                      : { preferredTypeKey: 'VERDE' },
                },
              )
            }
            className="absolute left-4 inline-flex h-10 w-10 items-center justify-center rounded-full text-[#1f4fd8] transition hover:bg-[#f3f6ff] focus:outline-none focus:ring-2 focus:ring-[#9fb0e6]"
            aria-label="Volver"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-[1rem] font-semibold">Secados activos</h1>
        </header>

        <main className="px-4 pb-6 pt-4">
          <section className="overflow-hidden rounded-[20px] border border-[#cfe4ff] bg-white shadow-[0_10px_26px_rgba(15,23,42,0.06)]">
            <div className="h-1.5 bg-[#1D4ED8]" />
            <div className="p-4">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-[#eef3ff] text-[#1D4ED8]">
                  <CircleDashed size={23} />
                </span>
                <div>
                  <h2 className="text-[1.22rem] font-semibold leading-tight text-[#111827]">
                    Café que está en secado
                  </h2>
                  <p className="mt-1.5 text-sm leading-5 text-slate-500">
                    Cuando tu café termine el proceso de secado físico, regresa
                    a esta pantalla para registrar las cantidades finales
                    obtenidas y dar salida al lote.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2.5">
                <div className="rounded-[14px] border border-[#edf1f7] bg-[#fbfcfe] px-3 py-2.5">
                  <p className="text-[0.76rem] font-medium text-slate-500">
                    En proceso
                  </p>
                  <p className="mt-0.5 text-[1.05rem] font-semibold text-[#111827]">
                    {sessions.length}
                  </p>
                </div>
                <div className="rounded-[14px] border border-[#edf1f7] bg-[#fbfcfe] px-3 py-2.5">
                  <p className="text-[0.76rem] font-medium text-slate-500">
                    Sublotes
                  </p>
                  <p className="mt-0.5 text-[1.05rem] font-semibold text-[#111827]">
                    {totalSublotes}
                  </p>
                </div>
                <div className="rounded-[14px] border border-[#edf1f7] bg-[#fbfcfe] px-3 py-2.5">
                  <p className="text-[0.76rem] font-medium text-slate-500">
                    Peso total
                  </p>
                  <p className="mt-0.5 text-[1.05rem] font-semibold text-[#111827]">
                    {kg(totalKg)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {sessions.length === 0 ? (
            <section className="mt-4 rounded-[20px] border border-[#e1e6ef] bg-white px-5 py-8 text-center shadow-[0_8px_22px_rgba(15,23,42,0.04)]">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#f2f4f7] text-slate-500">
                <Package2 size={24} />
              </div>
              <p className="mt-4 text-[1rem] font-semibold text-slate-800">
                No tienes secados pendientes
              </p>
              <p className="mx-auto mt-1 max-w-[300px] text-sm leading-5 text-slate-500">
                Cuando envíes café a secado, aparecerá aquí para que puedas
                finalizarlo sin buscarlo en el inventario.
              </p>
              <button
                type="button"
                onClick={() =>
                  navigate('/inventario', {
                    state: { preferredTypeKey: 'VERDE' },
                  })
                }
                className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-[#1D4ED8] px-4 text-sm font-semibold text-white"
              >
                Iniciar secado
              </button>
            </section>
          ) : (
            <section className="mt-4 space-y-3">
              {visibleSessions.map((session) => {
                const tone = qualityTone(session.calidad);
                return (
                  <article
                    key={session.id}
                    className="rounded-[20px] border border-[#e4e9f2] bg-white px-4 py-4 shadow-[0_8px_22px_rgba(15,23,42,0.05)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#f2f4f7] text-[#475467]">
                          <Coffee size={20} />
                        </span>
                        <div className="min-w-0">
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[0.72rem] font-semibold text-slate-700">
                            En secado
                          </span>
                          <p className="mt-2 truncate text-[1.08rem] font-semibold leading-tight text-[#111827]">
                            {formatCoffeeLabel(session.tipoCafe)} ·{' '}
                            {formatDisplayLabel(session.calidad)}
                          </p>
                          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-slate-600">
                            <span
                              className={`h-2 w-2 rounded-full ${tone.dot}`}
                            />
                            {session.sublotes.length} sublote
                            {session.sublotes.length === 1 ? '' : 's'} en este
                            proceso
                          </p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${tone.rightCircle}`}
                      >
                        <CircleDashed size={17} />
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="rounded-[13px] bg-slate-50 px-3 py-2">
                        <Scale size={14} className="text-slate-400" />
                        <p className="mt-1 text-[0.72rem] text-slate-500">
                          Entrada
                        </p>
                        <p className="text-[0.86rem] font-semibold text-slate-900">
                          {kg(totalEntrada(session))}
                        </p>
                      </div>
                      <div className="rounded-[13px] bg-slate-50 px-3 py-2">
                        <CalendarDays size={14} className="text-slate-400" />
                        <p className="mt-1 text-[0.72rem] text-slate-500">
                          Inicio
                        </p>
                        <p className="text-[0.82rem] font-semibold text-slate-900">
                          {startedLabel(session.startedAt).replace(
                            'Iniciado ',
                            '',
                          )}
                        </p>
                      </div>
                      <div className="rounded-[13px] bg-slate-50 px-3 py-2">
                        <CheckCircle2 size={14} className="text-slate-400" />
                        <p className="mt-1 text-[0.72rem] text-slate-500">
                          Estado
                        </p>
                        <p className="text-[0.82rem] font-semibold text-slate-900">
                          Pendiente
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/inventario/secado/${session.id}/finalizar?step=finish`,
                        )
                      }
                      className="mt-4 inline-flex min-h-[46px] w-full items-center justify-center rounded-full bg-[#1D4ED8] hover:bg-[#1e40af] px-4 text-[0.92rem] font-semibold text-white transition"
                    >
                      Finalizar secado
                    </button>
                  </article>
                );
              })}
              {hiddenCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[14px] border border-[#dbe2f0] bg-white text-sm font-semibold text-[#1D4ED8] shadow-sm"
                >
                  Ver {hiddenCount} más
                </button>
              ) : null}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
