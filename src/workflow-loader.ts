import { App, parseYaml, requestUrl, TFile, TFolder } from 'obsidian';
import { AlembicWorkflow, CLAUDE_CLI_PROVIDER_ID } from './types';
import BUNDLED_WORKFLOWS from 'alembic:default-workflows';

// ── Default filenames (numeric prefix controls display order) ─────────────────

const DEFAULT_FILENAMES: Record<string, string> = {
  '__freeform__':            'Ask Claude.md',
  'default-lint':            'Lint.md',
  'default-fix-writing':     'Fix My Writing.md',
  'default-tighten':         'Tighten This Up.md',
  'default-summarize':       'Summarize.md',
  'default-action-items':    'Extract Action Items.md',
  'default-add-structure':   'Add Structure.md',
  'default-expand':          'Expand This.md',
  'default-continue':        'Continue Writing.md',
  'default-copywriting':     'Copywriting.md',
  'continue-prompted':       'Contextual Prompt.md',
  'default-devils-advocate': 'Devils Advocate.md',
  'default-key-terms':       'Extract Key Terms.md',
  'default-to-table':        'Convert to Table.md',
  '__humanize__':            'Humanize.md',
};

// ── Serialization ─────────────────────────────────────────────────────────────

export function workflowToMarkdown(workflow: AlembicWorkflow): string {
  const lines = [
    '---',
    `name: ${JSON.stringify(workflow.name)}`,
    `id: ${JSON.stringify(workflow.id)}`,
    `prompt: ${JSON.stringify(workflow.prompt)}`,
    `replaceSelection: ${workflow.replaceSelection}`,
    `humanize: ${workflow.humanize}`,
    `providerId: ${JSON.stringify(workflow.providerId)}`,
    `linkDepth: ${workflow.linkDepth}`,
    '---',
    '',
    workflow.systemPrompt,
  ];
  return lines.join('\n');
}

export function markdownToWorkflow(content: string): AlembicWorkflow | null {
  const normalized = content.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');
  if (lines[0] !== '---') return null;

  const closeIdx = lines.findIndex((line, i) => i > 0 && line === '---');
  if (closeIdx === -1) return null;

  try {
    const fm = parseYaml(lines.slice(1, closeIdx).join('\n')) as Record<string, unknown>;
    const id = fm.id != null ? String(fm.id) : '';
    if (!id) return null;

    const body = lines.slice(closeIdx + 1).join('\n').replace(/^\n/, '');

    const rawDepth = fm.linkDepth != null ? Number(fm.linkDepth) : 1;
    return {
      id,
      name:            fm.name        != null ? String(fm.name)        : 'Unnamed',
      systemPrompt:    body,
      prompt:          fm.prompt      != null ? String(fm.prompt)      : '',
      replaceSelection: Boolean(fm.replaceSelection),
      humanize:        Boolean(fm.humanize),
      providerId:      fm.providerId  != null ? String(fm.providerId)  : CLAUDE_CLI_PROVIDER_ID,
      linkDepth:       Math.min(3, Math.max(0, isNaN(rawDepth) ? 0 : rawDepth)),
    };
  } catch {
    return null;
  }
}

// ── Vault I/O ─────────────────────────────────────────────────────────────────

export interface WorkflowLoadResult {
  workflows: AlembicWorkflow[];
  fileMap: Map<string, TFile>; // workflow.id → TFile
  skipped: string[];           // filenames that failed to parse
}

export async function loadWorkflowsFromVault(app: App, folder: string): Promise<WorkflowLoadResult> {
  const folderNode = app.vault.getAbstractFileByPath(folder);
  if (!(folderNode instanceof TFolder)) {
    return { workflows: [], fileMap: new Map(), skipped: [] };
  }

  const files = app.vault.getFiles()
    .filter(f => f.parent === folderNode && f.extension === 'md')
    .sort((a, b) => a.name.localeCompare(b.name));

  const workflows: AlembicWorkflow[] = [];
  const fileMap = new Map<string, TFile>();
  const seenIds = new Set<string>();
  const skipped: string[] = [];

  for (const file of files) {
    const content = await app.vault.read(file);
    const wf = markdownToWorkflow(content);
    if (wf && !seenIds.has(wf.id)) {
      seenIds.add(wf.id);
      workflows.push(wf);
      fileMap.set(wf.id, file);
    } else if (!wf) {
      skipped.push(file.name);
    }
  }

  return { workflows, fileMap, skipped };
}

/** Write a workflow to a vault file. Creates the file if it doesn't exist, updates it if it does. */
export async function writeWorkflowFile(
  app: App,
  folder: string,
  filename: string,
  workflow: AlembicWorkflow
): Promise<TFile> {
  const path = `${folder}/${filename}`;
  const content = workflowToMarkdown(workflow);
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) {
    await app.vault.modify(existing, content);
    return existing;
  }
  return app.vault.create(path, content);
}

/** Ensure the folder exists. Returns true if it had to be created. */
export async function ensureWorkflowsFolder(app: App, folder: string): Promise<boolean> {
  const existing = app.vault.getAbstractFileByPath(folder);
  if (existing instanceof TFolder) return false;
  try {
    await app.vault.createFolder(folder);
    return true;
  } catch (e) {
    // Vault may not be fully indexed yet at plugin load time — if the folder
    // already exists, getAbstractFileByPath returns null but createFolder throws.
    if ((e as Error).message?.includes('already exists')) return false;
    throw e;
  }
}

/**
 * Write all default workflows to the vault folder, skipping any that already
 * exist. Content comes verbatim from the workflows/ directory bundled at build
 * time — no round-tripping through TypeScript objects.
 */
export async function writeDefaultWorkflows(app: App, folder: string): Promise<void> {
  for (const [filename, content] of Object.entries(BUNDLED_WORKFLOWS)) {
    const path = `${folder}/${filename}`;
    if (!app.vault.getAbstractFileByPath(path)) {
      try {
        await app.vault.create(path, content);
      } catch (e) {
        // Vault index may not be fully ready at load time — skip files that
        // already exist but weren't visible via getAbstractFileByPath yet.
        if (!(e as Error).message?.includes('already exists')) throw e;
      }
    }
  }
}

/** Returns true if the workflow ID belongs to a built-in default workflow. */
export function isDefaultWorkflow(workflowId: string): boolean {
  return workflowId in DEFAULT_FILENAMES;
}

/**
 * Overwrites a built-in workflow file with the version bundled at build time.
 * Returns false if the workflow ID is not a known default.
 */
export async function resetWorkflowToDefault(
  app: App,
  folder: string,
  workflowId: string,
): Promise<boolean> {
  const filename = DEFAULT_FILENAMES[workflowId];
  if (!filename) return false;
  const content = (BUNDLED_WORKFLOWS as Record<string, string>)[filename];
  if (!content) return false;
  const path = `${folder}/${filename}`;
  const existing = app.vault.getAbstractFileByPath(path);
  if (existing instanceof TFile) {
    await app.vault.modify(existing, content);
  } else {
    await app.vault.create(path, content);
  }
  return true;
}

export interface PullResult {
  added: string[];
  error?: string;
}

/**
 * Fetches the plugin's workflows/ directory from GitHub and writes any .md
 * files that do not already exist in the vault. Never overwrites existing files.
 */
export async function pullNewWorkflowsFromRepo(
  app: App,
  folder: string,
  apiUrl: string,
): Promise<PullResult> {
  try {
    const listing = await requestUrl({
      url: apiUrl,
      headers: { 'User-Agent': 'obsidian-alembic' },
    });

    // GitHub returns a JSON object (not array) on error, e.g. {"message":"Not Found"}
    const body = listing.json;
    if (!Array.isArray(body)) {
      const msg = (body as { message?: string })?.message ?? `HTTP ${listing.status}`;
      return { added: [], error: msg };
    }

    const files = body as { name: string; download_url: string; type: string }[];
    const mdFiles = files.filter(f => f.type === 'file' && f.name.endsWith('.md'));

    const added: string[] = [];
    for (const file of mdFiles) {
      const path = `${folder}/${file.name}`;
      if (!app.vault.getAbstractFileByPath(path)) {
        if (!file.download_url?.startsWith('https://raw.githubusercontent.com/')) continue;
        const raw = await requestUrl({ url: file.download_url });
        await app.vault.create(path, raw.text);
        added.push(file.name.replace(/\.md$/, ''));
      }
    }
    return { added };
  } catch (err) {
    // requestUrl throws the response object (not an Error) on 4xx/5xx.
    // Extract the status code if present, otherwise fall back to the message.
    const status = (err as { status?: number })?.status;
    if (status !== undefined) {
      return { added: [], error: `HTTP ${status}` };
    }
    return { added: [], error: (err as Error).message ?? String(err) };
  }
}

/** Strip characters that are invalid in vault file names. */
export function safeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|#\^[\]]/g, '').trim();
}

/**
 * Returns the canonical filename for a workflow: uses the numbered default name
 * for built-in IDs, otherwise derives one from the workflow name.
 */
export function defaultFilenameFor(workflowId: string, workflowName: string): string {
  return DEFAULT_FILENAMES[workflowId] ?? safeFilename(workflowName) + '.md';
}
