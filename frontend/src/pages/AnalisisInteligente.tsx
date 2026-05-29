import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, RefreshCcw, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppBottomNav } from '../components/AppBottomNav';
import { AppFeedbackMessage } from '../components/AppFeedbackMessage';
import {
  buildAiContext,
  type AiBusinessContext,
} from '../services/aiContextService';
import {
  getLatestFinancialAnalysisCache,
  requestFinancialAnalysis,
  saveLatestFinancialAnalysis,
} from '../services/aiService';
import { ApiRequestError } from '../services/apiService';
import granitoInteligente from '../assets/granito-inteligente.png';

type AnalysisState = 'loading' | 'success' | 'error' | 'empty' | 'offline';

function formatGeneratedAt(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function AnalisisInteligente() {
  const navigate = useNavigate();
  const [state, setState] = useState<AnalysisState>('loading');
  const [answer, setAnswer] = useState('');
  const [generatedAt, setGeneratedAt] = useState('');
  const [isReloading, setIsReloading] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState(
    'No pude generar el análisis en este momento. Intenta nuevamente.',
  );

  const loadAnalysis = useCallback(
    async ({ refresh = false }: { refresh?: boolean } = {}) => {
      setUpdateError(null);
      if (refresh) {
        setIsReloading(true);
      } else {
        setState('loading');
      }

      try {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          const cached = await getLatestFinancialAnalysisCache();
          if (cached?.answer) {
            setAnswer(cached.answer);
            setGeneratedAt(cached.generatedAt);
            setState('offline');
            return;
          }

          setAnswer('');
          setGeneratedAt('');
          setState('offline');
          return;
        }

        const builtContext = await buildAiContext();
        if (!builtContext.hasData) {
          setAnswer('');
          setGeneratedAt('');
          setState('empty');
          return;
        }

        const nextAnswer = await requestFinancialAnalysis(builtContext.context);
        const normalizedAnswer = nextAnswer.trim();
        if (!normalizedAnswer) {
          throw new Error('AI_EMPTY_RESPONSE');
        }

        setAnswer(normalizedAnswer);
        const now = new Date().toISOString();
        setGeneratedAt(now);
        await saveLatestFinancialAnalysis(
          normalizedAnswer,
          builtContext.context as AiBusinessContext,
        );
        setState('success');
      } catch (error) {
        const message =
          error instanceof ApiRequestError
            ? error.message
            : 'No pude generar el análisis en este momento. Intenta nuevamente.';
        if (refresh && answer) {
          setUpdateError('No pudimos actualizar el análisis. Intenta nuevamente.');
          return;
        }
        setErrorMessage(message);
        setAnswer('');
        setGeneratedAt('');
        setState('error');
      } finally {
        setIsReloading(false);
      }
    },
    [answer],
  );

  useEffect(() => {
    void loadAnalysis();
  }, [loadAnalysis]);

  const hasCachedOfflineAnswer = state === 'offline' && Boolean(answer);

  return (
    <div className="min-h-screen bg-slate-50 pb-28 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <main className="mx-auto w-full max-w-[430px] px-4 py-5">
        <header className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/resumen-financiero')}
            aria-label="Volver a Resumen financiero"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#102d92] shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700"
          >
            <ArrowLeft size={19} />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-black leading-tight text-slate-950 dark:text-white">
              Análisis inteligente
            </h1>
            <p className="mt-1 text-xs font-bold leading-5 text-slate-500 dark:text-slate-300">
              Revisión de tus resultados, inventario y movimientos recientes
            </p>
          </div>
          <img
            src={granitoInteligente}
            alt=""
            className="ml-auto h-12 w-12 shrink-0 object-contain"
            draggable={false}
          />
        </header>

        <section className="mt-5 rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200">
                <Sparkles size={18} />
              </span>
              <div>
                <p className="text-sm font-black text-slate-950 dark:text-white">
                  Resultado del asistente
                </p>
                {generatedAt ? (
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-300">
                    Generado: {formatGeneratedAt(generatedAt)}
                  </p>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadAnalysis({ refresh: true })}
              disabled={isReloading || state === 'loading'}
              className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-[12px] bg-[#102d92] px-3 text-xs font-black text-white transition hover:bg-[#18358f] disabled:cursor-wait disabled:opacity-65"
            >
              <RefreshCcw size={15} className={isReloading ? 'animate-spin' : ''} />
              {isReloading ? 'Analizando...' : 'Recargar'}
            </button>
          </div>

          {updateError ? (
            <AppFeedbackMessage
              className="mt-4"
              variant="warning"
              description={updateError}
            />
          ) : null}

          {state === 'loading' ? (
            <div className="mt-5 rounded-[16px] bg-slate-50 px-4 py-6 text-center dark:bg-slate-800">
              <p className="text-sm font-black text-slate-900 dark:text-white">
                Analizando tu negocio...
              </p>
              <p className="mt-2 text-xs font-bold leading-5 text-slate-500 dark:text-slate-300">
                Estamos revisando tus resultados, inventario y movimientos recientes.
              </p>
            </div>
          ) : null}

          {state === 'empty' ? (
            <AppFeedbackMessage
              className="mt-5"
              variant="info"
              title="No hay suficiente información"
              description="Registra compras, ventas o inventario para obtener un análisis más útil."
            />
          ) : null}

          {state === 'error' ? (
            <AppFeedbackMessage
              className="mt-5"
              variant="error"
              title="No pude generar el análisis en este momento."
              description={errorMessage}
            />
          ) : null}

          {state === 'offline' && !answer ? (
            <AppFeedbackMessage
              className="mt-5"
              variant="warning"
              title="No hay análisis guardado"
              description="Conéctate a internet para generar tu primer análisis."
            />
          ) : null}

          {hasCachedOfflineAnswer ? (
            <AppFeedbackMessage
              className="mt-5"
              variant="info"
              description="Estás viendo el último análisis guardado en este dispositivo."
            />
          ) : null}

          {answer ? (
            <article className="mt-5 whitespace-pre-line break-words rounded-[16px] bg-emerald-50 px-4 py-4 text-sm font-semibold leading-6 text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-50">
              {answer}
            </article>
          ) : null}
        </section>
      </main>
      <AppBottomNav />
    </div>
  );
}
