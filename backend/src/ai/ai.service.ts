import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiChatDto } from './dto/ai-chat.dto';
import { FinancialAnalysisDto } from './dto/financial-analysis.dto';
import {
  AiBusinessContextDto,
  sanitizeAiText,
  sanitizeBoolean,
  sanitizeNumber,
  sanitizeStringArray,
} from './dto/ai-context.dto';

type AiProvider = 'openai' | 'gemini' | 'groq' | 'openrouter' | 'mock' | 'none';
type ProviderCredentialSource = 'primary' | 'fallback';

export const AI_NOT_CONFIGURED_MESSAGE = 'Servicio de IA no configurado.';
const AI_DISABLED_RESPONSE = {
  code: 'AI_DISABLED',
  message: 'El asistente inteligente todavía no está activo.',
};
const AI_NOT_CONFIGURED_RESPONSE = {
  code: 'AI_SERVICE_NOT_CONFIGURED',
  message: AI_NOT_CONFIGURED_MESSAGE,
};
const AI_PROVIDER_ERROR_RESPONSE = {
  code: 'AI_PROVIDER_ERROR',
  message: 'No pude generar una respuesta en este momento.',
};
const AI_EMPTY_RESPONSE = {
  code: 'AI_EMPTY_RESPONSE',
  message: 'El proveedor de IA no devolvió contenido.',
};
const AI_PROVIDER_QUOTA_EXCEEDED_RESPONSE = {
  code: 'AI_PROVIDER_QUOTA_EXCEEDED',
  message: 'El asistente alcanzó el límite de uso por ahora. Intenta más tarde.',
  retryAfterSeconds: null as number | null,
};

const SYSTEM_PROMPT =
  'Eres el asistente inteligente de CaféSmart. Ayudas a interpretar inventario, compras, ventas, gastos, secado, utilidad y sincronización offline. Solo puedes responder con base en el contexto resumido recibido. No inventes datos. No solicites ni almacenes datos sensibles. No pidas contraseñas, documentos, teléfonos, correos ni tokens. No puedes modificar información del sistema. Solo puedes explicar, orientar y recomendar. Si faltan datos, responde: "No tengo suficiente información para analizar eso todavía." Si el usuario pide modificar datos, responde: "No puedo realizar esa acción directamente, pero puedo orientarte paso a paso." Responde en español claro. Da una respuesta completa en 3 a 5 párrafos cortos o en una lista breve. No termines frases incompletas. Evita tecnicismos.';

const SENSITIVE_FIELD_NAMES = new Set([
  'password',
  'contraseña',
  'contrasena',
  'token',
  'accesstoken',
  'refreshToken',
  'refreshtoken',
  'authorization',
  'apikey',
  'apiKey',
  'secret',
  'documento',
  'cedula',
  'cédula',
  'telefono',
  'teléfono',
  'celular',
  'email',
  'correo',
  'direccion',
  'dirección',
  'nombrecompleto',
  'nombreCompleto',
  'fullname',
  'fullName',
]);

const SENSITIVE_TEXT_PATTERN =
  /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})|(\b\d{7,15}\b)|(Bearer\s+[A-Za-z0-9._-]+)|\b(password|contrase[ñn]a|token|api\s*key|apikey|secret|c[eé]dula|documento|tel[eé]fono|celular|correo|email|direcci[oó]n)\b/gi;

@Injectable()
export class AiService {
  constructor(private readonly configService: ConfigService) {}

  async generateChatResponse(dto: AiChatDto) {
    this.ensureAiEnabled();
    const questionSanitization = this.sanitizeUserQuestion(dto.question);
    const question = questionSanitization.text;
    const context = this.sanitizeContext(dto.context);

    if (!question) {
      return { answer: 'Escribe una pregunta para poder ayudarte.' };
    }

    if (questionSanitization.removedSensitiveData) {
      return {
        answer:
          'Por seguridad, no necesito datos sensibles para ayudarte. Puedo orientarte con información general del sistema.',
      };
    }

    if (this.isActionRequest(question)) {
      return {
        answer:
          'No puedo realizar esa acción directamente, pero puedo orientarte sobre cómo hacerla paso a paso.',
      };
    }

    const prompt = [
      SYSTEM_PROMPT,
      'Pregunta del usuario:',
      question,
      'Contexto resumido disponible:',
      JSON.stringify(context, null, 2),
      'Si el contexto no contiene datos suficientes, dilo claramente sin inventar cifras.',
      'Para preguntas generales, usa esta estructura: Resumen general, Puntos de atención y Recomendación.',
    ].join('\n\n');

    return { answer: await this.callAiProvider(prompt) };
  }

  async generateFinancialAnalysis(dto: FinancialAnalysisDto) {
    this.ensureAiEnabled();
    const questionSanitization = this.sanitizeUserQuestion(dto.question);
    const question = questionSanitization.text;
    const context = this.sanitizeContext(dto.context);
    const hasContext = Object.keys(context).length > 0;
    this.logContextKeys('financial analysis', context);

    if (!hasContext) {
      return {
        answer:
          'No tengo suficiente información guardada para analizar eso todavía.',
      };
    }

    const prompt = [
      SYSTEM_PROMPT,
      'Genera un análisis completo del negocio con estos encabezados exactos: Resumen general, Puntos de atención y Recomendaciones.',
      'Usa listas breves cuando ayuden. Si un dato no existe en el contexto, indica que no está disponible. No abras la respuesta con frases genéricas.',
      question
        ? `Enfoca el análisis en esta pregunta del usuario: ${question}`
        : 'Enfoca el análisis en un resumen financiero general.',
      'Contexto resumido disponible:',
      JSON.stringify(context, null, 2),
      'No inventes valores y avisa si los datos vienen de cache offline.',
    ].join('\n\n');

    return { answer: await this.callAiProvider(prompt) };
  }

  async buildBusinessContext(_userId: string) {
    return {};
  }

  sanitizeContext(context?: AiBusinessContextDto) {
    if (!context || typeof context !== 'object') return {};
    const { value: sanitizedRaw, removed } = this.removeSensitiveFields(context);
    this.logSanitization(removed);
    const safeContext = sanitizedRaw as AiBusinessContextDto;

    return this.compactContext({
      inventario: safeContext.inventario
        ? {
            totalKg: sanitizeNumber(safeContext.inventario.totalKg),
            capacidadUsada: sanitizeAiText(safeContext.inventario.capacidadUsada, 80),
            sublotesDisponibles: sanitizeNumber(safeContext.inventario.sublotesDisponibles),
            sublotesAntiguos: sanitizeNumber(safeContext.inventario.sublotesAntiguos),
          }
        : undefined,
      ventas: safeContext.ventas
        ? {
            totalMes: sanitizeNumber(safeContext.ventas.totalMes),
            totalKg: sanitizeNumber(safeContext.ventas.totalKg),
            cantidadVentas: sanitizeNumber(safeContext.ventas.cantidadVentas),
          }
        : undefined,
      compras: safeContext.compras
        ? {
            totalMes: sanitizeNumber(safeContext.compras.totalMes),
            totalKg: sanitizeNumber(safeContext.compras.totalKg),
            cantidadCompras: sanitizeNumber(safeContext.compras.cantidadCompras),
          }
        : undefined,
      gastos: safeContext.gastos
        ? {
            totalMes: sanitizeNumber(safeContext.gastos.totalMes),
            principales: sanitizeStringArray(safeContext.gastos.principales),
          }
        : undefined,
      secado: safeContext.secado
        ? {
            activos: sanitizeNumber(safeContext.secado.activos),
            mermaKg: sanitizeNumber(safeContext.secado.mermaKg),
          }
        : undefined,
      offline: safeContext.offline
        ? {
            usandoDatosCacheados: sanitizeBoolean(safeContext.offline.usandoDatosCacheados),
            pendientesSync: sanitizeNumber(safeContext.offline.pendientesSync),
          }
        : undefined,
      financiero: (safeContext as { financiero?: Record<string, unknown> }).financiero
        ? {
            utilidadEstimada: sanitizeNumber(
              (safeContext as { financiero?: Record<string, unknown> }).financiero
                ?.utilidadEstimada,
            ),
          }
        : undefined,
      bodega: (safeContext as { bodega?: Record<string, unknown> }).bodega
        ? {
            capacidadKg: sanitizeNumber(
              (safeContext as { bodega?: Record<string, unknown> }).bodega
                ?.capacidadKg,
            ),
          }
        : undefined,
    });
  }

  private async callAiProvider(prompt: string) {
    const provider = this.getProvider('AI_PROVIDER', 'none');

    try {
      return await this.callProvider(provider, prompt, 'primary');
    } catch (error) {
      if (!this.isQuotaExceededError(error)) {
        throw error;
      }

      if (provider === 'gemini') {
        console.warn('[ai-provider] gemini quota exceeded');
      }

      const fallbackProvider = this.getProvider('AI_FALLBACK_PROVIDER', 'none');
      if (fallbackProvider === 'none') {
        throw error;
      }

      const fallbackApiKey = this.configService.get<string>('AI_FALLBACK_API_KEY');
      if (!fallbackApiKey && fallbackProvider !== 'mock') {
        throw error;
      }

      console.info('[ai-provider] using fallback provider');

      try {
        return await this.callProvider(fallbackProvider, prompt, 'fallback');
      } catch (fallbackError) {
        throw new ServiceUnavailableException(
          this.buildQuotaExceededResponse(fallbackError),
        );
      }
    }
  }

  private async callProvider(
    provider: AiProvider,
    prompt: string,
    source: ProviderCredentialSource,
  ) {
    if (provider === 'gemini') {
      return this.callGemini(prompt, source);
    }

    if (provider === 'mock') {
      return this.callMock(prompt);
    }

    if (provider === 'none') {
      throw new ServiceUnavailableException(AI_NOT_CONFIGURED_RESPONSE);
    }

    if (provider === 'openai' || provider === 'groq' || provider === 'openrouter') {
      return this.callOpenAiCompatible(prompt, provider, source);
    }

    throw new ServiceUnavailableException(AI_NOT_CONFIGURED_RESPONSE);
  }

  private async callOpenAiCompatible(
    prompt: string,
    provider: Extract<AiProvider, 'openai' | 'groq' | 'openrouter'>,
    source: ProviderCredentialSource,
  ) {
    const apiKey =
      source === 'fallback'
        ? this.configService.get<string>('AI_FALLBACK_API_KEY')
        : this.configService.get<string>('AI_API_KEY') ??
          this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(AI_NOT_CONFIGURED_RESPONSE);
    }

    const model = this.getOpenAiCompatibleModel(provider, source);
    const response = await fetch(this.getOpenAiCompatibleUrl(provider), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 900,
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logProviderError(provider, response, detail);
      throw new ServiceUnavailableException(
        this.isProviderQuotaResponse(response.status, detail)
          ? this.buildQuotaExceededResponse(detail)
          : AI_PROVIDER_ERROR_RESPONSE,
      );
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return this.normalizeAiText(data.choices?.[0]?.message?.content);
  }

  private async callGemini(prompt: string, source: ProviderCredentialSource) {
    const apiKey =
      source === 'fallback'
        ? this.configService.get<string>('AI_FALLBACK_API_KEY')
        : this.configService.get<string>('AI_API_KEY') ??
          this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(AI_NOT_CONFIGURED_RESPONSE);
    }

    const model =
      source === 'fallback'
        ? this.configService.get<string>('AI_FALLBACK_MODEL') ?? 'gemini-2.5-flash'
        : this.configService.get<string>('AI_MODEL') ??
          this.configService.get<string>('GEMINI_MODEL') ??
          'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 900 },
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      this.logProviderError('gemini', response, detail);
      throw new ServiceUnavailableException(
        this.isProviderQuotaResponse(response.status, detail)
          ? this.buildQuotaExceededResponse(detail)
          : AI_PROVIDER_ERROR_RESPONSE,
      );
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const answer = parts
      .map((part) => part.text)
      .filter((text): text is string => Boolean(text?.trim()))
      .join('\n')
      .trim();

    if (!answer) {
      throw new ServiceUnavailableException(AI_EMPTY_RESPONSE);
    }

    return this.normalizeAiText(answer);
  }

  private async callMock(_prompt: string) {
    return 'Modo de prueba activo. Puedo orientarte con el contexto resumido disponible, pero no estoy llamando a un proveedor externo.';
  }

  private normalizeAiText(text?: string) {
    const clean =
      typeof text === 'string'
        ? text.replace(/[<>]/g, '').trim().slice(0, 4000)
        : '';
    if (!clean) {
      throw new ServiceUnavailableException(AI_EMPTY_RESPONSE);
    }
    return clean;
  }

  private getProvider(configKey: string, fallback: AiProvider) {
    const value = (this.configService.get<string>(configKey) ?? fallback)
      .trim()
      .toLowerCase();
    return this.isSupportedProvider(value) ? value : fallback;
  }

  private isSupportedProvider(value: string): value is AiProvider {
    return ['openai', 'gemini', 'groq', 'openrouter', 'mock', 'none'].includes(
      value,
    );
  }

  private getOpenAiCompatibleUrl(provider: 'openai' | 'groq' | 'openrouter') {
    if (provider === 'groq') {
      return 'https://api.groq.com/openai/v1/chat/completions';
    }

    if (provider === 'openrouter') {
      return 'https://openrouter.ai/api/v1/chat/completions';
    }

    return 'https://api.openai.com/v1/chat/completions';
  }

  private getOpenAiCompatibleModel(
    provider: 'openai' | 'groq' | 'openrouter',
    source: ProviderCredentialSource,
  ) {
    if (source === 'fallback') {
      return (
        this.configService.get<string>('AI_FALLBACK_MODEL') ??
        (provider === 'groq' ? 'llama-3.1-8b-instant' : 'gpt-4o-mini')
      );
    }

    return (
      this.configService.get<string>('AI_MODEL') ??
      this.configService.get<string>('OPENAI_MODEL') ??
      (provider === 'groq' ? 'llama-3.1-8b-instant' : 'gpt-4o-mini')
    );
  }

  private isQuotaExceededError(error: unknown) {
    if (!(error instanceof ServiceUnavailableException)) return false;
    const response = error.getResponse();
    return (
      typeof response === 'object' &&
      response !== null &&
      'code' in response &&
      response.code === AI_PROVIDER_QUOTA_EXCEEDED_RESPONSE.code
    );
  }

  private isProviderQuotaResponse(status: number, detail: string) {
    return (
      status === 429 ||
      /RESOURCE_EXHAUSTED|quota\s+exceeded|cuota/i.test(detail)
    );
  }

  private extractRetryAfterSeconds(value: unknown) {
    const text =
      typeof value === 'string'
        ? value
        : value instanceof ServiceUnavailableException
          ? JSON.stringify(value.getResponse())
          : '';
    const match = text.match(/retry\s+in\s+(\d+(?:\.\d+)?)s/i);
    if (!match) return null;
    const seconds = Number(match[1]);
    return Number.isFinite(seconds) ? Math.ceil(seconds) : null;
  }

  private buildQuotaExceededResponse(source: unknown = null) {
    return {
      ...AI_PROVIDER_QUOTA_EXCEEDED_RESPONSE,
      retryAfterSeconds: this.extractRetryAfterSeconds(source),
    };
  }

  private ensureAiEnabled() {
    const enabled = (this.configService.get<string>('AI_ENABLED') ?? 'true')
      .trim()
      .toLowerCase();
    if (['false', '0', 'no', 'off'].includes(enabled)) {
      throw new ServiceUnavailableException(AI_DISABLED_RESPONSE);
    }
  }

  private isActionRequest(question: string) {
    return /\b(registra|registrar|crea|crear|elimina|eliminar|borra|borrar|cambia|cambiar|actualiza|actualizar|vende|comprar|compra|finaliza|finalizar)\b/i.test(
      question,
    );
  }

  private sanitizeUserQuestion(question: unknown) {
    const raw = typeof question === 'string' ? question : '';
    const removedSensitiveData = SENSITIVE_TEXT_PATTERN.test(raw);
    SENSITIVE_TEXT_PATTERN.lastIndex = 0;
    return {
      text: sanitizeAiText(raw, 500),
      removedSensitiveData,
    };
  }

  private removeSensitiveFields(value: unknown): { value: unknown; removed: number } {
    if (Array.isArray(value)) {
      let removed = 0;
      const items = value
        .map((item) => {
          const result = this.removeSensitiveFields(item);
          removed += result.removed;
          return result.value;
        })
        .filter((item) => item !== undefined);
      return { value: items, removed };
    }

    if (!value || typeof value !== 'object') {
      return { value, removed: 0 };
    }

    let removed = 0;
    const safe: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
      if (this.isSensitiveFieldName(key)) {
        removed += 1;
        continue;
      }

      const result = this.removeSensitiveFields(item);
      removed += result.removed;
      safe[key] = result.value;
    }

    return { value: safe, removed };
  }

  private isSensitiveFieldName(key: string) {
    const normalized = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return SENSITIVE_FIELD_NAMES.has(key) || SENSITIVE_FIELD_NAMES.has(normalized.toLowerCase());
  }

  private logSanitization(removed: number) {
    const nodeEnv = this.configService.get<string>('NODE_ENV') ?? 'development';
    if (removed > 0 && nodeEnv !== 'production') {
      console.info(`[ai-sanitize] removed sensitive fields: ${removed}`);
    }
  }

  private logContextKeys(label: string, context: Record<string, unknown>) {
    const nodeEnv = this.configService.get<string>('NODE_ENV') ?? 'development';
    if (nodeEnv !== 'production') {
      console.info(
        `[ai-context] ${label} context keys: ${JSON.stringify(
          Object.keys(context),
        )}`,
      );
    }
  }

  private logProviderError(provider: AiProvider, response: Response, detail: string) {
    const nodeEnv = this.configService.get<string>('NODE_ENV') ?? 'development';
    if (nodeEnv === 'production') return;

    console.warn(
      JSON.stringify({
        event: 'ai_provider_error',
        provider,
        status: response.status,
        statusText: response.statusText,
        code: this.isProviderQuotaResponse(response.status, detail)
          ? AI_PROVIDER_QUOTA_EXCEEDED_RESPONSE.code
          : AI_PROVIDER_ERROR_RESPONSE.code,
        retryAfterSeconds: this.extractRetryAfterSeconds(detail),
      }),
    );
  }

  private compactContext(context: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(context)
        .map(([key, value]) => {
          if (!value || typeof value !== 'object') {
            return [key, value] as const;
          }

          const section = Object.fromEntries(
            Object.entries(value).filter(([, sectionValue]) => {
              if (sectionValue === undefined || sectionValue === '') return false;
              if (Array.isArray(sectionValue) && sectionValue.length === 0) return false;
              return true;
            }),
          );

          return [key, Object.keys(section).length > 0 ? section : undefined] as const;
        })
        .filter(([, value]) => value !== undefined),
    );
  }
}
