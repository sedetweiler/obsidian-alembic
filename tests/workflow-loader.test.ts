// Mock obsidian's parseYaml before importing the module
jest.mock('obsidian', () => ({
  parseYaml: (str: string) => {
    // Minimal YAML parser for test purposes — handles key: value and key: "value"
    const result: Record<string, unknown> = {};
    for (const line of str.split('\n')) {
      const match = line.match(/^(\w+):\s*(.+)$/);
      if (!match) continue;
      let val: unknown = match[2].trim();
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      else if (/^\d+$/.test(val as string)) val = Number(val);
      else val = (val as string).replace(/^["']|["']$/g, '');
      result[match[1]] = val;
    }
    return result;
  },
  TFolder: class {},
}), { virtual: true });

// Mock the default-workflows virtual module
jest.mock('alembic:default-workflows', () => ({}), { virtual: true });

import { markdownToWorkflow, workflowToMarkdown, isDefaultWorkflow, safeFilename, defaultFilenameFor } from '../src/workflow-loader';
import { AlembicWorkflow } from '../src/types';

const sampleWorkflow: AlembicWorkflow = {
  id: 'test-id',
  name: 'Test Workflow',
  systemPrompt: 'You are helpful.',
  prompt: '{=CONTEXT=}',
  replaceSelection: false,
  humanize: true,
  providerId: 'default-claude-cli',
  linkDepth: 1,
};

// ── markdownToWorkflow ──────────────────────────────────────────────────────

describe('markdownToWorkflow', () => {
  it('parses valid workflow markdown', () => {
    const md = [
      '---',
      'id: "my-workflow"',
      'name: "My Workflow"',
      'prompt: "{=CONTEXT=}"',
      'replaceSelection: false',
      'humanize: true',
      'providerId: "default-claude-cli"',
      'linkDepth: 2',
      '---',
      'System prompt body here.',
    ].join('\n');
    const wf = markdownToWorkflow(md);
    expect(wf).not.toBeNull();
    expect(wf!.id).toBe('my-workflow');
    expect(wf!.name).toBe('My Workflow');
    expect(wf!.prompt).toBe('{=CONTEXT=}');
    expect(wf!.systemPrompt).toBe('System prompt body here.');
    expect(wf!.humanize).toBe(true);
    expect(wf!.linkDepth).toBe(2);
  });

  it('returns null when frontmatter is missing', () => {
    expect(markdownToWorkflow('Just some text')).toBeNull();
  });

  it('returns null when frontmatter has no closing ---', () => {
    expect(markdownToWorkflow('---\nid: test\nNo closing')).toBeNull();
  });

  it('returns null when id is missing', () => {
    const md = '---\nname: "No ID"\n---\nBody';
    expect(markdownToWorkflow(md)).toBeNull();
  });

  it('defaults linkDepth to 1 when not specified', () => {
    const md = '---\nid: "test"\nname: "Test"\n---\nBody';
    const wf = markdownToWorkflow(md);
    expect(wf).not.toBeNull();
    expect(wf!.linkDepth).toBe(1);
  });

  it('clamps linkDepth to 0-3 range', () => {
    const md = '---\nid: "test"\nlinkDepth: 10\n---\nBody';
    const wf = markdownToWorkflow(md);
    expect(wf!.linkDepth).toBe(3);
  });

  it('defaults name to Unnamed when not provided', () => {
    const md = '---\nid: "test"\n---\nBody';
    const wf = markdownToWorkflow(md);
    expect(wf!.name).toBe('Unnamed');
  });

  it('normalizes CRLF line endings', () => {
    const md = '---\r\nid: "test"\r\n---\r\nBody';
    const wf = markdownToWorkflow(md);
    expect(wf).not.toBeNull();
    expect(wf!.systemPrompt).toBe('Body');
  });
});

// ── workflowToMarkdown ──────────────────────────────────────────────────────

describe('workflowToMarkdown', () => {
  it('produces valid markdown with frontmatter', () => {
    const md = workflowToMarkdown(sampleWorkflow);
    expect(md).toContain('---');
    expect(md).toContain('id: "test-id"');
    expect(md).toContain('name: "Test Workflow"');
    expect(md).toContain('linkDepth: 1');
    expect(md).toContain('You are helpful.');
  });

  it('roundtrips through markdownToWorkflow', () => {
    const md = workflowToMarkdown(sampleWorkflow);
    const parsed = markdownToWorkflow(md);
    expect(parsed).not.toBeNull();
    expect(parsed!.id).toBe(sampleWorkflow.id);
    expect(parsed!.name).toBe(sampleWorkflow.name);
    expect(parsed!.systemPrompt).toBe(sampleWorkflow.systemPrompt);
    expect(parsed!.prompt).toBe(sampleWorkflow.prompt);
    expect(parsed!.replaceSelection).toBe(sampleWorkflow.replaceSelection);
    expect(parsed!.humanize).toBe(sampleWorkflow.humanize);
    expect(parsed!.linkDepth).toBe(sampleWorkflow.linkDepth);
  });
});

// ── isDefaultWorkflow ───────────────────────────────────────────────────────

describe('isDefaultWorkflow', () => {
  it('returns true for built-in workflow IDs', () => {
    expect(isDefaultWorkflow('__freeform__')).toBe(true);
    expect(isDefaultWorkflow('default-lint')).toBe(true);
    expect(isDefaultWorkflow('__humanize__')).toBe(true);
    expect(isDefaultWorkflow('default-copywriting')).toBe(true);
    expect(isDefaultWorkflow('continue-prompted')).toBe(true);
  });

  it('returns false for custom workflow IDs', () => {
    expect(isDefaultWorkflow('my-custom-workflow')).toBe(false);
    expect(isDefaultWorkflow('')).toBe(false);
  });
});

// ── safeFilename ────────────────────────────────────────────────────────────

describe('safeFilename', () => {
  it('strips invalid characters', () => {
    expect(safeFilename('my/file:name*test')).toBe('myfilenametest');
  });

  it('preserves valid characters', () => {
    expect(safeFilename('My Workflow - v2')).toBe('My Workflow - v2');
  });

  it('trims whitespace', () => {
    expect(safeFilename('  hello  ')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(safeFilename('')).toBe('');
  });
});

// ── defaultFilenameFor ──────────────────────────────────────────────────────

describe('defaultFilenameFor', () => {
  it('returns the canonical filename for built-in IDs', () => {
    expect(defaultFilenameFor('default-lint', 'Lint')).toBe('Lint.md');
    expect(defaultFilenameFor('__freeform__', 'Ask Claude')).toBe('Ask Claude.md');
  });

  it('derives filename from name for custom IDs', () => {
    expect(defaultFilenameFor('custom-id', 'My Custom Workflow')).toBe('My Custom Workflow.md');
  });

  it('sanitizes the derived filename', () => {
    expect(defaultFilenameFor('custom-id', 'My/Bad*Name')).toBe('MyBadName.md');
  });
});
