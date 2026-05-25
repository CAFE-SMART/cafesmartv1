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

const AI_CONFIGURATION_ERROR =
  'No pude conectar con el asistente. Revisa la configuración del servicio de IA.';
export const AI_FINANCIAL_ANALYSIS_CACHE_KEY = 'ai_financial_analysis_latest';

export type CachedAiFinancialAnalysis = {
  answer: string;
  generatedAt: string;
  contextSummary: AiBusinessContext;
};

function resolveAiErrorMessage(error: unknown, scope: 'chat' | 'analysis' = 'chat') {
  if (error instanceof ApiRequestError) {
    if (
      error.code === 'AI_SERVICE_NOT_CONFIGURED' ||
      /servicio de ia no configurado|asistente ia no esta configurado|asistente ia no está configurado/i.test(
        error.message,
      )
    ) {
      return AI_CONFIGURATION_ERROR;
    }

    if (error.code === 'AI_QUOTA_EXCEEDED') {
      return 'El asistente alcanzó el límite de uso por ahora. Intenta más tarde.';
    }

    if (error.code === 'AI_PROVIDER_ERROR' || error.code === 'AI_EMPTY_RESPONSE') {
      return scope === 'analysis'
        ? 'No pude generar el análisis en este momento. Intenta nuevamente.'
        : 'No pude generar una respuesta en este momento. Intenta nuevamente.';
    }

    if (error.status === 401) {
      return 'Tu sesión expiró. Ingresa nuevamente para usar el asistente.';
    }
  }

  return scope === 'analysis'
    ? 'No pude generar el análisis en este momento. Intenta nuevamente.'
    : 'No pude generar una respuesta en este momento. Intenta nuevamente.';
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
    return resolveAiErrorMessage(error, 'chat');
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
    return resolveAiErrorMessage(error, 'analysis');
  }
}

export async function requestFinancialAnalysis(context?: AiBusinessContext) {
  const response = (await apiFetch('/ai/financial-analysis', {
    method: 'POST',
    body: JSON.stringify({ context }),
  })) as AiFinancialAnalysisResponse;
  const answer = (response.answer || response.analysis || '').trim();
  if (!answer) {
    throw new Error('AI_EMPTY_RESPONSE');
  }
  return answer;
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
    },
  );
}

export function getLatestFinancialAnalysisCache() {
  return getOfflineCache<CachedAiFinancialAnalysis>(
    AI_FINANCIAL_ANALYSIS_CACHE_KEY,
  );
}
