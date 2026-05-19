import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CafeSmartErrorState } from '../components/CafeSmartErrorState';
import { CafeSmartProcessingScreen } from '../components/CafeSmartProcessingScreen';
import {
  finalizeSecado,
  getSecadoSession,
  removeSecadoSession,
} from '../utils/secadoFlow';
import { transformarSecado } from '../services/secadoService';
import { obtenerDeviceId } from '../utils/deviceId';
import { ApiRequestError } from '../services/apiService';

function kg(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value)} kg`;
}

function getSecadoPersistErrorMessage(error: unknown) {
  const fallback = 'No pudimos actualizar el inventario del secado.';

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

    if (error.message) {
      return error.message;
    }
  }

  if (error.message.includes('Esta opcion aún no esta disponible')) {
    return 'No pudimos actualizar el inventario del secado. Vuelve a intentarlo.';
  }

  return fallback;
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
        const salidas = [
          {
            calidad: 'BUENO' as const,
            pesoKg: finalized.outputBuenoKg,
            humedad: finalized.outputBuenoHumedad,
          },
          {
            calidad: 'REGULAR' as const,
            pesoKg: finalized.outputRegularKg,
            humedad: finalized.outputRegularHumedad,
          },
          {
            calidad: 'MALO' as const,
            pesoKg: finalized.outputMaloKg ?? 0,
            humedad: finalized.outputMaloHumedad ?? null,
          },
        ].filter((salida) => salida.pesoKg > 0);

        if (import.meta.env.DEV) {
          console.info('[secado:persistir]', {
            sessionId: finalized.id,
            fuentes: finalized.sublotes.map((sublote) => ({
              id: sublote.id,
              pesoKg: sublote.pesoActual,
            })),
            salidas,
          });
        }

        await transformarSecado({
          sessionId: finalized.id,
          deviceId: await obtenerDeviceId(),
          fuentes: finalized.sublotes.map((sublote) => ({
            id: sublote.id,
            pesoKg: sublote.pesoActual,
          })),
          salidas,
        });

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
            className="mt-4 h-11 rounded-full bg-[#0647d6] px-5 text-xs font-black text-white"
          >
            Volver a inventario
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fbff] text-slate-950">
      <CafeSmartErrorState
        fullScreen
        variant={persistError ? 'error' : 'success'}
        title={persistError ? 'No pudimos actualizar el inventario' : 'Secado registrado'}
        message={
          persistError
            ? persistError
            : persisting
              ? 'Procesando secado...'
              : persisted
                ? 'Inventario real actualizado.'
                : 'Proceso guardado.'
        }
        primaryLabel={persistError ? 'Reintentar actualización' : 'Registrar nuevo secado'}
        secondaryLabel="Ir a inventario"
        onPrimary={
          persistError
            ? () => {
                persistStartedRef.current = false;
                setPersistError(null);
                setPersistRetry((current) => current + 1);
              }
            : () =>
                navigate('/inventario', {
                  state: { preferredTypeKey: 'VERDE' },
                })
        }
        onSecondary={() =>
          navigate('/inventario', {
            state: {
              preferredTypeKey: 'SECO',
              completedSecadoId: session.id,
            },
          })
        }
        info={
          persistError
            ? 'El proceso sigue disponible para reintentar la actualización.'
            : 'El resultado del secado quedó listo para continuar en inventario.'
        }
      >
        <section className="rounded-[12px] bg-white p-4 text-left shadow-sm">
          <p className="text-[0.68rem] font-black uppercase tracking-[0.08em] text-slate-500">
            Resumen del secado
          </p>
          <div className="mt-4 space-y-3 text-[0.72rem]">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Lote</span>
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
              <div className="flex items-center justify-between text-xs font-black uppercase">
                <span>Total en inventario seco</span>
                <span className="text-[0.9rem] text-[#0647d6]">
                  {kg(totalSalida)}
                </span>
              </div>
            </div>
          </div>
        </section>
      </CafeSmartErrorState>

      {persisting ? (
        <div className="fixed inset-0 z-50">
          <CafeSmartProcessingScreen
            variant="drying"
            title="Procesando secado..."
            subtitle="Estamos registrando el resultado del secado."
            helperText="Esto puede tardar unos segundos."
            trustTitle="Tu información está segura"
            trustText="El inventario se actualizará al terminar."
          />
        </div>
      ) : null}
    </div>
  );
}
