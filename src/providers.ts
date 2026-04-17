import { ProviderType } from './types';

/**
 * Static metadata for each provider type.
 * This is the single place to add a new provider — UI, hints, and defaults
 * are all driven from here. Runner logic in runner.ts is the only other file
 * that needs to know about a new type.
 */
export interface ProviderMeta {
  type: ProviderType;
  label: string;
  /** True for CLI-based providers (no HTTP, no model list). */
  isCli: boolean;
  needsApiKey: boolean;
  /**
   * If set, the Base URL field is shown pre-filled with this value.
   * Undefined = no base URL field (provider has a fixed endpoint).
   */
  defaultBaseUrl?: string;
  /** Placeholder / description for the model input. Empty = no model field. */
  modelHint: string;
  /** Pre-populated datalist suggestions shown before the user connects. */
  knownModels: string[];
}

export const PROVIDER_META: ProviderMeta[] = [
  {
    type: 'claude-cli',
    label: 'Claude CLI',
    isCli: true,
    needsApiKey: false,
    modelHint: '',
    knownModels: [],
  },
  {
    type: 'gemini-cli',
    label: 'Gemini CLI',
    isCli: true,
    needsApiKey: false,
    modelHint: '',
    knownModels: [],
  },
  {
    type: 'anthropic',
    label: 'Anthropic API',
    isCli: false,
    needsApiKey: true,
    modelHint: 'e.g. claude-opus-4-5, claude-sonnet-4-5',
    knownModels: ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-3-5'],
  },
  {
    type: 'openai',
    label: 'OpenAI API',
    isCli: false,
    needsApiKey: true,
    defaultBaseUrl: 'https://api.openai.com/v1',
    modelHint: 'e.g. gpt-4o, gpt-4o-mini, o3',
    knownModels: ['gpt-4o', 'gpt-4o-mini', 'o3', 'o3-mini', 'o1'],
  },
  {
    type: 'openrouter',
    label: 'OpenRouter',
    isCli: false,
    needsApiKey: true,
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    modelHint: 'e.g. anthropic/claude-sonnet-4-5, openai/gpt-4o',
    knownModels: [
      'anthropic/claude-sonnet-4-5',
      'openai/gpt-4o',
      'openai/gpt-4o-mini',
      'google/gemini-2.0-flash',
      'meta-llama/llama-3.3-70b-instruct',
    ],
  },
  {
    type: 'ollama',
    label: 'Ollama',
    isCli: false,
    needsApiKey: false,
    defaultBaseUrl: 'http://localhost:11434',
    modelHint: 'e.g. llama3.2, llama3.3:70b',
    knownModels: [],
  },
  {
    type: 'gemini',
    label: 'Gemini API',
    isCli: false,
    needsApiKey: true,
    modelHint: 'e.g. gemini-2.0-flash, gemini-1.5-pro',
    knownModels: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  },
];

export const PROVIDER_META_MAP: Record<ProviderType, ProviderMeta> =
  Object.fromEntries(PROVIDER_META.map(m => [m.type, m])) as Record<ProviderType, ProviderMeta>;
