import { ApiRequestError, apiFetch } from './apiService';
import type { AiBusinessContext } from './aiContextService';

type AiChatResponse = {
  answer?: string;
};

type AiFinancialAnalysisResponse = {
  answer?: string;
  analysis?: string;
};

const AI_CONFIGURATION_ERROR =
  'No pude conectar con el asistente. Revisa la configuración del servicio de IA.';

function resolveAiErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (
      error.code === 'AI_SERVICE_NOT_CONFIGURED' ||
      /servicio de ia no configurado|asistente ia no esta configurado|asistente ia no está configurado/i.test(
        error.message,
      )
    ) {
      return AI_CONFIGURATION_ERROR;
    }

    if (error.code === 'AI_PROVIDER_ERROR') {
      return 'No pude generar una respuesta en este momento. Intenta nuevamente.';
    }

    if (error.status === 401) {
      return 'Tu sesión expiró. Ingresa nuevamente para usar el asistente.';
    }
  }

  return 'No pude generar una respuesta en este momento. Intenta nuevamente.';
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
    return resolveAiErrorMessage(error);
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
    return resolveAiErrorMessage(error);
  }
}
