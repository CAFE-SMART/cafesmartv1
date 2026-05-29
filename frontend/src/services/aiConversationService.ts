export type AiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: AiMessage[];
};

const STORAGE_KEY = 'cafesmart_ai_conversations';
const MAX_CONVERSATIONS = 20;
const MAX_MESSAGES_PER_CONVERSATION = 50;

const SENSITIVE_TEXT_PATTERN =
  /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})|(\b\d{7,15}\b)|(Bearer\s+[A-Za-z0-9._-]+)|\b(password|contrase[ñn]a|token|api\s*key|apikey|secret|c[eé]dula|documento|tel[eé]fono|celular|correo|email|direcci[oó]n)\b/gi;

function createId(prefix: string) {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${prefix}-${random}`;
}

function nowIso() {
  return new Date().toISOString();
}

function sanitizeMessageContent(value: string) {
  return value
    .replace(SENSITIVE_TEXT_PATTERN, '[dato sensible omitido]')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 2000);
}

function buildTitleFromMessage(content: string) {
  const clean = sanitizeMessageContent(content).replace(/\s+/g, ' ').trim();
  if (!clean) return 'Nueva conversación';
  return clean.length > 48 ? `${clean.slice(0, 45).trim()}...` : clean;
}

function readStored(): Conversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Conversation[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item?.id && Array.isArray(item.messages))
      .map((item) => ({
        ...item,
        title: item.title || 'Nueva conversación',
        messages: item.messages.slice(-MAX_MESSAGES_PER_CONVERSATION),
      }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_CONVERSATIONS);
  } catch {
    return [];
  }
}

function writeStored(conversations: Conversation[]) {
  if (typeof window === 'undefined') return;
  const normalized = conversations
    .map((conversation) => ({
      ...conversation,
      messages: conversation.messages.slice(-MAX_MESSAGES_PER_CONVERSATION),
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_CONVERSATIONS);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
}

export function createConversation() {
  const createdAt = nowIso();
  const conversation: Conversation = {
    id: createId('conversation'),
    title: 'Nueva conversación',
    createdAt,
    updatedAt: createdAt,
    messages: [],
  };
  writeStored([conversation, ...readStored()]);
  return conversation;
}

export function getConversations() {
  return readStored();
}

export function getConversationById(id: string) {
  return readStored().find((conversation) => conversation.id === id) ?? null;
}

export function saveMessage(
  conversationId: string,
  message: Omit<AiMessage, 'id' | 'createdAt'>,
) {
  const conversations = readStored();
  let conversation =
    conversations.find((item) => item.id === conversationId) ?? createConversation();
  const sanitizedContent = sanitizeMessageContent(message.content);
  const nextMessage: AiMessage = {
    id: createId(message.role),
    role: message.role,
    content: sanitizedContent,
    createdAt: nowIso(),
  };

  conversation = {
    ...conversation,
    title:
      conversation.title === 'Nueva conversación' && message.role === 'user'
        ? buildTitleFromMessage(sanitizedContent)
        : conversation.title,
    updatedAt: nextMessage.createdAt,
    messages: [...conversation.messages, nextMessage].slice(
      -MAX_MESSAGES_PER_CONVERSATION,
    ),
  };

  writeStored([
    conversation,
    ...conversations.filter((item) => item.id !== conversation.id),
  ]);
  return { conversation, message: nextMessage };
}

export function updateConversationTitle(conversationId: string, title: string) {
  const conversations = readStored();
  writeStored(
    conversations.map((conversation) =>
      conversation.id === conversationId
        ? {
            ...conversation,
            title: buildTitleFromMessage(title),
            updatedAt: nowIso(),
          }
        : conversation,
    ),
  );
}

export function deleteConversation(conversationId: string) {
  writeStored(
    readStored().filter((conversation) => conversation.id !== conversationId),
  );
}

export function clearAllConversations() {
  writeStored([]);
}

export const AI_CONVERSATION_LIMITS = {
  maxConversations: MAX_CONVERSATIONS,
  maxMessagesPerConversation: MAX_MESSAGES_PER_CONVERSATION,
};
