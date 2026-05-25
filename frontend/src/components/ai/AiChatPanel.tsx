import { FormEvent, useRef, useState } from 'react';
import { Send, Sparkles, X } from 'lucide-react';
import { buildAiContext } from '../../services/aiContextService';
import { sendAiChatMessage } from '../../services/aiService';

type AiChatPanelProps = {
  onClose: () => void;
};

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
};

const suggestedQuestions = [
  '¿Cómo va mi negocio?',
  'Resume mi inventario.',
  '¿Qué gastos afectaron más este mes?',
  '¿Qué café debería revisar primero?',
  '¿Tengo operaciones pendientes por sincronizar?',
];

function createMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
  };
}

export function AiChatPanel({ onClose }: AiChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    createMessage(
      'assistant',
      'Hola, soy tu asistente inteligente. Puedo ayudarte a revisar inventario, ventas, compras, gastos y sincronización offline.',
    ),
  ]);
  const [question, setQuestion] = useState('');
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const sendQuestion = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || isSending) return;

    setQuestion('');
    setIsSending(true);
    setMessages((current) => [...current, createMessage('user', trimmed)]);

    const builtContext = await buildAiContext();
    const answer = builtContext.hasData
      ? await sendAiChatMessage(trimmed, builtContext.context)
      : typeof navigator !== 'undefined' && !navigator.onLine
        ? 'No tengo información guardada para analizar. Conéctate a internet una vez para cargar tus datos.'
        : await sendAiChatMessage(trimmed, builtContext.context);

    setMessages((current) => [...current, createMessage('assistant', answer)]);
    setIsSending(false);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendQuestion(question);
  };

  return (
    <section
      aria-label="Asistente CaféSmart"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-chat-title"
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+88px)] z-[110] mx-auto flex max-h-[min(680px,calc(100vh-120px))] max-w-[430px] flex-col overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)] dark:border-slate-700 dark:bg-slate-900 sm:right-5 sm:left-auto sm:bottom-[calc(env(safe-area-inset-bottom)+24px)]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-amber-100 bg-amber-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-amber-600 text-white">
            <Sparkles size={18} aria-hidden="true" />
          </span>
          <div>
            <h2 id="ai-chat-title" className="text-sm font-semibold text-slate-900 dark:text-slate-100">Asistente CaféSmart</h2>
            <p className="text-xs text-slate-600 dark:text-slate-300">Pregúntame sobre tu negocio cafetero</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar asistente"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
        >
          <X size={17} aria-hidden="true" />
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          El asistente genera recomendaciones con base en los datos disponibles. Verifica la información antes de tomar decisiones.
        </p>

        {messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[86%] whitespace-pre-line break-words rounded-2xl px-3 py-2 text-sm leading-relaxed ${
              message.role === 'user'
                ? 'ml-auto bg-emerald-700 text-white'
                : 'bg-stone-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
            }`}
          >
            {message.content}
          </div>
        ))}

        {isSending ? (
          <div className="inline-flex rounded-2xl bg-stone-100 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300" role="status">
            Analizando...
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-1">
          {suggestedQuestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => void sendQuestion(suggestion)}
              className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-amber-300 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-stone-100 p-3 dark:border-slate-700">
        <label htmlFor="ai-chat-question" className="sr-only">
          Pregunta para el asistente inteligente
        </label>
        <input
          id="ai-chat-question"
          ref={inputRef}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={500}
          placeholder="Pregunta sobre inventario, ventas o finanzas..."
          className="min-w-0 flex-1 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
        <button
          type="submit"
          disabled={isSending || !question.trim()}
          aria-label="Enviar pregunta"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-700 text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <Send size={16} aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}
