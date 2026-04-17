import { Notice } from 'obsidian';

// ── Waiting messages ────────────────────────────────────────────────────────
// Cycle through these while a workflow runs. Each interval is 7 s, so most
// calls will only reach the second or third message — the rest exist for
// unusually long operations (large notes, slow local models).

export const WAIT_MESSAGES = [
  'Distilling…',
  'Heating the flask…',
  'Separating signal from noise…',
  'The reaction is underway…',
  'Condensing…',
  'Transmuting…',
  'Still in the retort…',
];

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Attach the standard ⚗️ header row to a notice element. */
function attachHeader(el: HTMLElement, title: string): void {
  const hdr = el.createDiv('alembic-notice-header');
  hdr.createSpan({ text: '⚗️', cls: 'alembic-notice-icon' });
  hdr.createSpan({ text: title, cls: 'alembic-notice-title' });
}

// ── Flash notice ─────────────────────────────────────────────────────────────
// Use for one-shot messages: success, cancel, validation errors, etc.

export type NoticeVariant = 'default' | 'error' | 'success';

export function alembicFlash(
  message: string,
  timeout = 4000,
  variant: NoticeVariant = 'default',
): void {
  const notice = new Notice('', timeout);
  const el = notice.noticeEl;
  el.addClass('alembic-notice');
  if (variant !== 'default') el.addClass(`alembic-notice--${variant}`);
  attachHeader(el, 'Alembic');
  el.createDiv({ text: message, cls: 'alembic-notice-body' });
}

// ── Run notice ───────────────────────────────────────────────────────────────
// Use for long-running operations. The header shows the workflow name;
// the status line below it cycles through WAIT_MESSAGES.

export interface RunNotice {
  setStatus(msg: string): void;
  addCancelButton(onClick: () => void): void;
  hide(): void;
}

export function alembicRunNotice(workflowName: string): RunNotice {
  const notice = new Notice('', 0);
  const el = notice.noticeEl;
  el.addClass('alembic-notice');

  // Strip leading emoji from the workflow name so the ⚗️ in the header
  // doesn't clash visually with a second emoji right next to it.
  const displayName = workflowName.replace(/^\p{Emoji}\uFE0F?\s*/u, '');
  attachHeader(el, displayName);

  const statusEl = el.createDiv({ text: WAIT_MESSAGES[0], cls: 'alembic-notice-status' });

  return {
    setStatus(msg: string) { statusEl.setText(msg); },
    addCancelButton(onClick: () => void) {
      const btn = el.createEl('button', { text: 'Cancel', cls: 'alembic-cancel-btn' });
      btn.addEventListener('click', onClick);
    },
    hide() { notice.hide(); },
  };
}
