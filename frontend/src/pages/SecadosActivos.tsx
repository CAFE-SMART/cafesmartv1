import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CircleDashed, Package2 } from 'lucide-react';
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
  if (key === 'BUENO') return 'bg-emerald-400';
  if (key === 'REGULAR') return 'bg-amber-400';
  return 'bg-rose-500';
}

export default function SecadosActivos() {
  const navigate = useNavigate();
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

  return (
    <div className="min-h-screen bg-[#f6f6f6] text-slate-950">
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#fbfbfb]">
        <header className="relative flex h-12 items-center justify-center border-b border-slate-100 px-4">
          <button
            type="button"
            onClick={() =>
              navigate('/inventario', { state: { preferredTypeKey: 'VERDE' } })
            }
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
              Revisa los procesos que ya empezaron y entra directo a registrar
              el resultado cuando estén listos.
            </p>
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
                Cuando inicies un secado, aparecerá aquí para continuar el
                proceso.
              </p>
            </section>
          ) : (
            <section className="mt-5 space-y-3">
              {visibleSessions.map((session) => (
                <article
                  key={session.id}
                  className="rounded-[18px] border border-[#cdeef1] bg-[#e7fbfd] px-4 py-3.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.66rem] font-black uppercase tracking-[0.14em] text-[#0f6b6d]">
                        En seguimiento
                      </p>
                      <div className="mt-1 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[1.05rem] font-black leading-tight text-[#102d92]">
                            {formatCoffeeLabel(session.tipoCafe)} -{' '}
                            {formatDisplayLabel(session.calidad)}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-[0.7rem] font-black text-slate-700">
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

                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        `/inventario/secado/${session.id}/finalizar?step=finish`,
                      )
                    }
                    className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-[14px] bg-[#102d92] px-4 text-[0.9rem] font-black text-white"
                  >
                    Finalizar secado
                  </button>
                </article>
              ))}
              {hiddenCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="inline-flex h-11 w-full items-center justify-center rounded-[14px] bg-white text-[0.78rem] font-black text-[#102d92] shadow-sm"
                >
                  Ver más ({hiddenCount})
                </button>
              ) : null}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
