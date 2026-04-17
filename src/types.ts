// ── Provider profiles ────────────────────────────────────────────────────────

export type ProviderType = 'claude-cli' | 'gemini-cli' | 'anthropic' | 'openai' | 'openrouter' | 'ollama' | 'gemini';

export interface ProviderProfile {
  id: string;
  name: string;
  type: ProviderType;
  apiKey?: string;    // anthropic, gemini
  baseUrl?: string;   // ollama  e.g. http://SEDNA:11434
  model?: string;     // all except claude-cli
}

// ── Workflow ─────────────────────────────────────────────────────────────────

export interface AlembicWorkflow {
  id: string;
  name: string;
  systemPrompt: string;
  prompt: string;
  replaceSelection: boolean;
  humanize: boolean;
  providerId: string;   // references a ProviderProfile.id
}

// ── Settings ─────────────────────────────────────────────────────────────────

export interface AlembicSettings {
  providers: ProviderProfile[];
  workflowsFolder: string;
  /** @deprecated Workflows are now stored as vault .md files. Kept only for one-time migration. */
  workflows?: AlembicWorkflow[];
}

// ── Built-in provider ─────────────────────────────────────────────────────────

export const CLAUDE_CLI_PROVIDER_ID = 'default-claude-cli';

export const DEFAULT_PROVIDERS: ProviderProfile[] = [
  {
    id: CLAUDE_CLI_PROVIDER_ID,
    name: 'Claude CLI',
    type: 'claude-cli',
  },
];

// ── Workflows folder ──────────────────────────────────────────────────────────

export const DEFAULT_WORKFLOWS_FOLDER = '_alembic';

// ── Well-known workflow IDs ───────────────────────────────────────────────────
// These IDs are baked into the bundled .md files (workflows/ directory).
// Referenced in code for special-case behaviour: freeform prompt UI and the
// automatic humanize pass. Must not change between releases.

export const FREEFORM_WORKFLOW_ID = '__freeform__';
export const HUMANIZE_WORKFLOW_ID = '__humanize__';

// ── Repository ────────────────────────────────────────────────────────────────
// Update WORKFLOWS_REPO_API_URL once the plugin is published on GitHub.

export const WORKFLOWS_REPO_API_URL =
  'https://api.github.com/repos/sedetweiler/obsidian-alembic/contents/workflows';

// ── Default settings ──────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: AlembicSettings = {
  providers: DEFAULT_PROVIDERS,
  workflowsFolder: DEFAULT_WORKFLOWS_FOLDER,
};
