import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, Home, LoaderCircle } from 'lucide-react';
import {
  finalizeSecado,
  getSecadoSession,
  removeSecadoSession,
  type SecadoSubloteSeleccionado,
} from '../utils/secadoFlow';
import {
  crearSecado,
  transformarSecado,
  type TransformarSecadoPayload,
} from '../services/secadoService';
import { obtenerDeviceId } from '../utils/deviceId';
import { ApiRequestError } from '../services/apiService';
import {
  createGuidedError,
  InlineGuidedError,
} from '../components/forms/GuidedError';

function kg(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value)} kg`;
}

function getSecadoPersistErrorMessage(error: unknown) {
  const fallback = 'No se pudo actualizar el inventario real del secado.';

  if (!(error instanceof Error)) {
    return fallback;
  }

  if (error instanceof ApiRequestError) {
    if (error.status === 0) {
      return 'Revisa la conexión a internet y vuelve a intentarlo.';
    }

    if (error.status >= 500) {
      return 'Puede ser una falla temporal. Revisa tu conexión e intenta de nuevo.';
    }
  }

  if (
    error.message.includes('Esta opcion aun no esta disponible') ||
    error.message.includes('Esta opción aún no está disponible')
  ) {
    return 'No se pudo actualizar el inventario del secado. Vuelve a intentarlo.';
  }

  return error.message || fallback;
}

function getSecadoPersistGuidance(message: string) {
  return createGuidedError(
    message,
    'No se pudo actualizar el inventario.',
    'El secado quedó guardado localmente, pero falta sincronizar el cambio real.',
    'Reintenta la actualización.',
  );
}

async function persistirSecadoRemoto(
  payload: TransformarSecadoPayload,
  fuentes: SecadoSubloteSeleccionado[],
): Promise<void> {
  const fuente = fuentes[0];
  const esSubloteCompleto =
    fuentes.length === 1 &&
    fuente &&
    Number.isFinite(fuente.pesoDisponible) &&
    Math.abs((fuente.pesoDisponible ?? 0) - fuente.pesoActual) < 0.01;

  if (
    esSubloteCompleto &&
    payload.fuentes.length === 1 &&
    payload.salidas.length === 1
  ) {
    await crearSecado({
      subloteId: payload.fuentes[0].id,
      pesoSalida: payload.salidas[0].pesoKg,
      calidadSalida: payload.salidas[0].calidad,
    });
    return;
  }

  await transformarSecado(payload);
}

export default function SecadoResumen() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const [session, setSession] = useState(() =>
    sessionId ? getSecadoSession(sessionId) : null,
  );
  const [persisting, setPersisting] = useState(false);
  const [persistError, setPersistError] = useState<string | null>(null);
  const [persisted, setPersisted] = useState(false);
  const [persistRetry, setPersistRetry] = useState(0);
  const persistStartedRef = useRef(false);

  useEffect(() => {
    if (!sessionId || persistStartedRef.current) return;
    persistStartedRef.current = true;

    const persistir = async () => {
      const finalized = finalizeSecado(sessionId);
      setSession(finalized);

      if (!finalized) return;

      setPersisting(true);
      setPersistError(null);

      try {
        const salidas: TransformarSecadoPayload['salidas'] = [
          {
            calidad: 'BUENO',
            pesoKg: finalized.outputBuenoKg,
            humedad: finalized.outputBuenoHumedad,
          },
          {
            calidad: 'REGULAR',
            pesoKg: finalized.outputRegularKg,
            humedad: finalized.outputRegularHumedad,
          },
          {
            calidad: 'MALO',
            pesoKg: finalized.outputMaloKg ?? 0,
            humedad: finalized.outputMaloHumedad ?? null,
          },
        ].filter(
          (salida) => salida.pesoKg > 0,
        ) as TransformarSecadoPayload['salidas'];

        await persistirSecadoRemoto(
          {
            sessionId: finalized.id,
            deviceId: await obtenerDeviceId(),
            fuentes: finalized.sublotes.map((sublote) => ({
              id: sublote.id,
              pesoKg: sublote.pesoActual,
            })),
            salidas,
          },
          finalized.sublotes,
        );

        removeSecadoSession(finalized.id);
        setPersisted(true);
      } catch (error) {
        persistStartedRef.current = false;
        setPersistError(getSecadoPersistErrorMessage(error));
      } finally {
        setPersisting(false);
      }
    };

    void persistir();
  }, [persistRetry, sessionId]);

  const totalEntrada = useMemo(
    () =>
      session
        ? session.sublotes.reduce((sum, sublote) => sum + sublote.pesoActual, 0)
        : 0,
    [session],
  );
  const totalSalida =
    (session?.outputBuenoKg ?? 0) +
    (session?.outputRegularKg ?? 0) +
    (session?.outputMaloKg ?? 0);
  const sublotesOrigen =
    session?.sublotes
      .map((sublote) => sublote.etiqueta)
      .filter((etiqueta) => etiqueta.trim().length > 0) ?? [];
  const origenLabel =
    (session?.sublotes.length ?? 0) === 1
      ? 'Sublote original'
      : 'Sublotes originales';
  const origenValue =
    sublotesOrigen.length > 0
      ? sublotesOrigen.join(', ')
      : (session?.loteCodigo ?? '');

  if (!session) {
    return (
      <div className="min-h-screen bg-[#f6f6f6] px-4 py-6 text-slate-950">
        <div className="mx-auto w-full max-w-[430px] rounded-[20px] bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-bold">No encontre el resumen de secado.</p>
          <button
            type="button"
            onClick={() =>
              navigate('/inventario', { state: { preferredTypeKey: 'VERDE' } })
            }
            className="mt-4 h-11 rounded-full bg-[#1D4ED8] px-5 text-xs font-black text-white"
          >
            Volver a inventario
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f6f6] text-slate-950">
      <main className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col items-center bg-[#fbfbfb] px-4 py-6 text-center">
        <div className="mt-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#dff7ee]">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#12bf84] text-white">
            <Check size={16} strokeWidth={3} />
          </span>
        </div>

        <h1 className="mt-4 text-[1rem] font-black">Secado registrado</h1>
        <p className="mt-1 text-[0.68rem] text-slate-500">
          {persisting
            ? 'Registrando secado en inventario...'
            : persisted
              ? 'Inventario real actualizado.'
              : 'Proceso guardado.'}
        </p>

        {persistError ? (
          <section className="mt-4 w-full text-left">
            <InlineGuidedError
              message={getSecadoPersistGuidance(persistError)}
            />
            <button
              type="button"
              onClick={() => {
                persistStartedRef.current = false;
                setPersistError(null);
                setPersistRetry((current) => current + 1);
              }}
              className="mt-3 w-full rounded-[12px] border border-rose-200 bg-white px-4 py-3 text-xs font-black text-rose-700"
            >
              Reintentar actualización
            </button>
          </section>
        ) : null}

        <section className="mt-5 w-full rounded-[12px] bg-white p-4 text-left shadow-sm">
          <p className="text-[0.85rem] font-semibold text-slate-800">
            Resumen del secado
          </p>
          <div className="mt-4 space-y-3 text-[0.72rem]">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{origenLabel}</span>
              <span className="max-w-[65%] text-right font-black">
                {origenValue}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Sublote original</span>
              <span className="font-black">{session.loteCodigo}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Entrada</span>
              <span className="font-black">{kg(totalEntrada)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Salida seca</span>
              <span className="font-black">{kg(totalSalida)}</span>
            </div>
            <div className="rounded-[10px] bg-slate-50 px-3 py-3">
              <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                <span>Total en inventario seco</span>
                <span className="text-[0.9rem] text-[#1D4ED8]">
                  {kg(totalSalida)}
                </span>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-auto w-full pb-4">
          <button
            type="button"
            disabled={persisting || Boolean(persistError)}
            onClick={() =>
              navigate('/inventario', { state: { preferredTypeKey: 'VERDE' } })
            }
            className="flex h-10 w-full items-center justify-center gap-2 rounded-full bg-[#1D4ED8] text-[0.68rem] font-black text-white disabled:opacity-50"
          >
            {persisting ? (
              <>
                <LoaderCircle size={16} className="animate-spin" />
                Registrando secado...
              </>
            ) : (
              <>
                <Home size={16} />
                Registrar nuevo secado
              </>
            )}
          </button>
          <button
            type="button"
            disabled={persisting}
            onClick={() =>
              navigate('/inventario', {
                state: {
                  preferredTypeKey: 'SECO',
                  completedSecadoId: session.id,
                },
              })
            }
            className="mt-2 h-10 w-full rounded-[8px] bg-slate-100 text-[0.68rem] font-black text-[#1D4ED8] disabled:opacity-50"
          >
            Ir a inventario
          </button>
        </div>
      </main>

      {persisting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/10 px-4">
          <div className="w-full max-w-[300px] rounded-[18px] bg-white px-5 py-4 text-center shadow-[0_18px_42px_rgba(15,23,42,0.22)]">
            <LoaderCircle
              size={28}
              className="mx-auto animate-spin text-[#1D4ED8]"
            />
            <p className="mt-2 text-sm font-black text-slate-900">
              Registrando secado
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Actualizando inventario...
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#dbe4f3]">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-[#1D4ED8]" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
