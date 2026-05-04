import { isFullNoteWorkflow, AlembicWorkflow, TOKEN_SELECTION, TOKEN_CONTEXT } from '../src/types';

const base: AlembicWorkflow = {
  id: 'test',
  name: 'Test',
  systemPrompt: '',
  prompt: '',
  replaceSelection: false,
  humanize: false,
  providerId: 'default-claude-cli',
  linkDepth: 1,
};

describe('isFullNoteWorkflow', () => {
  it('returns true when replaceSelection is on and prompt uses only CONTEXT', () => {
    const wf = { ...base, replaceSelection: true, prompt: TOKEN_CONTEXT };
    expect(isFullNoteWorkflow(wf)).toBe(true);
  });

  it('returns false when replaceSelection is off', () => {
    const wf = { ...base, replaceSelection: false, prompt: TOKEN_CONTEXT };
    expect(isFullNoteWorkflow(wf)).toBe(false);
  });

  it('returns false when prompt contains SELECTION', () => {
    const wf = { ...base, replaceSelection: true, prompt: `${TOKEN_CONTEXT} ${TOKEN_SELECTION}` };
    expect(isFullNoteWorkflow(wf)).toBe(false);
  });

  it('returns false when prompt has no CONTEXT token', () => {
    const wf = { ...base, replaceSelection: true, prompt: 'Just a plain prompt' };
    expect(isFullNoteWorkflow(wf)).toBe(false);
  });

  it('returns false when prompt is empty', () => {
    const wf = { ...base, replaceSelection: true, prompt: '' };
    expect(isFullNoteWorkflow(wf)).toBe(false);
  });
});
