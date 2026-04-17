import { Editor, Plugin, TFile } from 'obsidian';
import { AlembicSettings, AlembicWorkflow, CLAUDE_CLI_PROVIDER_ID, DEFAULT_PROVIDERS, DEFAULT_SETTINGS, DEFAULT_WORKFLOWS_FOLDER, FREEFORM_WORKFLOW_ID, HUMANIZE_WORKFLOW_ID } from './types';
import { WorkflowSelectorModal, FreeformModal } from './modal';
import { AlembicSettingTab } from './settings';
import { assembleUserMessage, runWithProvider } from './runner';
import { ensureWorkflowsFolder, loadWorkflowsFromVault, writeDefaultWorkflows, writeWorkflowFile, defaultFilenameFor } from './workflow-loader';
import { alembicFlash, alembicRunNotice, WAIT_MESSAGES } from './notice';

export default class AlembicPlugin extends Plugin {
  settings!: AlembicSettings;
  workflows: AlembicWorkflow[] = [];
  workflowFileMap: Map<string, TFile> = new Map();

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
    const { workflows, fileMap } = await loadWorkflowsFromVault(this.app, this.settings.workflowsFolder);
    this.workflows = workflows;
    this.workflowFileMap = fileMap;
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
        // Look up the live workflow data so edits to the .md file take effect immediately
        const live = this.workflows.find(w => w.id === workflow.id) ?? workflow;
        if (live.id === FREEFORM_WORKFLOW_ID) {
          new FreeformModal(this.app, live, (prompt, humanize) => {
            this.executeWorkflow(editor, { ...live, prompt: `{=CONTEXT=}\n\n---\n\n${prompt}`, humanize });
          }).open();
        } else {
          this.executeWorkflow(editor, live);
        }
      },
    });
  }

  async executeWorkflow(editor: Editor, workflow: AlembicWorkflow): Promise<void> {
    const selection = editor.getSelection();
    const context = editor.getValue();

    // Save selection bounds NOW — editor state can change during the async wait
    // (user clicks elsewhere, modal focus shift, etc.).  We use these coordinates
    // with replaceRange() after the await instead of relying on live cursor state.
    const selFrom = editor.getCursor('from');
    const selTo   = editor.getCursor('to');
    const hasSelection = selection.trim().length > 0;

    const userMessage = assembleUserMessage(workflow, selection, context);

    if (!userMessage.trim()) {
      alembicFlash('Nothing to distill — add some text or select a passage.', 5000);
      return;
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
      const handle = runWithProvider(profile, workflow, userMessage);
      cancelCurrent = handle.cancel;
      let result = await handle.promise;

      if (result.cancelled) { finish(); alembicFlash('Stopped.', 3000); return; }
      if (result.error)     { finish(); alembicFlash(result.error, 8000, 'error'); return; }

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
      if (workflow.replaceSelection) {
        if (hasSelection) {
          // Replace the text that was selected at call time.
          // replaceRange uses saved coordinates, not live editor state.
          editor.replaceRange(result.output, selFrom, selTo);
        } else {
          // No selection — this is a full-note workflow (e.g. Lint, Add Structure).
          // Replace from line 0 to the last character of the last line.
          const lastLine = editor.lastLine();
          editor.replaceRange(
            result.output,
            { line: 0, ch: 0 },
            { line: lastLine, ch: editor.getLine(lastLine).length },
          );
        }
      } else {
        // Use the saved cursor position — live getCursor('to') would reflect
        // wherever the user clicked during the async wait.
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
