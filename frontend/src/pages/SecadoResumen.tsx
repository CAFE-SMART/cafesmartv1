import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CafeSmartErrorState } from '../components/CafeSmartErrorState';
import { InternalLoadingScreen } from '../components/InternalLoadingScreen';
import {
  finalizeSecado,
  getSecadoAvailableKg,
  getSecadoSelectedKg,
  getSecadoSession,
  removeSecadoSession,
  validarIntegridadSesionSecado,
} from '../utils/secadoFlow';
import { getCoffeeCodePrefix } from '../utils/coffeeCodes';
import { transformarSecado } from '../services/secadoService';
import { obtenerDeviceId } from '../utils/deviceId';
import { ApiRequestError } from '../services/apiService';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { createOfflineDraft } from '../services/offlineDraftService';

function kg(value: number) {
  return `${new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value)} kg`;
}

function getSecadoPersistErrorMessage(error: unknown) {
  const fallback = 'No se pudo registrar el secado. Conservamos el proceso para que puedas reintentarlo.';

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

  if (error.message.includes('sesión guardada no es consistente')) {
    return 'No se pudo continuar con este secado. La sesión guardada no es consistente. Inicia el proceso nuevamente.';
  }

  if (error.message.includes('No tienes conexión')) {
    return 'No tienes conexión. El secado quedó guardado en este dispositivo y podrás finalizarlo cuando vuelvas a tener internet.';
  }

  if (error.message.includes('Esta opcion aún no esta disponible')) {
    return 'No pudimos actualizar el inventario del secado. Vuelve a intentarlo.';
  }

  return fallback;
}

function formatOriginCodes(session: NonNullable<ReturnType<typeof getSecadoSession>>) {
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

export default function SecadoResumen() {
  const navigate = useNavigate();
  const { isOffline } = useNetworkStatus();
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
        validarIntegridadSesionSecado(finalized);

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
        const fuentes = finalized.sublotes.map((sublote) => {
          const pesoSeleccionadoKg = getSecadoSelectedKg(sublote);
          const pesoDisponibleKg = getSecadoAvailableKg(sublote);

          if (!pesoSeleccionadoKg || pesoSeleccionadoKg <= 0) {
            throw new Error('El peso seleccionado para secado no es válido.');
          }

          if (pesoSeleccionadoKg > pesoDisponibleKg) {
            throw new Error('El peso seleccionado supera el disponible del sublote.');
          }

          return {
            id: sublote.id,
            pesoKg: pesoSeleccionadoKg,
          };
        });

        if (import.meta.env.DEV) {
          console.info('[secado:persistir]', {
            sessionId: finalized.id,
            fuentes,
            salidas,
          });
        }

        if (isOffline) {
          await createOfflineDraft('SECADO', {
            sessionId: finalized.id,
            deviceId: await obtenerDeviceId(),
            fuentes,
            salidas,
            session: finalized,
            createdAt: new Date().toISOString(),
          });
          throw new Error(
            'No tienes conexión. Guarda este secado como borrador y finalízalo cuando vuelvas a tener internet.',
          );
        }

        await transformarSecado({
          sessionId: finalized.id,
          deviceId: await obtenerDeviceId(),
          fuentes,
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
  }, [isOffline, persistRetry, sessionId]);

  const totalEntrada = useMemo(
    () =>
      session
        ? session.sublotes.reduce(
            (sum, sublote) => sum + getSecadoSelectedKg(sublote),
            0,
          )
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
                ? 'Secado registrado correctamente. El inventario fue actualizado con los pesos transformados.'
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
              <span className="text-slate-500">Origen</span>
              <span className="font-black">{formatOriginCodes(session)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Entrada</span>
              <span className="font-black">{kg(totalEntrada)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Salida seca</span>
              <span className="font-black">{persisted ? kg(totalSalida) : 'Pendiente'}</span>
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
          <InternalLoadingScreen
            variant="drying"
            title="Procesando secado..."
            description="Estamos registrando el resultado del secado."
            warningText="Esto puede tardar unos segundos."
            securityTitle="Tu información está segura"
            securityDescription="El inventario se actualizará al terminar."
          />
        </div>
      ) : null}
    </div>
  );
}
