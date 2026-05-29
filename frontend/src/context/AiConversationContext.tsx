import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { buildAiContext } from '../services/aiContextService';
import {
  AiChatNoticeError,
  sendAiChatMessage,
  type AiChatNoticeCode,
} from '../services/aiService';
import {
  clearAllConversations,
  createConversation,
  deleteConversation,
  getConversationById,
  getConversations,
  saveMessage,
  type AiMessage,
  type Conversation,
} from '../services/aiConversationService';

type AiConversationContextValue = {
  conversations: Conversation[];
  currentConversation: Conversation;
  messages: AiMessage[];
  isSending: boolean;
  notice: AiConversationNotice | null;
  lastQuestion: string;
  sendMessage: (content: string) => Promise<void>;
  clearNotice: () => void;
  startNewConversation: () => void;
  loadConversation: (id: string) => void;
  removeConversation: (id: string) => void;
  clearHistory: () => void;
  refreshConversations: () => void;
};

export type AiConversationNotice = {
  code: AiChatNoticeCode;
  message: string;
};

const AiConversationContext = createContext<AiConversationContextValue | undefined>(
  undefined,
);

function getInitialConversation() {
  return getConversations()[0] ?? createConversation();
}

export function AiConversationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    getConversations(),
  );
  const [currentConversation, setCurrentConversation] =
    useState<Conversation>(getInitialConversation);
  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState<AiConversationNotice | null>(null);
  const [lastQuestion, setLastQuestion] = useState('');

  const refreshConversations = useCallback(() => {
    const next = getConversations();
    setConversations(next);
    setCurrentConversation((current) =>
      getConversationById(current.id) ?? next[0] ?? createConversation(),
    );
  }, []);

  const persistMessage = useCallback(
    (conversationId: string, message: Omit<AiMessage, 'id' | 'createdAt'>) => {
      const result = saveMessage(conversationId, message);
      setCurrentConversation(result.conversation);
      setConversations(getConversations());
      return result;
    },
    [],
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isSending) return;

      const target = getConversationById(currentConversation.id) ?? currentConversation;
      setLastQuestion(trimmed);
      setIsSending(true);

      try {
        const builtContext = await buildAiContext();
        const answer = builtContext.hasData
          ? await sendAiChatMessage(trimmed, builtContext.context)
          : typeof navigator !== 'undefined' && !navigator.onLine
            ? 'No tengo información guardada para analizar. Conéctate a internet una vez para cargar tus datos.'
            : await sendAiChatMessage(trimmed, builtContext.context);

        setNotice(null);
        persistMessage(target.id, { role: 'user', content: trimmed });
        persistMessage(target.id, { role: 'assistant', content: answer });
      } catch (error) {
        if (error instanceof AiChatNoticeError) {
          setNotice({ code: error.code, message: error.message });
          return;
        }

        setNotice({
          code: 'AI_SERVICE_NOT_CONFIGURED',
          message:
            'No pude conectar con el asistente. Revisa la configuración del servicio de IA.',
        });
      } finally {
        setIsSending(false);
      }
    },
    [currentConversation, isSending, persistMessage],
  );

  const clearNotice = useCallback(() => {
    setNotice(null);
  }, []);

  const startNewConversation = useCallback(() => {
    const conversation = createConversation();
    setCurrentConversation(conversation);
    setConversations(getConversations());
    setNotice(null);
  }, []);

  const loadConversation = useCallback((id: string) => {
    const conversation = getConversationById(id);
    if (!conversation) return;
    setCurrentConversation(conversation);
    setConversations(getConversations());
  }, []);

  const removeConversation = useCallback((id: string) => {
    deleteConversation(id);
    const next = getConversations();
    const fallback = next[0] ?? createConversation();
    setConversations(getConversations());
    setCurrentConversation((current) =>
      current.id === id ? fallback : getConversationById(current.id) ?? fallback,
    );
  }, []);

  const clearHistory = useCallback(() => {
    clearAllConversations();
    const conversation = createConversation();
    setCurrentConversation(conversation);
    setConversations([conversation]);
  }, []);

  const value = useMemo<AiConversationContextValue>(
    () => ({
      conversations,
      currentConversation,
      messages: currentConversation.messages,
      isSending,
      notice,
      lastQuestion,
      sendMessage,
      clearNotice,
      startNewConversation,
      loadConversation,
      removeConversation,
      clearHistory,
      refreshConversations,
    }),
    [
      conversations,
      currentConversation,
      isSending,
      notice,
      lastQuestion,
      sendMessage,
      clearNotice,
      startNewConversation,
      loadConversation,
      removeConversation,
      clearHistory,
      refreshConversations,
    ],
  );

  return (
    <AiConversationContext.Provider value={value}>
      {children}
    </AiConversationContext.Provider>
  );
}

export function useAiConversation() {
  const value = useContext(AiConversationContext);
  if (!value) {
    throw new Error('useAiConversation debe usarse dentro de AiConversationProvider');
  }
  return value;
}
