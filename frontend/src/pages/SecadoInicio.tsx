import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, Droplets, RefreshCcw } from 'lucide-react';
import { AppBottomNav } from '../components/AppBottomNav';
import { CloudStatusBadge } from '../components/CloudStatusBadge';
import { EmptyState } from '../components/EmptyState';
import { obtenerLotes, type LoteResumen } from '../services/lotesService';
import { getActiveSecadoSession } from '../utils/secadoFlow';
import { UI_MESSAGES } from '../utils/uiMessages';

function keyOf(value: string) {
  return value.trim().toUpperCase();
}

function formatKg(value: number) {
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export default function SecadoInicio() {
  const navigate = useNavigate();
  const [lotes, setLotes] = useState<LoteResumen[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await obtenerLotes();
      const verdes = data.filter((lote) => keyOf(lote.tipoCafe) === 'VERDE');
      setLotes(verdes);
      setSelectedId((current) => current ?? verdes[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el flujo de secado.');
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

  const activeSession = getActiveSecadoSession();

  const continuar = () => {
    if (activeSession) {
      navigate(`/inventario/secado/${activeSession.id}/finalizar`);
      return;
    }

    if (!loteSeleccionado) return;

    navigate(`/inventario/lote/${loteSeleccionado.id}/secado`);
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] px-4 py-5 pb-[150px] text-slate-900">
      <div className="mx-auto flex w-full max-w-[520px] flex-col gap-4">
        <header className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/ajustes')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#102d92] shadow-sm"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[1.2rem] font-black text-[#111827]">Iniciar secado</h1>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Selecciona el lote verde que vas a enviar a secado.
            </p>
          </div>
          <CloudStatusBadge compact className="max-w-[140px]" />
        </header>

        {activeSession ? (
          <section className="rounded-[20px] border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <p className="text-sm font-black text-amber-900">Ya tienes un secado en proceso.</p>
            <p className="mt-1 text-sm text-amber-800">
              Continúa ese flujo antes de iniciar uno nuevo.
            </p>
          </section>
        ) : null}

        {error ? (
          <section className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </section>
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
            >
              <RefreshCcw size={16} />
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="rounded-[16px] bg-[#f6f8fd] px-4 py-6 text-sm text-slate-500">
                {UI_MESSAGES.loading.lotsForDrying}
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
                        <p className="text-base font-black text-[#111827]">{lote.codigo}</p>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">Calidad {lote.calidad}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                        <span>{formatKg(lote.pesoActual)} kg</span>
                        <span>{lote.sublotes} sublotes</span>
                        <span>{lote.humedadPromedio === null ? 'Sin humedad' : `${lote.humedadPromedio}% humedad`}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <EmptyState
                icon={Droplets}
                title={UI_MESSAGES.empty.dryLots.titulo}
                description={UI_MESSAGES.empty.dryLots.mensaje}
                actionLabel={UI_MESSAGES.empty.dryLots.accion}
                onAction={() => navigate('/compras')}
              />
            )}
          </div>
        </section>

        <section className="rounded-[20px] bg-white p-4 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
            Total seleccionado
          </p>
          <p className="mt-2 text-[1.6rem] font-black text-[#102d92]">
            {loteSeleccionado ? `${formatKg(loteSeleccionado.pesoActual)} kg` : '0 kg'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {loteSeleccionado
              ? `Continuarás con el lote ${loteSeleccionado.codigo}.`
              : 'Selecciona un lote para continuar con el secado.'}
          </p>
        </section>

        <button
          type="button"
          onClick={continuar}
          disabled={!activeSession && !loteSeleccionado}
          className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[16px] bg-[#2954d8] px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {activeSession ? 'Continuar secado activo' : 'Continuar'}
          <ArrowRight size={16} />
        </button>
      </div>

      <AppBottomNav />
    </div>
  );
}
