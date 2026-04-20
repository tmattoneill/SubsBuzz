/**
 * LLM Provider Abstraction (TEEPER-139 / TEEPER-141)
 *
 * Resolves the correct provider config for a user, given their settings and
 * the current process env. DeepSeek is the system default (shared server key);
 * OpenAI is an opt-in per-user override.
 *
 * Both providers use the `openai` SDK — DeepSeek is OpenAI-API-compatible via
 * baseURL override. Adding Anthropic / Gemini / Grok / Ollama later means
 * extending `resolveProvider`'s switch (or refactoring to a registry when a
 * third provider lands).
 */

import OpenAI from 'openai';

export type ProviderId = 'deepseek' | 'openai';

export interface ProviderConfig {
  id: ProviderId;
  model: string;
  baseURL?: string;
  apiKey: string;
  /** Params spread into every chat.completions.create call for this provider. */
  extraParams: Record<string, unknown>;
}

export interface ProviderSelection {
  llmProvider?: ProviderId | null;
  openaiApiKey?: string | null;
}

export class ProviderConfigError extends Error {
  constructor(
    public readonly code: 'missing_key' | 'invalid_provider',
    message: string,
  ) {
    super(message);
    this.name = 'ProviderConfigError';
  }
}

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1';
const DEEPSEEK_MODEL = 'deepseek-chat';
const OPENAI_MODEL = 'gpt-5.4-nano';

export function resolveProvider(settings: ProviderSelection): ProviderConfig {
  const provider: ProviderId = settings.llmProvider ?? 'deepseek';

  if (provider === 'deepseek') {
    const apiKey = process.env.DEEPSEEK_API_KEY ?? '';
    if (!apiKey) {
      throw new ProviderConfigError(
        'missing_key',
        'DEEPSEEK_API_KEY is not set — cannot use DeepSeek provider',
      );
    }
    return {
      id: 'deepseek',
      model: DEEPSEEK_MODEL,
      baseURL: DEEPSEEK_BASE_URL,
      apiKey,
      extraParams: {},
    };
  }

  if (provider === 'openai') {
    const apiKey = settings.openaiApiKey || process.env.OPENAI_API_KEY || '';
    if (!apiKey) {
      throw new ProviderConfigError(
        'missing_key',
        'No OpenAI API key available (neither user setting nor OPENAI_API_KEY env)',
      );
    }
    return {
      id: 'openai',
      model: OPENAI_MODEL,
      apiKey,
      // gpt-5.4-nano defaults to reasoning mode. Without this, completions burn
      // the full token budget on internal reasoning and return empty content.
      extraParams: { reasoning_effort: 'none' },
    };
  }

  throw new ProviderConfigError(
    'invalid_provider',
    `Unknown llmProvider: ${String(provider)}`,
  );
}

export function getClient(cfg: ProviderConfig): OpenAI {
  return new OpenAI({
    apiKey: cfg.apiKey,
    ...(cfg.baseURL ? { baseURL: cfg.baseURL } : {}),
  });
}

/**
 * Spreads the provider's `extraParams` on top of the base completion params.
 * Base params win on conflicts (callers are explicit).
 */
export function mergeCompletionParams<T extends Record<string, unknown>>(
  base: T,
  cfg: ProviderConfig,
): T & Record<string, unknown> {
  return { ...cfg.extraParams, ...base };
}
