import { App, Editor, Plugin, TFile } from 'obsidian';
import { AlembicSettings, AlembicWorkflow, DEFAULT_PROVIDERS, DEFAULT_SETTINGS, DEFAULT_WORKFLOWS_FOLDER, FREEFORM_WORKFLOW_ID, HUMANIZE_WORKFLOW_ID, TOKEN_CONTEXT, TOKEN_SELECTION, isFullNoteWorkflow } from './types';
import { WorkflowSelectorModal, FreeformModal } from './modal';
import { AlembicSettingTab } from './settings';
import { assembleUserMessage, runWithProvider, substituteTokens } from './runner';
import { ensureWorkflowsFolder, loadWorkflowsFromVault, writeDefaultWorkflows, writeWorkflowFile, defaultFilenameFor } from './workflow-loader';
import { alembicFlash, alembicRunNotice, WAIT_MESSAGES } from './notice';

/**
 * Recursively expands [[wikilinks]] found in `content` up to `depth` levels.
 * Each linked note's content is appended after the main content.
 * `visited` prevents the same file from being included more than once.
 */
async function expandLinkedNotes(
  app: App,
  content: string,
  depth: number,
  visited: Set<string> = new Set(),
): Promise<string> {
  if (depth === 0) return content;

  const wikiLinkRegex = /\[\[([^\]|#\n]+?)(?:[|#][^\]]*?)?\]\]/g;
  const appended: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = wikiLinkRegex.exec(content)) !== null) {
    const linkTarget = match[1].trim();
    const file = app.metadataCache.getFirstLinkpathDest(linkTarget, '');
    if (!file || visited.has(file.path)) continue;
    visited.add(file.path);
    const linked = await app.vault.read(file);
    const expanded = await expandLinkedNotes(app, linked, depth - 1, visited);
    appended.push(`\n\n---\n**Linked note: ${file.basename}**\n\n${expanded}`);
  }

  return content + appended.join('');
}

export default class AlembicPlugin extends Plugin {
  settings!: AlembicSettings;
  workflows: AlembicWorkflow[] = [];
  workflowFileMap: Map<string, TFile> = new Map();
  private lastSkipped = '';

  async onload(): Promise<void> {
    await this.loadSettings();

    // Ensure the workflows folder exists
    await ensureWorkflowsFolder(this.app, this.settings.workflowsFolder);

    // If legacy workflows exist in settings.json, migrate them to vault files.
    // Do this BEFORE writing defaults so we don't create duplicate IDs from two
    // different filename schemes.
    if (this.settings.workflows && this.settings.workflows.length > 0) {
      await this.migrateWorkflows(this.settings.workflows);
      delete this.settings.workflows;
      await this.saveSettings();
    } else {
      // No legacy data — seed defaults if the folder is empty
      const initial = await loadWorkflowsFromVault(this.app, this.settings.workflowsFolder);
      if (initial.workflows.length === 0) {
        await writeDefaultWorkflows(this.app, this.settings.workflowsFolder);
      }
    }

    // Load workflows from vault into memory
    await this.reloadWorkflows();

    this.addSettingTab(new AlembicSettingTab(this.app, this));

    // Watch vault for changes inside the workflows folder
    this.registerEvent(this.app.vault.on('create', f => {
      if (this.isWorkflowFile(f.path)) this.reloadWorkflows();
    }));
    this.registerEvent(this.app.vault.on('modify', f => {
      if (this.isWorkflowFile(f.path)) this.reloadWorkflows();
    }));
    this.registerEvent(this.app.vault.on('delete', f => {
      if (this.isWorkflowFile(f.path)) this.reloadWorkflows();
    }));
    this.registerEvent(this.app.vault.on('rename', (f, oldPath) => {
      if (this.isWorkflowFile(f.path) || this.isWorkflowFile(oldPath)) this.reloadWorkflows();
    }));

    // ── Workflow selector command ──────────────────────────────────────────────
    this.addCommand({
      id: 'open-workflow-selector',
      name: 'Run workflow',
      editorCallback: (editor: Editor) => {
        new WorkflowSelectorModal(
          this.app,
          this.workflows,
          (workflow) => this.executeWorkflow(editor, workflow)
        ).open();
      },
    });

    // ── Per-workflow direct commands ───────────────────────────────────────────
    // Registered at load time — reload plugin to pick up new workflow files
    for (const workflow of this.workflows) {
      this.registerWorkflowCommand(workflow);
    }
  }

  private isWorkflowFile(path: string): boolean {
    return path.startsWith(this.settings.workflowsFolder + '/') && path.endsWith('.md');
  }

  async reloadWorkflows(): Promise<void> {
    const { workflows, fileMap, skipped } = await loadWorkflowsFromVault(this.app, this.settings.workflowsFolder);
    this.workflows = workflows;
    this.workflowFileMap = fileMap;
    const skippedKey = skipped.join(',');
    if (skipped.length > 0 && skippedKey !== this.lastSkipped) {
      alembicFlash(`Skipped ${skipped.length} malformed workflow file(s): ${skipped.join(', ')}`, 8000, 'error');
    }
    this.lastSkipped = skippedKey;
  }

  private async migrateWorkflows(legacyWorkflows: AlembicWorkflow[]): Promise<void> {
    for (const wf of legacyWorkflows) {
      // Use the canonical numbered filename for known built-in IDs so the
      // display order in the sidebar is correct after migration.
      const filename = defaultFilenameFor(wf.id, wf.name);
      const path = `${this.settings.workflowsFolder}/${filename}`;
      if (!this.app.vault.getAbstractFileByPath(path)) {
        await writeWorkflowFile(this.app, this.settings.workflowsFolder, filename, wf);
      }
    }
  }

  private registerWorkflowCommand(workflow: AlembicWorkflow): void {
    const cmdId = `run-workflow-${workflow.id.replace(/[^a-z0-9]/gi, '-')}`;
    this.addCommand({
      id: cmdId,
      name: workflow.name,
      editorCallback: (editor: Editor) => {
        // Look up the live workflow data so edits to the .md file take effect immediately.
        // If the workflow was deleted, the command stays in the palette until plugin reload — bail gracefully.
        const live = this.workflows.find(w => w.id === workflow.id);
        if (!live) { alembicFlash('This workflow no longer exists. Reload the plugin to update the command palette.', 5000, 'error'); return; }
        if (live.id === FREEFORM_WORKFLOW_ID) {
          new FreeformModal(this.app, live, (prompt, humanize) => {
            this.executeWorkflow(editor, { ...live, prompt: `${TOKEN_CONTEXT}\n\n---\n\n${prompt}`, humanize });
          }).open();
        } else {
          this.executeWorkflow(editor, live);
        }
      },
    });
  }

  async executeWorkflow(editor: Editor, workflow: AlembicWorkflow): Promise<void> {
    const selection = editor.getSelection();
    const rawContext = editor.getValue();
    const context = workflow.linkDepth > 0
      ? await expandLinkedNotes(this.app, rawContext, workflow.linkDepth)
      : rawContext;

    // Save selection bounds NOW — editor state can change during the async wait
    // (user clicks elsewhere, modal focus shift, etc.).  We use these coordinates
    // with replaceRange() after the await instead of relying on live cursor state.
    const selFrom = editor.getCursor('from');
    const selTo   = editor.getCursor('to');
    const hasSelection = selection.trim().length > 0;

    if (!hasSelection && workflow.prompt.includes(TOKEN_SELECTION)) {
      alembicFlash('Select some text first — this workflow operates on a selection.', 5000);
      return;
    }

    const userMessage = assembleUserMessage(workflow, selection, context);

    if (!userMessage.trim()) {
      alembicFlash('Nothing to distill — add some text or select a passage.', 5000);
      return;
    }

    // Rough size check — warn if the combined context is very large.
    // ~4 chars per token is a conservative estimate; 100k chars ≈ 25k tokens.
    const totalChars = userMessage.length + workflow.systemPrompt.length;
    if (totalChars > 100_000) {
      const approxKb = Math.round(totalChars / 1024);
      if (!confirm(`The context being sent is ~${approxKb} KB (including linked notes). This may be slow or hit token limits. Continue?`)) return;
    }

    const profile = this.settings.providers.find(p => p.id === workflow.providerId)
      ?? this.settings.providers[0];

    if (!profile) {
      alembicFlash('No provider configured. Add one in Settings → Alembic → Providers.', 8000, 'error');
      return;
    }

    let msgIdx = 0;
    const run = alembicRunNotice(workflow.name);
    const ticker = setInterval(() => {
      msgIdx = (msgIdx + 1) % WAIT_MESSAGES.length;
      run.setStatus(WAIT_MESSAGES[msgIdx]);
    }, 7000);

    let cancelCurrent: (() => void) | null = null;
    run.addCancelButton(() => cancelCurrent?.());

    const finish = () => { clearInterval(ticker); run.hide(); };

    try {
      const resolvedWorkflow = { ...workflow, systemPrompt: substituteTokens(workflow.systemPrompt, selection, context) };
      const handle = runWithProvider(profile, resolvedWorkflow, userMessage);
      cancelCurrent = handle.cancel;
      let result = await handle.promise;

      if (result.cancelled) { finish(); alembicFlash('Stopped.', 3000); return; }
      if (result.error)     { finish(); alembicFlash(result.error, 8000, 'error'); return; }
      if (!result.output.trim()) { finish(); alembicFlash('The provider returned an empty response.', 5000, 'error'); return; }

      if (workflow.humanize) {
        run.setStatus('Humanizing…');
        const humanizeWorkflow = this.workflows.find(w => w.id === HUMANIZE_WORKFLOW_ID);
        if (humanizeWorkflow) {
          const humanizeProfile = this.settings.providers.find(p => p.id === humanizeWorkflow.providerId) ?? profile;
          const hHandle = runWithProvider(humanizeProfile, humanizeWorkflow, assembleUserMessage(humanizeWorkflow, result.output, ''));
          cancelCurrent = hHandle.cancel;
          const hResult = await hHandle.promise;
          if (hResult.cancelled) { finish(); alembicFlash('Stopped.', 3000); return; }
          if (!hResult.error) result = hResult;
        }
      }

      finish();
      if (workflow.replaceSelection && (hasSelection || isFullNoteWorkflow(workflow))) {
        if (hasSelection) {
          editor.replaceRange(result.output, selFrom, selTo);
        } else {
          // Full-note workflow (e.g. Lint, Add Structure) — replace entire document.
          const lastLine = editor.lastLine();
          editor.replaceRange(
            result.output,
            { line: 0, ch: 0 },
            { line: lastLine, ch: editor.getLine(lastLine).length },
          );
        }
      } else {
        editor.replaceRange(result.output, selTo);
      }
      alembicFlash(`${workflow.name} — done.`, 2500, 'success');
    } catch (err: unknown) {
      finish();
      alembicFlash(err instanceof Error ? err.message : String(err), 8000, 'error');
    }
  }

  async loadSettings(): Promise<void> {
    const saved = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);

    if (!this.settings.providers || this.settings.providers.length === 0) {
      this.settings.providers = DEFAULT_PROVIDERS;
    }

    if (!this.settings.workflowsFolder) {
      this.settings.workflowsFolder = DEFAULT_WORKFLOWS_FOLDER;
    }
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
