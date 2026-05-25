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

type AiProvider = 'openai' | 'gemini' | 'mock' | 'none';

export const AI_NOT_CONFIGURED_MESSAGE = 'Servicio de IA no configurado.';
const AI_NOT_CONFIGURED_RESPONSE = {
  code: 'AI_SERVICE_NOT_CONFIGURED',
  message: AI_NOT_CONFIGURED_MESSAGE,
};
const AI_PROVIDER_ERROR_RESPONSE = {
  code: 'AI_PROVIDER_ERROR',
  message: 'No pude generar una respuesta en este momento.',
};

const SYSTEM_PROMPT =
  'Eres el asistente inteligente de CaféSmart. Ayudas a interpretar inventario, compras, ventas, gastos, secado, utilidad y sincronización offline. Solo puedes responder con base en el contexto resumido recibido. No inventes datos. No solicites ni almacenes datos sensibles. No pidas contraseñas, documentos, teléfonos, correos ni tokens. No puedes modificar información del sistema. Solo puedes explicar, orientar y recomendar. Si faltan datos, responde: "No tengo suficiente información para analizar eso todavía." Si el usuario pide modificar datos, responde: "No puedo realizar esa acción directamente, pero puedo orientarte paso a paso." Responde en español, con tono claro y profesional, en máximo 4 párrafos cortos.';

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
    ].join('\n\n');

    return { answer: await this.callAiProvider(prompt) };
  }

  async generateFinancialAnalysis(dto: FinancialAnalysisDto) {
    const context = this.sanitizeContext(dto.context);
    const hasContext = Object.keys(context).length > 0;

    if (!hasContext) {
      return {
        answer:
          'No tengo suficiente información guardada para analizar eso todavía.',
      };
    }

    const prompt = [
      SYSTEM_PROMPT,
      'Genera un análisis del negocio con tres bloques breves: Resumen, Puntos de atención y Recomendaciones.',
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
    });
  }

  private async callAiProvider(prompt: string) {
    const provider = (this.configService.get<string>('AI_PROVIDER') ?? 'none').toLowerCase() as AiProvider;

    if (provider === 'gemini') {
      return this.callGemini(prompt);
    }

    if (provider === 'mock') {
      return this.callMock(prompt);
    }

    if (provider === 'none') {
      throw new ServiceUnavailableException(AI_NOT_CONFIGURED_RESPONSE);
    }

    return this.callOpenAi(prompt);
  }

  private async callOpenAi(prompt: string) {
    const apiKey =
      this.configService.get<string>('AI_API_KEY') ??
      this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(AI_NOT_CONFIGURED_RESPONSE);
    }

    const model =
      this.configService.get<string>('AI_MODEL') ??
      this.configService.get<string>('OPENAI_MODEL') ??
      'gpt-4o-mini';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
        max_tokens: 450,
      }),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(AI_PROVIDER_ERROR_RESPONSE);
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return this.normalizeAiText(data.choices?.[0]?.message?.content);
  }

  private async callGemini(prompt: string) {
    const apiKey =
      this.configService.get<string>('AI_API_KEY') ??
      this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(AI_NOT_CONFIGURED_RESPONSE);
    }

    const model =
      this.configService.get<string>('AI_MODEL') ??
      this.configService.get<string>('GEMINI_MODEL') ??
      'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 450 },
      }),
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(AI_PROVIDER_ERROR_RESPONSE);
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return this.normalizeAiText(data.candidates?.[0]?.content?.parts?.[0]?.text);
  }

  private async callMock(_prompt: string) {
    return 'Modo de prueba activo. Puedo orientarte con el contexto resumido disponible, pero no estoy llamando a un proveedor externo.';
  }

  private normalizeAiText(text?: string) {
    const clean = sanitizeAiText(text, 1600);
    return clean || 'No pude generar una respuesta en este momento. Intenta nuevamente.';
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
      console.info(`[ai-sanitize] sensitive fields removed: ${removed}`);
    }
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
