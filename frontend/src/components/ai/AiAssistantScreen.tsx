import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  History,
  MessageCirclePlus,
  RefreshCcw,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import granitoInteligente from '../../assets/granito-inteligente.png';
import { AppBottomNav } from '../AppBottomNav';
import { AppFeedbackMessage } from '../AppFeedbackMessage';
import { buildAiContext } from '../../services/aiContextService';
import {
  AiChatNoticeError,
  getLatestFinancialAnalysisCache,
  requestAiChatMessage,
  requestFinancialAnalysis,
  saveLatestFinancialAnalysis,
} from '../../services/aiService';
import {
  clearAllConversations,
  createConversation,
  deleteConversation,
  getConversationById,
  getConversationsByType,
  replaceConversationMessages,
  saveMessage,
  type AiConversationType,
  type Conversation,
} from '../../services/aiConversationService';
import { hasValidFinancialAccessSession } from '../../services/financialAccessService';
import { AiTypingIndicator } from './AiTypingIndicator';

type AiAssistantScreenProps = {
  type: AiConversationType;
  title: string;
  subtitle: string;
  suggestions: string[];
  placeholder: string;
  keepBottomNav?: boolean;
  backTo?: string;
};

const QUOTA_CODES = new Set([
  'AI_PROVIDER_QUOTA_EXCEEDED',
  'AI_DISABLED',
  'AI_SERVICE_NOT_CONFIGURED',
]);

function formatDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function summarize(value?: string) {
  const clean = value?.replace(/\s+/g, ' ').trim() ?? '';
  if (!clean) return 'Sin mensajes todavía';
  return clean.length > 72 ? `${clean.slice(0, 69).trim()}...` : clean;
}

function formatGeneratedAt(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function AiAssistantScreen({
  type,
  title,
  subtitle,
  suggestions,
  placeholder,
  keepBottomNav = false,
  backTo,
}: AiAssistantScreenProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    getConversationsByType(type),
  );
  const [currentConversation, setCurrentConversation] = useState<Conversation>(
    () => getConversationsByType(type)[0] ?? createConversation(type),
  );
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<{
    code: string;
    title: string;
    message: string;
    retryAfterSeconds: number | null;
  } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [reloadNotice, setReloadNotice] = useState<string | null>(null);
  const [retryBlockedUntil, setRetryBlockedUntil] = useState(0);
  const [cachedFinancialAnswer, setCachedFinancialAnswer] = useState<{
    answer: string;
    generatedAt: string;
  } | null>(null);

  const messages = currentConversation.messages;
  const lastUserMessage = [...messages].reverse().find((item) => item.role === 'user');
  const retryBlocked = retryBlockedUntil > Date.now();
  const assistantUnavailable = Boolean(notice && QUOTA_CODES.has(notice.code));

  const sortedConversations = useMemo(
    () => conversations.filter((conversation) => conversation.messages.length > 0),
    [conversations],
  );

  const refreshConversations = (conversationId = currentConversation.id) => {
    const next = getConversationsByType(type);
    setConversations(next);
    setCurrentConversation(
      getConversationById(conversationId) ??
        next[0] ??
        createConversation(type),
    );
  };

  useEffect(() => {
    if (type !== 'financial') return undefined;
    let active = true;
    void getLatestFinancialAnalysisCache().then((cached) => {
      if (active && cached?.answer) {
        setCachedFinancialAnswer({
          answer: cached.answer,
          generatedAt: cached.generatedAt,
        });
      }
    });
    return () => {
      active = false;
    };
  }, [type]);

  const goBack = () => {
    if (backTo) {
      const cameFromUnlockedSummary =
        (location.state as { financialAccessGranted?: boolean } | null)
          ?.financialAccessGranted === true || hasValidFinancialAccessSession();
      navigate(backTo, {
        state: cameFromUnlockedSummary
          ? { financialAccessGranted: true }
          : undefined,
      });
      return;
    }
    navigate(-1);
  };

  const normalizeError = (error: unknown) => {
    if (error instanceof AiChatNoticeError) {
      return {
        code: error.code,
        title:
          error.code === 'AI_PROVIDER_QUOTA_EXCEEDED'
            ? 'Límite del asistente alcanzado'
            : 'Asistente no disponible',
        message:
          error.code === 'AI_PROVIDER_QUOTA_EXCEEDED'
            ? 'El análisis inteligente alcanzó el límite de uso por ahora. Puedes seguir revisando tu resumen financiero y volver a intentarlo más tarde.'
            : error.message,
        retryAfterSeconds: error.retryAfterSeconds,
      };
    }

    return {
      code: 'AI_SERVER_UNAVAILABLE',
      title: 'No pude conectar con el servidor',
      message: 'No pude conectar con el servidor. Verifica tu conexión.',
      retryAfterSeconds: null,
    };
  };

  const askProvider = async (content: string) => {
    const builtContext = await buildAiContext();
    if (type === 'financial') {
      const answer = await requestFinancialAnalysis(builtContext.context, content);
      await saveLatestFinancialAnalysis(answer, builtContext.context);
      setCachedFinancialAnswer({
        answer,
        generatedAt: new Date().toISOString(),
      });
      return answer;
    }

    return requestAiChatMessage(content, builtContext.context);
  };

  const sendQuestion = async (value: string, mode: 'new' | 'reload' = 'new') => {
    const trimmed = value.trim();
    if (!trimmed || isLoading || retryBlocked) return;

    setIsLoading(true);
    setReloadNotice(null);
    setNotice(null);
    if (mode === 'new') setQuestion('');

    const target = getConversationById(currentConversation.id) ?? currentConversation;
    let workingMessages = target.messages;

    if (mode === 'new') {
      const userResult = saveMessage(target.id, {
        role: 'user',
        content: trimmed,
      }, type);
      workingMessages = userResult.conversation.messages;
      setCurrentConversation(userResult.conversation);
      setConversations(getConversationsByType(type));
    } else {
      const lastIndex = workingMessages.length - 1;
      const previousIndex = workingMessages.length - 2;
      if (
        workingMessages[lastIndex]?.role === 'assistant' &&
        workingMessages[previousIndex]?.role === 'user'
      ) {
        workingMessages = workingMessages.slice(0, -1);
        const updated = replaceConversationMessages(target.id, workingMessages);
        if (updated) setCurrentConversation(updated);
      }
    }

    try {
      const answer = await askProvider(trimmed);
      saveMessage(target.id, { role: 'assistant', content: answer }, type);
      refreshConversations(target.id);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    } catch (error) {
      const nextNotice = normalizeError(error);
      setNotice(nextNotice);
      if (nextNotice.retryAfterSeconds) {
        setRetryBlockedUntil(Date.now() + nextNotice.retryAfterSeconds * 1000);
      }
      if (type === 'financial') {
        const cached = await getLatestFinancialAnalysisCache();
        if (cached?.answer) {
          setCachedFinancialAnswer({
            answer: cached.answer,
            generatedAt: cached.generatedAt,
          });
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReload = async () => {
    if (isLoading) return;
    if (retryBlocked || notice?.code === 'AI_PROVIDER_QUOTA_EXCEEDED') {
      setReloadNotice('Intenta más tarde.');
      return;
    }
    if (!lastUserMessage) {
      setReloadNotice('No hay una pregunta para recargar.');
      return;
    }
    await sendQuestion(lastUserMessage.content, 'reload');
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendQuestion(question);
  };

  const startNewConversation = () => {
    const conversation = createConversation(type);
    setCurrentConversation(conversation);
    setConversations(getConversationsByType(type));
    setNotice(null);
    setReloadNotice(null);
  };

  const reloadLabel =
    retryBlocked || notice?.code === 'AI_PROVIDER_QUOTA_EXCEEDED'
      ? 'Intentar más tarde'
      : 'Recargar';

  return (
    <div
      className={`min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100 ${
        keepBottomNav
          ? 'pb-[calc(env(safe-area-inset-bottom)+96px)]'
          : 'pb-[calc(env(safe-area-inset-bottom)+24px)]'
      }`}
    >
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-4 pt-5 sm:px-6">
        <header className="flex items-center gap-3">
          <button
            type="button"
            onClick={goBack}
            aria-label={type === 'financial' ? 'Volver al resumen financiero' : 'Volver'}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#102d92] shadow-sm ring-1 ring-slate-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#102d92]/20 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700"
          >
            <ArrowLeft size={19} />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-black leading-tight text-slate-950 dark:text-white">
              {title}
            </h1>
            <p className="mt-1 text-xs font-bold leading-5 text-slate-500 dark:text-slate-300">
              {subtitle}
            </p>
          </div>
          <img
            src={granitoInteligente}
            alt=""
            className="ml-auto h-12 w-12 shrink-0 object-contain"
            draggable={false}
          />
        </header>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={startNewConversation}
            className="inline-flex min-h-[40px] items-center gap-2 rounded-[12px] bg-[#102d92] px-3 text-xs font-black text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#102d92]/25"
          >
            <MessageCirclePlus size={15} />
            Nueva conversación
          </button>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            aria-label="Abrir historial de conversaciones"
            className="inline-flex min-h-[40px] items-center gap-2 rounded-[12px] border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#102d92]/15 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
          >
            <History size={15} />
            Historial
          </button>
          <button
            type="button"
            onClick={() => void handleReload()}
            disabled={isLoading || retryBlocked || notice?.code === 'AI_PROVIDER_QUOTA_EXCEEDED'}
            aria-label="Recargar respuesta del asistente"
            className="inline-flex min-h-[40px] items-center gap-2 rounded-[12px] border border-blue-300 bg-white px-3 text-xs font-black text-blue-700 shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-blue-400/50 dark:bg-blue-600 dark:text-white dark:disabled:border-slate-700 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
          >
            <RefreshCcw size={15} className={isLoading ? 'animate-spin' : ''} />
            {reloadLabel}
          </button>
        </div>

        <section
          aria-live="polite"
          className="mt-4 flex-1 space-y-3 overflow-y-auto rounded-[8px] border border-slate-200 bg-white px-3 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:px-5"
        >
          {messages.length === 0 ? (
            <div className="max-w-[760px] rounded-[8px] bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-800 dark:bg-slate-800 dark:text-slate-100">
              {type === 'financial'
                ? 'Puedo ayudarte a interpretar utilidad, compras, ventas, gastos, merma e inventario agregado.'
                : 'Hola, soy tu asistente inteligente. Puedo ayudarte a revisar inventario, ventas, compras, gastos y sincronización offline.'}
            </div>
          ) : null}

          {messages.map((message) => (
            <article
              key={message.id}
              className={`max-w-[86%] whitespace-pre-line break-words rounded-[8px] px-4 py-3 text-sm font-semibold leading-6 ${
                message.role === 'user'
                  ? 'ml-auto bg-emerald-700 text-white'
                  : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
              }`}
            >
              {message.content}
            </article>
          ))}

          {notice ? (
            <div
              role="status"
              className="max-w-[760px] rounded-[8px] border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold leading-6 text-amber-900 dark:border-amber-500/50 dark:bg-amber-500/15 dark:text-amber-100"
            >
              <p className="font-black">{notice.title}</p>
              <p className="mt-1">{notice.message}</p>
              {type === 'financial' ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={goBack}
                    className="inline-flex min-h-[40px] items-center justify-center rounded-[12px] bg-[#102d92] px-3 text-xs font-black text-white"
                  >
                    Volver al resumen financiero
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleReload()}
                    disabled={
                      isLoading ||
                      retryBlocked ||
                      notice.code === 'AI_PROVIDER_QUOTA_EXCEEDED'
                    }
                    className="inline-flex min-h-[40px] items-center justify-center rounded-[12px] border border-amber-300 bg-white px-3 text-xs font-black text-amber-900 disabled:cursor-not-allowed disabled:opacity-60 dark:border-amber-500/50 dark:bg-slate-900 dark:text-amber-100"
                  >
                    Reintentar más tarde
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {type === 'financial' && cachedFinancialAnswer ? (
            <div className="max-w-[760px] space-y-3">
              <AppFeedbackMessage
                variant={notice ? 'warning' : 'info'}
                description={
                  notice
                    ? 'Mostrando último análisis guardado. Puede estar desactualizado.'
                    : 'Mostrando último análisis guardado.'
                }
              />
              <article className="whitespace-pre-line break-words rounded-[8px] bg-emerald-50 px-4 py-4 text-sm font-semibold leading-6 text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-50">
                {cachedFinancialAnswer.answer}
              </article>
              {cachedFinancialAnswer.generatedAt ? (
                <p className="text-xs font-bold text-slate-500 dark:text-slate-300">
                  Guardado: {formatGeneratedAt(cachedFinancialAnswer.generatedAt)}
                </p>
              ) : null}
            </div>
          ) : null}

          {reloadNotice ? (
            <div
              role="status"
              className="max-w-[760px] rounded-[8px] border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold leading-6 text-blue-900 dark:border-blue-400/40 dark:bg-blue-500/15 dark:text-blue-100"
            >
              {reloadNotice}
            </div>
          ) : null}

          {isLoading ? (
            <div className="inline-flex rounded-[8px] bg-slate-100 px-4 py-3 dark:bg-slate-800">
              <AiTypingIndicator />
            </div>
          ) : null}
        </section>

        <section className="sticky bottom-0 mt-3 border-t border-slate-200 bg-slate-50 pt-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-wrap gap-2 pb-3">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={assistantUnavailable || isLoading || retryBlocked}
                onClick={() => void sendQuestion(suggestion)}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              >
                {suggestion}
              </button>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <label htmlFor={`assistant-question-${type}`} className="sr-only">
              Pregunta para el asistente
            </label>
            <textarea
              id={`assistant-question-${type}`}
              ref={inputRef}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void sendQuestion(question);
                }
              }}
              disabled={assistantUnavailable || isLoading || retryBlocked}
              rows={2}
              maxLength={500}
              placeholder={assistantUnavailable ? 'Intenta más tarde.' : placeholder}
              className="min-h-[52px] flex-1 resize-none rounded-[12px] border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-500 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-400"
            />
            <button
              type="submit"
              disabled={assistantUnavailable || isLoading || retryBlocked || !question.trim()}
              aria-label="Enviar mensaje al asistente"
              className="inline-flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-blue-700 text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/25 dark:border dark:border-blue-400/40 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-500"
            >
              <Send size={18} aria-hidden="true" />
            </button>
          </form>
        </section>
      </main>

      {historyOpen ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/45 px-3 pb-3 pt-6 backdrop-blur-sm sm:items-center">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`ai-history-title-${type}`}
            className="max-h-[86vh] w-full max-w-[520px] overflow-y-auto rounded-[18px] border border-slate-200 bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.28)] dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id={`ai-history-title-${type}`} className="text-lg font-black">
                  Historial
                </h2>
                <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-300">
                  Conversaciones {type === 'financial' ? 'financieras' : 'generales'} guardadas en este dispositivo
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                aria-label="Cerrar historial"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#102d92]/20 dark:bg-slate-800 dark:text-slate-100"
              >
                <X size={17} />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {sortedConversations.length === 0 ? (
                <p className="rounded-[8px] bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  Todavía no hay conversaciones guardadas.
                </p>
              ) : null}

              {sortedConversations.map((conversation) => {
                const lastMessage = conversation.messages.at(-1);
                return (
                  <article
                    key={conversation.id}
                    className="rounded-[8px] border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const next = getConversationById(conversation.id);
                          if (next) setCurrentConversation(next);
                          setHistoryOpen(false);
                        }}
                        className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#102d92]/20"
                      >
                        <p className="truncate text-sm font-black text-slate-950 dark:text-slate-100">
                          {conversation.title}
                        </p>
                        <p className="mt-1 text-[11px] font-bold text-slate-500 dark:text-slate-300">
                          {formatDate(conversation.updatedAt)}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-200">
                          {summarize(lastMessage?.content)}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTargetId(conversation.id)}
                        aria-label={`Eliminar conversación ${conversation.title}`}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-500/20 dark:bg-rose-500/15 dark:text-rose-200"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setConfirmClearAll(true)}
                className="inline-flex min-h-[40px] items-center justify-center rounded-[12px] border border-rose-200 bg-rose-50 px-3 text-xs font-black text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200"
              >
                Borrar historial
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {deleteTargetId ? (
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-slate-950/45 px-3 pb-3 pt-6 backdrop-blur-sm sm:items-center">
          <section className="w-full max-w-[390px] rounded-[18px] bg-white p-4 shadow-xl dark:bg-slate-900">
            <h2 className="text-base font-black">Eliminar conversación</h2>
            <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
              Esta conversación se borrará solo de este dispositivo.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="min-h-[42px] rounded-[12px] border border-slate-200 bg-white text-sm font-black text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteConversation(deleteTargetId);
                  refreshConversations();
                  setDeleteTargetId(null);
                }}
                className="min-h-[42px] rounded-[12px] bg-rose-600 text-sm font-black text-white"
              >
                Eliminar
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {confirmClearAll ? (
        <div className="fixed inset-0 z-[130] flex items-end justify-center bg-slate-950/45 px-3 pb-3 pt-6 backdrop-blur-sm sm:items-center">
          <section className="w-full max-w-[390px] rounded-[18px] bg-white p-4 shadow-xl dark:bg-slate-900">
            <h2 className="text-base font-black">Borrar historial</h2>
            <p className="mt-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
              Se eliminarán las conversaciones locales de esta IA.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirmClearAll(false)}
                className="min-h-[42px] rounded-[12px] border border-slate-200 bg-white text-sm font-black text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  clearAllConversations(type);
                  const conversation = createConversation(type);
                  setCurrentConversation(conversation);
                  setConversations([conversation]);
                  setConfirmClearAll(false);
                  setHistoryOpen(false);
                }}
                className="min-h-[42px] rounded-[12px] bg-rose-600 text-sm font-black text-white"
              >
                Borrar
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {keepBottomNav ? <AppBottomNav /> : null}
    </div>
  );
}
