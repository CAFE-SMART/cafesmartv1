import { ApiRequestError, apiFetch } from './apiService';
import type { AiBusinessContext } from './aiContextService';
import { getOfflineCache, saveOfflineCache } from './offlineCacheService';

type AiChatResponse = {
  answer?: string;
};

type AiFinancialAnalysisResponse = {
  answer?: string;
  analysis?: string;
};

export type AiChatNoticeCode =
  | 'AI_DISABLED'
  | 'AI_SERVICE_NOT_CONFIGURED'
  | 'AI_PROVIDER_QUOTA_EXCEEDED'
  | 'AI_DAILY_LIMIT_EXCEEDED'
  | 'AI_CONTEXT_TOO_LARGE'
  | 'AI_PROVIDER_ERROR'
  | 'AI_EMPTY_RESPONSE'
  | 'AI_SERVER_UNAVAILABLE'
  | 'AI_SESSION_EXPIRED';

export class AiChatNoticeError extends Error {
  code: AiChatNoticeCode;
  retryAfterSeconds: number | null;

  constructor(
    code: AiChatNoticeCode,
    message: string,
    retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = 'AiChatNoticeError';
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const AI_CONFIGURATION_ERROR =
  'No pude conectar con el asistente. Revisa la configuración del servicio de IA.';
const AI_DISABLED_MESSAGE =
  'El asistente inteligente todavía no está disponible.';
const AI_SERVER_CONNECTION_ERROR =
  'No pude conectar con el servidor. Verifica que el backend esté encendido.';
export const AI_FINANCIAL_ANALYSIS_CACHE_KEY =
  'cafesmart:ai-financial-analysis-latest';

export type CachedAiFinancialAnalysis = {
  answer: string;
  generatedAt: string;
  contextSummary: AiBusinessContext;
  summaryHash?: string;
};

export function resolveAiErrorMessage(
  error: unknown,
  scope: 'chat' | 'analysis' = 'chat',
) {
  if (error instanceof ApiRequestError) {
    if (error.status === 0) {
      return AI_SERVER_CONNECTION_ERROR;
    }

    if (error.status === 401) {
      return 'Tu sesión expiró. Ingresa nuevamente.';
    }

    if (error.code === 'AI_DISABLED') {
      return AI_DISABLED_MESSAGE;
    }

    if (
      error.code === 'AI_SERVICE_NOT_CONFIGURED' ||
      /servicio de ia no configurado|asistente ia no esta configurado|asistente ia no está configurado/i.test(
        error.message,
      )
    ) {
      return AI_CONFIGURATION_ERROR;
    }

    if (error.code === 'AI_DAILY_LIMIT_EXCEEDED') {
      return scope === 'analysis'
        ? 'Alcanzaste el límite diario de análisis inteligentes. Intenta de nuevo mañana.'
        : 'Alcanzaste el límite diario del asistente. Intenta de nuevo mañana.';
    }

    if (
      error.code === 'AI_PROVIDER_QUOTA_EXCEEDED' ||
      error.code === 'AI_QUOTA_EXCEEDED'
    ) {
      return 'El asistente alcanzó el límite de uso por ahora. Intenta más tarde.';
    }

    if (error.code === 'AI_CONTEXT_TOO_LARGE') {
      return 'La información es demasiado amplia para analizarla ahora.';
    }

    if (error.code === 'AI_PROVIDER_ERROR' || error.code === 'AI_EMPTY_RESPONSE') {
      return scope === 'analysis'
        ? 'No pude generar el análisis en este momento. Intenta nuevamente.'
        : 'No pude generar una respuesta en este momento. Intenta nuevamente.';
    }

  }

  return scope === 'analysis'
    ? 'No pude generar el análisis en este momento. Intenta nuevamente.'
    : 'No pude generar una respuesta en este momento. Intenta nuevamente.';
}

function resolveChatNoticeError(error: unknown) {
  if (!(error instanceof ApiRequestError)) return null;

  if (error.status === 0) {
    return new AiChatNoticeError('AI_SERVER_UNAVAILABLE', AI_SERVER_CONNECTION_ERROR);
  }

  if (error.status === 401) {
    return new AiChatNoticeError(
      'AI_SESSION_EXPIRED',
      'Tu sesión expiró. Ingresa nuevamente.',
    );
  }

  if (error.code === 'AI_DISABLED') {
    return new AiChatNoticeError('AI_DISABLED', AI_DISABLED_MESSAGE);
  }

  if (
    error.code === 'AI_SERVICE_NOT_CONFIGURED' ||
    /servicio de ia no configurado|asistente ia no esta configurado|asistente ia no está configurado/i.test(
      error.message,
    )
  ) {
    return new AiChatNoticeError(
      'AI_SERVICE_NOT_CONFIGURED',
      AI_CONFIGURATION_ERROR,
    );
  }

  if (
    error.code === 'AI_PROVIDER_QUOTA_EXCEEDED' ||
    error.code === 'AI_QUOTA_EXCEEDED'
  ) {
    return new AiChatNoticeError(
      'AI_PROVIDER_QUOTA_EXCEEDED',
      resolveAiErrorMessage(error),
      error.retryAfterSeconds,
    );
  }

  if (error.code === 'AI_DAILY_LIMIT_EXCEEDED') {
    return new AiChatNoticeError(
      'AI_DAILY_LIMIT_EXCEEDED',
      resolveAiErrorMessage(error),
    );
  }

  if (error.code === 'AI_CONTEXT_TOO_LARGE') {
    return new AiChatNoticeError(
      'AI_CONTEXT_TOO_LARGE',
      resolveAiErrorMessage(error),
    );
  }

  if (error.code === 'AI_PROVIDER_ERROR' || error.code === 'AI_EMPTY_RESPONSE') {
    return new AiChatNoticeError(
      error.code,
      resolveAiErrorMessage(error),
    );
  }

  return null;
}

function logAiDebug(endpoint: string, error: unknown) {
  if (!import.meta.env.DEV) return;
  if (error instanceof ApiRequestError) {
    console.info('[ai-debug]', {
      status: error.status,
      code: error.code,
      endpoint,
    });
    return;
  }
  console.info('[ai-debug]', {
    status: 0,
    code: 'AI_CLIENT_ERROR',
    endpoint,
  });
}

function hasContextData(context?: AiBusinessContext) {
  if (!context) return false;
  return Boolean(
    context.inventario?.totalKg ||
      context.inventario?.sublotesDisponibles ||
      context.compras?.cantidadCompras ||
      context.ventas?.cantidadVentas ||
      context.gastos?.totalMes ||
      context.offline?.pendientesSync,
  );
}

function buildOfflineResponse(question: string, context?: AiBusinessContext) {
  if (!hasContextData(context)) {
    return 'No tengo información guardada para analizar. Conéctate a internet una vez para cargar tus datos.';
  }

  const pending = context?.offline?.pendientesSync ?? 0;
  const totalKg = context?.inventario?.totalKg ?? 0;
  const sublotes = context?.inventario?.sublotesDisponibles ?? 0;

  if (/pendientes|sincron/i.test(question)) {
    return `Estoy usando información guardada en este dispositivo. Tienes ${pending} operación(es) pendientes o con error de sincronización. Revisa la sección de Sincronización offline cuando vuelvas a tener conexión.`;
  }

  if (/inventario|café|cafe|sublote/i.test(question)) {
    return `Estoy usando información guardada en este dispositivo, por lo que puede no estar actualizada. Tu inventario guardado registra ${totalKg} kg y ${sublotes} sublote(s) disponibles. Revisa primero los sublotes más antiguos o con baja rotación.`;
  }

  return 'Estoy usando información guardada en este dispositivo, por lo que puede no estar actualizada. Con los datos disponibles puedo orientarte, pero necesitarás conexión para generar un análisis completo y sincronizar cambios.';
}

export async function sendAiChatMessage(question: string, context?: AiBusinessContext) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return buildOfflineResponse(question, context);
  }

  try {
    const response = (await apiFetch('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ question, context }),
    })) as AiChatResponse;
    return response.answer || 'No pude generar una respuesta en este momento. Intenta nuevamente.';
  } catch (error) {
    logAiDebug('/ai/chat', error);
    const noticeError = resolveChatNoticeError(error);
    if (noticeError) {
      throw noticeError;
    }
    return resolveAiErrorMessage(error, 'chat');
  }
}

export async function requestAiChatMessage(
  question: string,
  context?: AiBusinessContext,
) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return buildOfflineResponse(question, context);
  }

  try {
    const response = (await apiFetch('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ question, context }),
    })) as AiChatResponse;
    return response.answer || 'No pude generar una respuesta en este momento. Intenta nuevamente.';
  } catch (error) {
    logAiDebug('/ai/chat', error);
    const noticeError = resolveChatNoticeError(error);
    if (noticeError) throw noticeError;
    throw new AiChatNoticeError(
      'AI_PROVIDER_ERROR',
      resolveAiErrorMessage(error, 'chat'),
    );
  }
}

export async function getFinancialAnalysis(context?: AiBusinessContext) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return buildOfflineResponse('analiza mi negocio', context);
  }

  try {
    const response = (await apiFetch('/ai/financial-analysis', {
      method: 'POST',
      body: JSON.stringify({ context }),
    })) as AiFinancialAnalysisResponse;
    return response.answer || response.analysis || 'No pude generar una respuesta en este momento. Intenta nuevamente.';
  } catch (error) {
    logAiDebug('/ai/financial-analysis', error);
    return resolveAiErrorMessage(error, 'analysis');
  }
}

export async function requestFinancialAnalysis(
  context?: AiBusinessContext,
  question?: string,
) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return buildOfflineResponse(question || 'analiza mi negocio', context);
  }

  try {
    const response = (await apiFetch('/ai/financial-analysis', {
      method: 'POST',
      body: JSON.stringify({ context, question }),
    })) as AiFinancialAnalysisResponse;
    const answer = (response.answer || response.analysis || '').trim();
    if (!answer) {
      throw new AiChatNoticeError(
        'AI_EMPTY_RESPONSE',
        'No pude generar una respuesta en este momento. Intenta nuevamente.',
      );
    }
    return answer;
  } catch (error) {
    logAiDebug('/ai/financial-analysis', error);
    if (error instanceof AiChatNoticeError) throw error;
    const noticeError = resolveChatNoticeError(error);
    if (noticeError) throw noticeError;
    throw new AiChatNoticeError(
      'AI_PROVIDER_ERROR',
      resolveAiErrorMessage(error, 'analysis'),
    );
  }
}

export async function saveLatestFinancialAnalysis(
  answer: string,
  contextSummary: AiBusinessContext,
) {
  await saveOfflineCache<CachedAiFinancialAnalysis>(
    AI_FINANCIAL_ANALYSIS_CACHE_KEY,
    {
      answer,
      contextSummary,
      generatedAt: new Date().toISOString(),
      summaryHash: JSON.stringify(contextSummary).slice(0, 160),
    },
  );
}

export function getLatestFinancialAnalysisCache() {
  return getOfflineCache<CachedAiFinancialAnalysis>(
    AI_FINANCIAL_ANALYSIS_CACHE_KEY,
  );
}
