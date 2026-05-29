import { FormEvent, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  History,
  MessageCirclePlus,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppBottomNav } from '../components/AppBottomNav';
import granitoInteligente from '../assets/granito-inteligente.png';
import { useAiConversation } from '../context/AiConversationContext';

const suggestedQuestions = [
  '¿Cómo va mi negocio?',
  'Resume mi inventario.',
  '¿Qué gastos afectaron más este mes?',
  '¿Qué café debería revisar primero?',
  '¿Tengo operaciones pendientes por sincronizar?',
];

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

export default function AsistenteIA() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const {
    conversations,
    currentConversation,
    messages,
    isSending,
    sendMessage,
    startNewConversation,
    loadConversation,
    removeConversation,
    clearHistory,
  } = useAiConversation();
  const [question, setQuestion] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const sortedConversations = useMemo(
    () => conversations.filter((conversation) => conversation.messages.length > 0),
    [conversations],
  );

  const sendQuestion = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || isSending) return;
    setQuestion('');
    await sendMessage(trimmed);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendQuestion(question);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-32 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-5 sm:px-6">
        <header className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Volver"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#102d92] shadow-sm ring-1 ring-slate-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#102d92]/20 dark:bg-slate-900 dark:text-slate-100 dark:ring-slate-700"
          >
            <ArrowLeft size={19} />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-black leading-tight text-slate-950 dark:text-white">
              Asistente CaféSmart
            </h1>
            <p className="mt-1 text-xs font-bold leading-5 text-slate-500 dark:text-slate-300">
              Consulta información de tu negocio cafetero
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
            className="inline-flex min-h-[40px] items-center gap-2 rounded-[12px] border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#102d92]/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <History size={15} />
            Historial
          </button>
        </div>

        <section
          aria-live="polite"
          className="mt-4 flex-1 space-y-3 overflow-y-auto rounded-[16px] border border-slate-200 bg-white px-3 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:px-5"
        >
          {messages.length === 0 ? (
            <div className="max-w-[760px] rounded-[16px] bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-800 dark:bg-slate-800 dark:text-slate-100">
              Hola, soy tu asistente inteligente. Puedo ayudarte a revisar inventario, ventas, compras, gastos y sincronización offline.
            </div>
          ) : null}

          {messages.map((message) => (
            <article
              key={message.id}
              className={`max-w-[86%] whitespace-pre-line break-words rounded-[16px] px-4 py-3 text-sm font-semibold leading-6 ${
                message.role === 'user'
                  ? 'ml-auto bg-emerald-700 text-white'
                  : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
              }`}
            >
              {message.content}
            </article>
          ))}

          {isSending ? (
            <div
              role="status"
              className="inline-flex rounded-[16px] bg-slate-100 px-4 py-3 text-sm font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              Analizando...
            </div>
          ) : null}
        </section>

        <section className="sticky bottom-0 mt-3 border-t border-slate-200 bg-slate-50 pt-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-wrap gap-2 pb-3">
            {suggestedQuestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => void sendQuestion(suggestion)}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {suggestion}
              </button>
            ))}
          </div>
          <form onSubmit={handleSubmit} className="flex items-end gap-2">
            <label htmlFor="assistant-question" className="sr-only">
              Pregunta para el asistente
            </label>
            <textarea
              id="assistant-question"
              ref={inputRef}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void sendQuestion(question);
                }
              }}
              rows={2}
              maxLength={500}
              placeholder="Pregunta sobre inventario, ventas, compras o sincronización..."
              className="min-h-[52px] flex-1 resize-none rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={isSending || !question.trim()}
              aria-label="Enviar pregunta"
              className="inline-flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/25"
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
            aria-labelledby="ai-history-title"
            className="max-h-[86vh] w-full max-w-[520px] overflow-y-auto rounded-[18px] border border-slate-200 bg-white p-4 shadow-[0_24px_70px_rgba(15,23,42,0.28)] dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="ai-history-title" className="text-lg font-black">
                  Historial
                </h2>
                <p className="mt-1 text-xs font-bold text-slate-500 dark:text-slate-300">
                  Conversaciones guardadas en este dispositivo
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
                <p className="rounded-[14px] bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  Todavía no hay conversaciones guardadas.
                </p>
              ) : null}

              {sortedConversations.map((conversation) => {
                const lastMessage = conversation.messages.at(-1);
                return (
                  <article
                    key={conversation.id}
                    className="rounded-[14px] border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          loadConversation(conversation.id);
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
                  removeConversation(deleteTargetId);
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
              Se eliminarán todas las conversaciones locales.
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
                  clearHistory();
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

      <AppBottomNav />
    </div>
  );
}
