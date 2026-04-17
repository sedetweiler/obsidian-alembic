import { substituteTokens, assembleUserMessage } from '../src/runner';
import { AlembicWorkflow } from '../src/types';

const baseWorkflow: AlembicWorkflow = {
  id: 'test-id',
  name: 'Test Workflow',
  systemPrompt: 'You are helpful.',
  prompt: '',
  replaceSelection: false,
  humanize: false,
  providerId: 'default-claude-cli',
};

describe('substituteTokens', () => {
  it('replaces {=SELECTION=} with the selection string', () => {
    expect(substituteTokens('Fix: {=SELECTION=}', 'hello', '')).toBe('Fix: hello');
  });

  it('replaces {=CONTEXT=} with the context string', () => {
    expect(substituteTokens('Context: {=CONTEXT=}', '', 'full note')).toBe('Context: full note');
  });

  it('replaces both tokens in one template', () => {
    const result = substituteTokens('Note: {=CONTEXT=}\nFocus: {=SELECTION=}', 'selected bit', 'whole note');
    expect(result).toBe('Note: whole note\nFocus: selected bit');
  });

  it('replaces multiple occurrences of the same token', () => {
    expect(substituteTokens('{=SELECTION=} and {=SELECTION=}', 'text', '')).toBe('text and text');
  });

  it('returns the template unchanged when it contains no tokens', () => {
    expect(substituteTokens('Just a plain prompt.', 'sel', 'ctx')).toBe('Just a plain prompt.');
  });
});

describe('assembleUserMessage', () => {
  it('uses the prompt template when prompt is non-empty', () => {
    const workflow = { ...baseWorkflow, prompt: 'Improve: {=SELECTION=}' };
    expect(assembleUserMessage(workflow, 'my text', 'full note')).toBe('Improve: my text');
  });

  it('auto-assembles selection then context when prompt is empty', () => {
    expect(assembleUserMessage(baseWorkflow, 'selected', 'context')).toBe('selected\n\ncontext');
  });

  it('returns only selection when context is blank and prompt is empty', () => {
    expect(assembleUserMessage(baseWorkflow, 'selected', '')).toBe('selected');
  });

  it('returns only context when selection is blank and prompt is empty', () => {
    expect(assembleUserMessage(baseWorkflow, '', 'context')).toBe('context');
  });

  it('returns empty string when both selection and context are blank and prompt is empty', () => {
    expect(assembleUserMessage(baseWorkflow, '', '')).toBe('');
  });

  it('treats a whitespace-only prompt as empty', () => {
    const workflow = { ...baseWorkflow, prompt: '   ' };
    expect(assembleUserMessage(workflow, 'selected', 'context')).toBe('selected\n\ncontext');
  });
});
