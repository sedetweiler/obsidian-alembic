import { spawn } from 'child_process';
import * as http from 'http';
import * as https from 'https';
import { AlembicWorkflow, ProviderProfile } from './types';

// GUI apps on macOS inherit a minimal PATH that excludes Homebrew and other
// common install locations. Augment it so CLI tools like `claude` and `gemini`
// can be found when spawned from Obsidian.
const AUGMENTED_PATH = [
  '/opt/homebrew/bin',   // Homebrew (Apple Silicon)
  '/usr/local/bin',      // Homebrew (Intel) / manual installs
  process.env.PATH ?? '',
].filter(Boolean).join(':');

// ── Token substitution ────────────────────────────────────────────────────────

export function substituteTokens(template: string, selection: string, context: string): string {
  return template
    .replace(/\{=SELECTION=\}/g, selection)
    .replace(/\{=CONTEXT=\}/g, context);
}

export function assembleUserMessage(
  workflow: AlembicWorkflow,
  selection: string,
  context: string
): string {
  if (workflow.prompt.trim() !== '') {
    return substituteTokens(workflow.prompt, selection, context);
  }
  const parts: string[] = [];
  if (selection.trim()) parts.push(selection);
  if (context.trim()) parts.push(context);
  return parts.join('\n\n');
}

// ── Result / handle types ─────────────────────────────────────────────────────

export interface RunResult {
  output: string;
  error?: string;
  cancelled?: boolean;
}

export interface RunHandle {
  promise: Promise<RunResult>;
  cancel: () => void;
}

// ── Error classifier ──────────────────────────────────────────────────────────

function classifyError(combined: string, rawMessage: string, code: number | null): string {
  if (
    combined.includes('rate limit') || combined.includes('rate_limit') ||
    combined.includes('too many requests') || combined.includes('429') ||
    combined.includes('usage limit') ||
    (combined.includes('exceeded') && combined.includes('limit')) ||
    combined.includes('quota')
  ) return 'Rate limit reached — please wait a few minutes and try again.';

  if (
    combined.includes('unauthorized') || combined.includes('401') ||
    combined.includes('api key') || combined.includes('not authenticated') ||
    combined.includes('not logged in')
  ) return 'Authentication failed — check your API key or credentials.';

  if (combined.includes('overloaded') || combined.includes('503'))
    return 'Service is overloaded right now — please try again shortly.';

  return rawMessage || `Exited with code ${code ?? 'unknown'}`;
}

// ── Node HTTP helper ──────────────────────────────────────────────────────────

function nodeRequest(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {}
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: options.method ?? 'GET',
        headers: { 'content-type': 'application/json', ...options.headers },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
      }
    );
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// ── Shared RunHandle factories ────────────────────────────────────────────────

/**
 * Wraps an HTTP-based runner: builds a cancellable RunHandle that resolves with
 * the result of `run()`. Cancellation resolves the promise with `cancelled: true`
 * and prevents the original resolution from taking effect.
 */
function httpRunHandle(run: () => Promise<RunResult>): RunHandle {
  let cancelled = false;
  let externalResolve!: (r: RunResult) => void;

  const promise = new Promise<RunResult>((resolve) => {
    externalResolve = resolve;
    run().then(result => {
      if (!cancelled) resolve(result);
    }).catch(err => {
      if (!cancelled) resolve({ output: '', error: (err as Error).message });
    });
  });

  return {
    promise,
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      externalResolve({ output: '', cancelled: true });
    },
  };
}

/**
 * Runs a CLI command, pipes `input` to stdin, and returns its stdout on success
 * or a classified error on non-zero exit. `notFoundMessage` is returned when the
 * binary cannot be found on PATH.
 */
function cliRunHandle(cmd: string, args: string[], input: string, notFoundMessage: string): RunHandle {
  let settled = false;
  let proc: ReturnType<typeof spawn> | null = null;
  let externalResolve!: (r: RunResult) => void;

  const promise = new Promise<RunResult>((resolve) => {
    externalResolve = resolve;
    const settle = (r: RunResult) => { if (!settled) { settled = true; resolve(r); } };

    try {
      proc = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, PATH: AUGMENTED_PATH } });
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException;
      settle({ output: '', error: e.code === 'ENOENT' ? notFoundMessage : (e.message ?? String(err)) });
      return;
    }

    let stdout = '';
    let stderr = '';
    proc.stdout!.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr!.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.stdin!.write(input, 'utf8');
    proc.stdin!.on('error', () => {});
    proc.stdin!.end();

    proc.on('error', (err: NodeJS.ErrnoException) => {
      settle({ output: '', error: err.code === 'ENOENT' ? notFoundMessage : err.message });
    });

    proc.on('close', (code: number | null) => {
      if (code === 0) {
        settle({ output: stdout.trim() });
      } else {
        const combined = (stderr + ' ' + stdout).toLowerCase();
        settle({ output: '', error: classifyError(combined, stderr.trim(), code) });
      }
    });
  });

  return {
    promise,
    cancel: () => {
      if (settled) return;
      settled = true;
      proc?.kill();
      externalResolve({ output: '', cancelled: true });
    },
  };
}

/** Shared HTTP POST + classifyError wrapper: parses JSON on 200, errors otherwise. */
async function postAndParse<T>(url: string, headers: Record<string, string>, body: unknown): Promise<{ parsed: T } | { error: string }> {
  const res = await nodeRequest(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (res.status !== 200) {
    return { error: classifyError(res.body.toLowerCase(), res.body, res.status) };
  }
  return { parsed: JSON.parse(res.body) as T };
}

// ── CLI runners ───────────────────────────────────────────────────────────────

function runCliClaude(systemPrompt: string, userMessage: string): RunHandle {
  const args = ['--print', '--output-format', 'text'];
  if (systemPrompt.trim()) args.push('--system-prompt', systemPrompt.trim());
  return cliRunHandle('claude', args, userMessage, 'Claude CLI not found.');
}

function runGeminiCli(systemPrompt: string, userMessage: string): RunHandle {
  const fullMessage = systemPrompt.trim()
    ? `${systemPrompt.trim()}\n\n${userMessage}`
    : userMessage;
  return cliRunHandle('gemini', [], fullMessage, 'Gemini CLI not found.');
}

// ── HTTP runners ──────────────────────────────────────────────────────────────

function runAnthropic(profile: ProviderProfile, systemPrompt: string, userMessage: string): RunHandle {
  return httpRunHandle(async () => {
    const body: Record<string, unknown> = {
      model: profile.model ?? 'claude-sonnet-4-5',
      max_tokens: 8192,
      messages: [{ role: 'user', content: userMessage }],
    };
    if (systemPrompt.trim()) body.system = systemPrompt.trim();

    const result = await postAndParse<{ content: { type: string; text: string }[] }>(
      'https://api.anthropic.com/v1/messages',
      { 'x-api-key': profile.apiKey ?? '', 'anthropic-version': '2023-06-01' },
      body,
    );
    if ('error' in result) return { output: '', error: result.error };
    return { output: result.parsed.content.filter(b => b.type === 'text').map(b => b.text).join('').trim() };
  });
}

function runGemini(profile: ProviderProfile, systemPrompt: string, userMessage: string): RunHandle {
  return httpRunHandle(async () => {
    const model = profile.model ?? 'gemini-2.0-flash';
    const key = profile.apiKey ?? '';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
    };
    if (systemPrompt.trim()) body.system_instruction = { parts: [{ text: systemPrompt.trim() }] };

    const result = await postAndParse<{ candidates: { content: { parts: { text: string }[] } }[] }>(
      url, {}, body,
    );
    if ('error' in result) return { output: '', error: result.error };
    return { output: result.parsed.candidates[0]?.content?.parts?.map(p => p.text).join('').trim() ?? '' };
  });
}

/** Builds the chat-completions messages array shared by Ollama and OpenAI-compatible APIs. */
function buildChatMessages(systemPrompt: string, userMessage: string): { role: string; content: string }[] {
  const messages: { role: string; content: string }[] = [];
  if (systemPrompt.trim()) messages.push({ role: 'system', content: systemPrompt.trim() });
  messages.push({ role: 'user', content: userMessage });
  return messages;
}

function runOllama(profile: ProviderProfile, systemPrompt: string, userMessage: string): RunHandle {
  return httpRunHandle(async () => {
    const base = (profile.baseUrl ?? 'http://localhost:11434').replace(/\/$/, '');
    const body = {
      model: profile.model ?? 'llama3.2',
      messages: buildChatMessages(systemPrompt, userMessage),
      stream: false,
    };
    const result = await postAndParse<{ choices: { message: { content: string } }[] }>(
      `${base}/v1/chat/completions`, {}, body,
    );
    if ('error' in result) return { output: '', error: result.error };
    return { output: result.parsed.choices[0]?.message?.content?.trim() ?? '' };
  });
}

/** Default base URL for OpenAI-compatible providers. */
function openAIBaseUrl(profile: ProviderProfile): string {
  const fallback = profile.type === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1';
  return (profile.baseUrl ?? fallback).replace(/\/$/, '');
}

function runOpenAICompatible(profile: ProviderProfile, systemPrompt: string, userMessage: string): RunHandle {
  return httpRunHandle(async () => {
    const headers: Record<string, string> = { 'Authorization': `Bearer ${profile.apiKey ?? ''}` };
    if (profile.type === 'openrouter') {
      headers['HTTP-Referer'] = 'obsidian://alembic';
      headers['X-Title'] = 'Alembic';
    }
    const body = {
      model: profile.model ?? 'gpt-4o',
      messages: buildChatMessages(systemPrompt, userMessage),
      stream: false,
    };
    const result = await postAndParse<{ choices: { message: { content: string } }[] }>(
      `${openAIBaseUrl(profile)}/chat/completions`, headers, body,
    );
    if ('error' in result) return { output: '', error: result.error };
    return { output: result.parsed.choices[0]?.message?.content?.trim() ?? '' };
  });
}

// ── Router ────────────────────────────────────────────────────────────────────

export function runWithProvider(
  profile: ProviderProfile,
  workflow: AlembicWorkflow,
  userMessage: string
): RunHandle {
  const sys = workflow.systemPrompt;
  switch (profile.type) {
    case 'anthropic':   return runAnthropic(profile, sys, userMessage);
    case 'ollama':      return runOllama(profile, sys, userMessage);
    case 'gemini':      return runGemini(profile, sys, userMessage);
    case 'gemini-cli':  return runGeminiCli(sys, userMessage);
    case 'openai':
    case 'openrouter':  return runOpenAICompatible(profile, sys, userMessage);
    case 'claude-cli':
    default:            return runCliClaude(sys, userMessage);
  }
}

// ── Model discovery ───────────────────────────────────────────────────────────

export interface ModelFetchResult {
  models: string[];
  error?: string;
}

/** Probes whether a CLI binary is on PATH by running `<cmd> --version`. */
function cliOnPath(cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, ['--version'], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PATH: AUGMENTED_PATH } });
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });
}

export async function fetchProviderModels(profile: ProviderProfile): Promise<ModelFetchResult> {
  try {
    switch (profile.type) {
      case 'claude-cli': {
        return (await cliOnPath('claude'))
          ? { models: [] }
          : { models: [], error: 'Claude CLI not found. Make sure it is installed and on your PATH.' };
      }
      case 'gemini-cli': {
        return (await cliOnPath('gemini'))
          ? { models: [] }
          : { models: [], error: 'Gemini CLI not found — install it from https://github.com/google-gemini/gemini-cli' };
      }
      case 'anthropic': {
        const res = await nodeRequest('https://api.anthropic.com/v1/models', {
          headers: { 'x-api-key': profile.apiKey ?? '', 'anthropic-version': '2023-06-01' },
        });
        if (res.status !== 200) return { models: [], error: `API error ${res.status}` };
        const json = JSON.parse(res.body) as { data: { id: string }[] };
        return { models: json.data.map(m => m.id) };
      }
      case 'ollama': {
        const base = (profile.baseUrl ?? 'http://localhost:11434').replace(/\/$/, '');
        const res = await nodeRequest(`${base}/api/tags`);
        if (res.status !== 200) return { models: [], error: `Could not reach Ollama at ${base} (HTTP ${res.status})` };
        const json = JSON.parse(res.body) as { models: { name: string }[] };
        return { models: json.models.map(m => m.name) };
      }
      case 'gemini': {
        const res = await nodeRequest(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${profile.apiKey ?? ''}`
        );
        if (res.status !== 200) return { models: [], error: `API error ${res.status}` };
        const json = JSON.parse(res.body) as { models: { name: string }[] };
        return { models: json.models.map(m => m.name.replace(/^models\//, '')) };
      }
      case 'openai':
      case 'openrouter': {
        const res = await nodeRequest(`${openAIBaseUrl(profile)}/models`, {
          headers: { 'Authorization': `Bearer ${profile.apiKey ?? ''}` },
        });
        if (res.status !== 200) return { models: [], error: `API error ${res.status}` };
        const json = JSON.parse(res.body) as { data: { id: string }[] };
        return { models: json.data.map(m => m.id).sort() };
      }
      default:
        return { models: [] };
    }
  } catch (err: unknown) {
    return { models: [], error: (err as Error).message ?? String(err) };
  }
}
