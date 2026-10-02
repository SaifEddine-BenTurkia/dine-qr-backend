import {
  parseTranslationReply,
  translationPrompt,
} from './menu-translation.service';

describe('menu translation', () => {
  it('asks to keep Tunisian dish names', () => {
    const prompt = translationPrompt('en', [
      { id: 'd:1', name: 'Brik', description: null },
    ]);
    expect(prompt).toContain('lablabi');
    expect(prompt).toContain('English');
  });

  it('parses a fenced JSON answer and drops malformed rows', () => {
    const rows = parseTranslationReply(
      '```json\n[{"id":"d:1","name":" Brik — crispy pastry ","description":""},{"name":"x"}]\n```',
    );
    expect(rows).toEqual([
      { id: 'd:1', name: 'Brik — crispy pastry', description: null },
    ]);
  });

  it('fails on an answer without JSON', () => {
    expect(() => parseTranslationReply('Sorry, I cannot')).toThrow();
  });
});
