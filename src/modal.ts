import { App, FuzzyMatch, FuzzySuggestModal, Modal, Platform, renderMatches } from 'obsidian';
import { AlembicWorkflow, FREEFORM_WORKFLOW_ID, TOKEN_CONTEXT } from './types';

interface Hotkey {
  modifiers?: string[];
  key: string;
}

interface HotkeyManager {
  getHotkeys(commandId: string): Hotkey[] | undefined;
  getDefaultHotkeys(commandId: string): Hotkey[] | undefined;
}

/** Returns a formatted hotkey string for a command id, e.g. "⌘⇧F", or "" if unbound. */
function getHotkeyStr(app: App, commandId: string): string {
  const manager = (app as App & { hotkeyManager?: HotkeyManager }).hotkeyManager;
  if (!manager) return '';
  const hotkeys = manager.getHotkeys(commandId) ?? manager.getDefaultHotkeys(commandId) ?? [];
  if (!hotkeys.length) return '';
  const hk = hotkeys[0];
  const isMac = Platform.isMacOS;
  const mods = (hk.modifiers ?? []).map((m) => {
    switch (m) {
      case 'Mod':   return isMac ? '⌘' : 'Ctrl+';
      case 'Shift': return isMac ? '⇧' : 'Shift+';
      case 'Alt':   return isMac ? '⌥' : 'Alt+';
      default:      return m;
    }
  }).join('');
  return mods + hk.key.toUpperCase();
}

export class WorkflowSelectorModal extends FuzzySuggestModal<AlembicWorkflow> {
  private workflows: AlembicWorkflow[];
  private onSelect: (workflow: AlembicWorkflow) => void;

  constructor(
    app: App,
    workflows: AlembicWorkflow[],
    onSelect: (workflow: AlembicWorkflow) => void
  ) {
    super(app);
    this.workflows = workflows;
    this.onSelect = onSelect;
    this.setPlaceholder('Run a workflow…');
  }

  getItems(): AlembicWorkflow[] {
    // Always pin the freeform entry at the top regardless of saved order
    return [
      ...this.workflows.filter(w => w.id === FREEFORM_WORKFLOW_ID),
      ...this.workflows.filter(w => w.id !== FREEFORM_WORKFLOW_ID),
    ];
  }

  getItemText(item: AlembicWorkflow): string {
    return item.name;
  }

  renderSuggestion(match: FuzzyMatch<AlembicWorkflow>, el: HTMLElement): void {
    el.addClass('alembic-suggestion');
    if (match.item.id === FREEFORM_WORKFLOW_ID) el.addClass('alembic-suggestion-freeform');
    const nameEl = el.createSpan({ cls: 'alembic-suggestion-name' });
    renderMatches(nameEl, match.item.name, match.match.matches);

    const cmdId = `obsidian-alembic:run-workflow-${match.item.id.replace(/[^a-z0-9]/gi, '-')}`;
    const hotkey = getHotkeyStr(this.app, cmdId);
    if (hotkey) {
      el.createSpan({ text: hotkey, cls: 'alembic-suggestion-hotkey' });
    }
  }

  onChooseItem(item: AlembicWorkflow): void {
    if (item.id === FREEFORM_WORKFLOW_ID) {
      new FreeformModal(this.app, item, (prompt, humanize) => {
        // Prepend note context so Claude always sees the current document
        this.onSelect({ ...item, prompt: `${TOKEN_CONTEXT}\n\n---\n\n${prompt}`, humanize });
      }).open();
    } else {
      this.onSelect(item);
    }
  }
}

export class FreeformModal extends Modal {
  private workflow: AlembicWorkflow;
  private onSubmit: (prompt: string, humanize: boolean) => void;

  constructor(app: App, workflow: AlembicWorkflow, onSubmit: (prompt: string, humanize: boolean) => void) {
    super(app);
    this.workflow = workflow;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('alembic-modal', 'alembic-freeform-modal');

    contentEl.createEl('p', { text: this.workflow.name.replace(/^[\p{Emoji}\s]+/u, '').trim() || this.workflow.name, cls: 'alembic-freeform-title' });

    const textarea = contentEl.createEl('textarea', { cls: 'alembic-freeform-input' });
    textarea.placeholder = 'Reformat this page so that…';
    textarea.rows = 4;

    const humanizeLabel = contentEl.createEl('label', { cls: 'alembic-toggle-row alembic-freeform-humanize' });
    const humanizeCheckbox = humanizeLabel.createEl('input', { type: 'checkbox' });
    humanizeCheckbox.checked = this.workflow.humanize;
    humanizeCheckbox.classList.add('alembic-checkbox');
    humanizeLabel.createSpan({ text: 'Humanize output' });

    textarea.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter' && (evt.ctrlKey || evt.metaKey)) {
        evt.preventDefault();
        this.submit(textarea.value, humanizeCheckbox.checked);
      }
    });

    const runBtn = contentEl.createEl('button', { text: 'Run', cls: 'alembic-run-btn' });
    runBtn.addEventListener('click', () => this.submit(textarea.value, humanizeCheckbox.checked));

    window.setTimeout(() => textarea.focus(), 50);
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private submit(value: string, humanize: boolean): void {
    const prompt = value.trim();
    if (!prompt) return;
    this.close();
    this.onSubmit(prompt, humanize);
  }
}

/**
 * A modal-based replacement for the browser `confirm()` dialog, which is not
 * permitted in Obsidian plugins. Resolves to `true` if the user confirms,
 * `false` if they cancel or dismiss the modal.
 */
export class ConfirmModal extends Modal {
  private message: string;
  private resolve!: (value: boolean) => void;
  private decided = false;

  constructor(app: App, message: string) {
    super(app);
    this.message = message;
  }

  ask(): Promise<boolean> {
    const promise = new Promise<boolean>((res) => { this.resolve = res; });
    this.open();
    return promise;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('alembic-modal', 'alembic-confirm-modal');

    for (const line of this.message.split('\n')) {
      contentEl.createEl('p', { text: line, cls: 'alembic-confirm-line' });
    }

    const row = contentEl.createDiv('alembic-confirm-buttons');
    const cancelBtn = row.createEl('button', { text: 'Cancel', cls: 'alembic-confirm-cancel' });
    cancelBtn.addEventListener('click', () => this.decide(false));
    const okBtn = row.createEl('button', { text: 'OK', cls: 'alembic-confirm-ok' });
    okBtn.addEventListener('click', () => this.decide(true));

    window.setTimeout(() => okBtn.focus(), 50);
  }

  onClose(): void {
    this.contentEl.empty();
    this.decide(false);
  }

  private decide(value: boolean): void {
    if (this.decided) return;
    this.decided = true;
    this.resolve(value);
    this.close();
  }
}

/** Opens a confirmation modal and resolves to the user's choice. */
export function confirmModal(app: App, message: string): Promise<boolean> {
  return new ConfirmModal(app, message).ask();
}
