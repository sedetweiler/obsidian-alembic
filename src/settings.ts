import { App, PluginSettingTab, TFile, TFolder } from 'obsidian';
import { alembicFlash } from './notice';
import { AlembicWorkflow, ProviderProfile, ProviderType, CLAUDE_CLI_PROVIDER_ID, FREEFORM_WORKFLOW_ID, HUMANIZE_WORKFLOW_ID, DEFAULT_WORKFLOWS_FOLDER, WORKFLOWS_REPO_API_URL } from './types';
import { PROVIDER_META, PROVIDER_META_MAP } from './providers';
import { fetchProviderModels } from './runner';
import { writeWorkflowFile, writeDefaultWorkflows, ensureWorkflowsFolder, safeFilename, isDefaultWorkflow, resetWorkflowToDefault, pullNewWorkflowsFromRepo } from './workflow-loader';
import type AlembicPlugin from './main';

type Tab = 'workflows' | 'providers';

export class AlembicSettingTab extends PluginSettingTab {
  plugin: AlembicPlugin;
  private activeTab: Tab = 'workflows';
  private activeWorkflowId: string | null = null;
  private activeProviderId: string | null = null;

  constructor(app: App, plugin: AlembicPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('alembic-settings');

    // ── Tab bar ──
    const tabBar = containerEl.createDiv('alembic-tab-bar');
    (['workflows', 'providers'] as Tab[]).forEach(tab => {
      const btn = tabBar.createEl('button', {
        text: tab === 'workflows' ? 'Workflows' : 'Providers',
        cls: 'alembic-tab-btn' + (this.activeTab === tab ? ' alembic-tab-active' : ''),
      });
      btn.addEventListener('click', () => {
        this.activeTab = tab;
        this.display();
      });
    });

    const discordLink = tabBar.createEl('a', { cls: 'alembic-discord-link' });
    discordLink.href = 'https://discord.gg/Y68Z7EJe9R';
    discordLink.target = '_blank';
    discordLink.rel = 'noopener noreferrer';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.classList.add('alembic-discord-icon');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.034.055a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z');
    svg.appendChild(path);
    discordLink.appendChild(svg);
    discordLink.appendText('Join our Discord!');

    // ── Workflows folder bar (workflows tab only) ──
    if (this.activeTab === 'workflows') {
      const folderBar = containerEl.createDiv('alembic-folder-bar');
      folderBar.createSpan({ text: 'Workflows folder:', cls: 'alembic-folder-bar-label' });
      const folderInput = folderBar.createEl('input', { type: 'text', cls: 'alembic-input alembic-folder-bar-input' });
      folderInput.value = this.plugin.settings.workflowsFolder;
      folderInput.placeholder = '_alembic';
      const changeBtn = folderBar.createEl('button', { text: 'Change', cls: 'alembic-connect-btn' });
      changeBtn.addEventListener('click', async () => {
        const newFolder = folderInput.value.trim();
        if (!newFolder || newFolder === this.plugin.settings.workflowsFolder) return;
        await this.changeWorkflowsFolder(newFolder);
      });
      // Allow Enter key to submit
      folderInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          const newFolder = folderInput.value.trim();
          if (!newFolder || newFolder === this.plugin.settings.workflowsFolder) return;
          await this.changeWorkflowsFolder(newFolder);
        }
      });
    }

    const layout = containerEl.createDiv('alembic-layout');
    const sidebar = layout.createDiv('alembic-sidebar');
    const detail = layout.createDiv('alembic-detail');

    if (this.activeTab === 'workflows') {
      this.renderWorkflowSidebar(sidebar);
      this.renderWorkflowDetail(detail);
    } else {
      this.renderProviderSidebar(sidebar);
      this.renderProviderDetail(detail);
    }
  }

  private async changeWorkflowsFolder(newFolder: string): Promise<void> {
    const oldFolder = this.plugin.settings.workflowsFolder;
    const oldNode = this.app.vault.getAbstractFileByPath(oldFolder);

    if (oldNode instanceof TFolder) {
      try {
        await this.app.vault.rename(oldNode, newFolder);
      } catch {
        // Parent path may not exist — create the new folder and tell the user
        // to move their files manually.
        await ensureWorkflowsFolder(this.app, newFolder);
        alembicFlash(
          `Could not rename automatically. Move your files from "${oldFolder}" to "${newFolder}" manually.`,
          10000,
          'error'
        );
      }
    } else {
      await ensureWorkflowsFolder(this.app, newFolder);
    }

    this.plugin.settings.workflowsFolder = newFolder;
    await this.plugin.saveSettings();
    await this.plugin.reloadWorkflows();
    this.display();
  }

  // ── Shared field helpers ──────────────────────────────────────────────────

  private createField(parent: HTMLElement, label: string, description?: string): HTMLDivElement {
    const group = parent.createDiv('alembic-field');
    group.createEl('label', { text: label, cls: 'alembic-field-label' });
    if (description) group.createEl('p', { text: description, cls: 'alembic-field-desc' });
    return group;
  }

  private createToggle(
    parent: HTMLElement,
    label: string,
    description: string,
    value: boolean,
    onChange: (v: boolean) => void
  ): void {
    const field = this.createField(parent, label, description);
    const lbl = field.createEl('label', { cls: 'alembic-toggle-row' });
    const cb = lbl.createEl('input', { type: 'checkbox' });
    cb.checked = value;
    cb.classList.add('alembic-checkbox');
    const span = lbl.createSpan({ text: value ? 'On' : 'Off', cls: 'alembic-toggle-text' });
    cb.addEventListener('change', () => {
      onChange(cb.checked);
      span.textContent = cb.checked ? 'On' : 'Off';
    });
  }

  // ── Workflows tab ─────────────────────────────────────────────────────────

  private renderWorkflowSidebar(sidebar: HTMLElement): void {
    const header = sidebar.createDiv('alembic-sidebar-header');
    header.createSpan({ text: 'Workflows', cls: 'alembic-sidebar-title' });

    const addBtn = header.createEl('button', { text: '+', cls: 'alembic-add-btn' });
    addBtn.addEventListener('click', async () => {
      const folder = this.plugin.settings.workflowsFolder;
      // Find a unique filename
      let filename = 'New Workflow.md';
      let counter = 1;
      while (this.app.vault.getAbstractFileByPath(`${folder}/${filename}`)) {
        filename = `New Workflow ${++counter}.md`;
      }
      const newWorkflow: AlembicWorkflow = {
        id: crypto.randomUUID(),
        name: 'New Workflow',
        systemPrompt: '',
        prompt: '',
        replaceSelection: false,
        humanize: false,
        providerId: CLAUDE_CLI_PROVIDER_ID,
        linkDepth: 0,
      };
      await writeWorkflowFile(this.app, folder, filename, newWorkflow);
      await this.plugin.reloadWorkflows();
      this.activeWorkflowId = newWorkflow.id;
      this.display();
    });

    if (!this.activeWorkflowId && this.plugin.workflows.length > 0) {
      this.activeWorkflowId = this.plugin.workflows[0].id;
    }

    const list = sidebar.createEl('ul', { cls: 'alembic-sidebar-list' });
    this.plugin.workflows.forEach(w => {
      const item = list.createEl('li', {
        text: w.name,
        cls: 'alembic-sidebar-item' + (w.id === this.activeWorkflowId ? ' alembic-active' : ''),
      });
      item.addEventListener('click', () => { this.activeWorkflowId = w.id; this.display(); });
    });

    const restoreBtn = sidebar.createEl('button', { text: 'Restore defaults', cls: 'alembic-restore-btn' });
    restoreBtn.addEventListener('click', async () => {
      if (restoreBtn.textContent === 'Restore defaults') {
        restoreBtn.textContent = 'Are you sure?';
        restoreBtn.addClass('alembic-restore-btn-confirm');
        setTimeout(() => {
          if (restoreBtn.isConnected) {
            restoreBtn.textContent = 'Restore defaults';
            restoreBtn.removeClass('alembic-restore-btn-confirm');
          }
        }, 3000);
        return;
      }
      await writeDefaultWorkflows(this.app, this.plugin.settings.workflowsFolder);
      await this.plugin.reloadWorkflows();
      this.activeWorkflowId = this.plugin.workflows[0]?.id ?? null;
      this.display();
    });

    const pullBtn = sidebar.createEl('button', { text: '↓ Pull new workflows', cls: 'alembic-restore-btn' });
    pullBtn.addEventListener('click', async () => {
      pullBtn.textContent = 'Checking…';
      pullBtn.disabled = true;
      const result = await pullNewWorkflowsFromRepo(
        this.app,
        this.plugin.settings.workflowsFolder,
        WORKFLOWS_REPO_API_URL,
      );
      pullBtn.disabled = false;
      pullBtn.textContent = '↓ Pull new workflows';
      if (result.error) {
        alembicFlash(`Could not reach the repository: ${result.error}`, 6000, 'error');
        return;
      }
      if (result.added.length === 0) {
        alembicFlash('Already up to date.', 3000);
        return;
      }
      await this.plugin.reloadWorkflows();
      this.display();
      alembicFlash(
        `Added ${result.added.length} workflow${result.added.length !== 1 ? 's' : ''}: ${result.added.join(', ')}.`,
        5000,
        'success',
      );
    });
  }

  private renderWorkflowDetail(detail: HTMLElement): void {
    const workflows = this.plugin.workflows;
    if (workflows.length === 0) {
      detail.createEl('p', { text: 'No workflows yet. Click + to create one.', cls: 'alembic-empty-detail' });
      return;
    }

    const workflow = workflows.find(w => w.id === this.activeWorkflowId) ?? workflows[0];
    const draft: AlembicWorkflow = { ...workflow };

    // ── Open in editor button ──
    const openRow = detail.createDiv('alembic-open-row');
    const tfile = this.plugin.workflowFileMap.get(workflow.id);
    if (tfile) {
      const openBtn = openRow.createEl('button', { text: '↗ Open in editor', cls: 'alembic-connect-btn' });
      openBtn.addEventListener('click', () => {
        this.app.workspace.getLeaf('tab').openFile(tfile);
      });
    }
    openRow.createSpan({ text: tfile ? tfile.path : '', cls: 'alembic-file-path' });

    // Name
    const nameField = this.createField(detail, 'Workflow Name');
    const nameInput = nameField.createEl('input', { type: 'text', cls: 'alembic-input' });
    nameInput.value = draft.name;
    nameInput.addEventListener('input', () => { draft.name = nameInput.value; });

    // Provider
    const providers = this.plugin.settings.providers;
    if (providers.length > 0) {
      const provField = this.createField(detail, 'Provider', 'Which AI backend runs this workflow.');
      const provSelect = provField.createEl('select', { cls: 'alembic-select' });
      providers.forEach(p => {
        const opt = provSelect.createEl('option', { text: p.name, value: p.id });
        if (p.id === draft.providerId) opt.selected = true;
      });
      provSelect.addEventListener('change', () => { draft.providerId = provSelect.value; });
    }

    // System Prompt
    const sysField = this.createField(detail, 'System Prompt', "Optional. Sets the AI's role and rules for this workflow. Also editable directly in the .md file.");
    const sysArea = sysField.createEl('textarea', { cls: 'alembic-textarea' });
    sysArea.placeholder = 'You are a helpful assistant.';
    sysArea.value = draft.systemPrompt;
    sysArea.addEventListener('input', () => { draft.systemPrompt = sysArea.value; });

    // Prompt — hidden for freeform workflow since it's entered at run time
    if (workflow.id !== FREEFORM_WORKFLOW_ID) {
      const promptField = this.createField(detail, 'Prompt', 'Optional. Use {=SELECTION=} and {=CONTEXT=} as placeholders. If blank, sends available selection and note content automatically.');
      const promptArea = promptField.createEl('textarea', { cls: 'alembic-textarea' });
      promptArea.value = draft.prompt;
      promptArea.addEventListener('input', () => { draft.prompt = promptArea.value; });
    } else {
      this.createField(detail, 'Prompt', 'The prompt is entered by the user at run time via the text input popup.');
    }

    // Replace selection
    this.createToggle(detail, 'Replace selection', 'Off = insert result at cursor position.', draft.replaceSelection, v => { draft.replaceSelection = v; });

    // Humanize
    if (workflow.id !== HUMANIZE_WORKFLOW_ID) {
      this.createToggle(detail, 'Humanize output', 'Run a second pass through the Humanize workflow to strip AI-sounding language.', draft.humanize, v => { draft.humanize = v; });
    }

    // Link depth
    const linkDepthField = this.createField(detail, 'Link depth', 'How many levels of [[wikilinks]] to follow and include as context. 0 = none.');
    const linkDepthSelect = linkDepthField.createEl('select', { cls: 'alembic-select' });
    [0, 1, 2, 3].forEach(n => {
      const opt = linkDepthSelect.createEl('option', { text: String(n), value: String(n) });
      if (n === (draft.linkDepth ?? 0)) opt.selected = true;
    });
    linkDepthSelect.addEventListener('change', () => { draft.linkDepth = Number(linkDepthSelect.value); });

    // Buttons
    const buttonRow = detail.createDiv('alembic-button-row');

    const deleteBtn = buttonRow.createEl('button', { text: 'Delete', cls: 'alembic-delete-btn' });
    deleteBtn.addEventListener('click', async () => {
      if (!confirm(`Delete "${workflow.name}"? The file will be moved to your system trash.`)) return;
      const file = this.plugin.workflowFileMap.get(workflow.id);
      if (file) {
        await this.app.vault.trash(file, true);
      }
      await this.plugin.reloadWorkflows();
      this.activeWorkflowId = this.plugin.workflows[0]?.id ?? null;
      this.display();
    });

    if (isDefaultWorkflow(workflow.id)) {
      const resetBtn = buttonRow.createEl('button', { text: 'Reset to default', cls: 'alembic-reset-btn' });
      resetBtn.addEventListener('click', async () => {
        if (!confirm(`Reset "${workflow.name}" to its built-in default? Any edits will be overwritten.`)) return;
        const ok = await resetWorkflowToDefault(this.app, this.plugin.settings.workflowsFolder, workflow.id);
        await this.plugin.reloadWorkflows();
        this.display();
        if (ok) {
          alembicFlash(`${workflow.name} reset to default.`, 3000);
        } else {
          alembicFlash(`Could not reset "${workflow.name}" — no bundled default found.`, 5000, 'error');
        }
      });
    }

    const saveBtn = buttonRow.createEl('button', { text: 'Save', cls: 'alembic-save-btn' });
    saveBtn.addEventListener('click', async () => {
      const existingFile = this.plugin.workflowFileMap.get(workflow.id);
      const filename = existingFile ? existingFile.name : safeFilename(draft.name) + '.md';
      await writeWorkflowFile(this.app, this.plugin.settings.workflowsFolder, filename, draft);
      await this.plugin.reloadWorkflows();
      this.activeWorkflowId = draft.id;
      this.display();
    });
  }

  // ── Providers tab ─────────────────────────────────────────────────────────

  private renderProviderSidebar(sidebar: HTMLElement): void {
    const header = sidebar.createDiv('alembic-sidebar-header');
    header.createSpan({ text: 'Providers', cls: 'alembic-sidebar-title' });

    const addBtn = header.createEl('button', { text: '+', cls: 'alembic-add-btn' });
    addBtn.addEventListener('click', async () => {
      const newProvider: ProviderProfile = {
        id: crypto.randomUUID(),
        name: 'New Provider',
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'llama3.2',
      };
      this.plugin.settings.providers.push(newProvider);
      await this.plugin.saveSettings();
      this.activeProviderId = newProvider.id;
      this.display();
    });

    const list = sidebar.createEl('ul', { cls: 'alembic-sidebar-list' });
    this.plugin.settings.providers.forEach(p => {
      const item = list.createEl('li', {
        text: p.name,
        cls: 'alembic-sidebar-item' + (p.id === this.activeProviderId ? ' alembic-active' : ''),
      });
      item.addEventListener('click', () => { this.activeProviderId = p.id; this.display(); });
    });

    if (!this.activeProviderId && this.plugin.settings.providers.length > 0) {
      this.activeProviderId = this.plugin.settings.providers[0].id;
    }
  }

  private renderProviderDetail(detail: HTMLElement): void {
    const providers = this.plugin.settings.providers;
    if (providers.length === 0) {
      detail.createEl('p', { text: 'No providers yet. Click + to add one.', cls: 'alembic-empty-detail' });
      return;
    }

    const provider = providers.find(p => p.id === this.activeProviderId) ?? providers[0];
    const draft: ProviderProfile = { ...provider };
    const isBuiltIn = provider.id === CLAUDE_CLI_PROVIDER_ID;

    // Name
    const nameField = this.createField(detail, 'Profile Name');
    const nameInput = nameField.createEl('input', { type: 'text', cls: 'alembic-input' });
    nameInput.value = draft.name;
    nameInput.disabled = isBuiltIn;
    nameInput.addEventListener('input', () => { draft.name = nameInput.value; });

    // Type
    const typeField = this.createField(detail, 'Provider Type');
    const typeSelect = typeField.createEl('select', { cls: 'alembic-select' });
    typeSelect.disabled = isBuiltIn;
    PROVIDER_META.forEach(({ type, label }) => {
      const opt = typeSelect.createEl('option', { text: label, value: type });
      if (type === draft.type) opt.selected = true;
    });

    // Dynamic fields — re-render when type changes
    const dynamicFields = detail.createDiv('alembic-dynamic-fields');
    let modelInput: HTMLInputElement | null = null;

    const renderDynamic = (type: ProviderType) => {
      dynamicFields.empty();
      modelInput = null;
      const meta = PROVIDER_META_MAP[type];

      if (meta.needsApiKey) {
        const keyField = this.createField(dynamicFields, 'API Key');
        const keyInput = keyField.createEl('input', { type: 'password', cls: 'alembic-input' });
        keyInput.value = draft.apiKey ?? '';
        keyInput.addEventListener('input', () => { draft.apiKey = keyInput.value; });
      }

      if (meta.defaultBaseUrl !== undefined) {
        const urlField = this.createField(dynamicFields, 'Base URL');
        const urlInput = urlField.createEl('input', { type: 'text', cls: 'alembic-input' });
        urlInput.value = draft.baseUrl ?? meta.defaultBaseUrl;
        urlInput.addEventListener('input', () => { draft.baseUrl = urlInput.value; });
      }

      // Model field: free-text input + clickable chips (replaces unreliable <datalist>)
      let modelChips: HTMLElement | null = null;

      if (meta.modelHint) {
        const modelField = this.createField(dynamicFields, 'Model', meta.modelHint);
        modelInput = modelField.createEl('input', { type: 'text', cls: 'alembic-input' });
        modelInput.value = draft.model ?? '';
        modelInput.addEventListener('input', () => { draft.model = modelInput!.value; });

        modelChips = modelField.createDiv('alembic-model-chips');

        const fillChips = (models: string[]) => {
          modelChips!.empty();
          models.forEach(m => {
            const chip = modelChips!.createEl('button', { text: m, cls: 'alembic-model-chip' });
            chip.type = 'button';
            chip.addEventListener('click', () => {
              modelInput!.value = m;
              draft.model = m;
            });
          });
        };

        if (meta.knownModels.length > 0) fillChips(meta.knownModels);
      }

      // Connect button + status
      const connectRow = dynamicFields.createDiv('alembic-connect-row');
      const connectBtn = connectRow.createEl('button', { text: 'Test Connection', cls: 'alembic-connect-btn' });
      const statusEl = connectRow.createSpan({ cls: 'alembic-connect-status' });

      connectBtn.addEventListener('click', async () => {
        connectBtn.disabled = true;
        connectBtn.textContent = 'Connecting…';
        statusEl.textContent = '';
        statusEl.className = 'alembic-connect-status';

        const result = await fetchProviderModels({ ...draft, type });

        connectBtn.disabled = false;
        connectBtn.textContent = 'Test Connection';

        if (result.error) {
          statusEl.textContent = '✗ ' + result.error;
          statusEl.addClass('alembic-status-error');
        } else if (meta.isCli) {
          statusEl.textContent = `✓ ${meta.label} is reachable`;
          statusEl.addClass('alembic-status-ok');
        } else {
          statusEl.textContent = `✓ Connected — ${result.models.length} model${result.models.length !== 1 ? 's' : ''} found`;
          statusEl.addClass('alembic-status-ok');
          if (modelChips && result.models.length > 0) {
            modelChips.empty();
            result.models.forEach(m => {
              const chip = modelChips!.createEl('button', { text: m, cls: 'alembic-model-chip' });
              chip.type = 'button';
              chip.addEventListener('click', () => {
                modelInput!.value = m;
                draft.model = m;
              });
            });
          }
        }
      });
    };

    renderDynamic(draft.type);
    typeSelect.addEventListener('change', () => {
      draft.type = typeSelect.value as ProviderType;
      renderDynamic(draft.type);
    });

    // Buttons
    const buttonRow = detail.createDiv('alembic-button-row');

    if (!isBuiltIn) {
      const deleteBtn = buttonRow.createEl('button', { text: 'Delete', cls: 'alembic-delete-btn' });
      deleteBtn.addEventListener('click', async () => {
        if (!confirm(`Delete "${provider.name}"? Workflows using it will fall back to the first available provider.`)) return;
        this.plugin.settings.providers = this.plugin.settings.providers.filter(p => p.id !== provider.id);
        this.activeProviderId = this.plugin.settings.providers[0]?.id ?? null;
        await this.plugin.saveSettings();
        this.display();
      });
    }

    const saveBtn = buttonRow.createEl('button', { text: 'Save', cls: 'alembic-save-btn' });
    saveBtn.addEventListener('click', async () => {
      const idx = this.plugin.settings.providers.findIndex(p => p.id === provider.id);
      if (idx !== -1) {
        this.plugin.settings.providers[idx] = draft;
        await this.plugin.saveSettings();
        this.display();
      }
    });
  }
}
