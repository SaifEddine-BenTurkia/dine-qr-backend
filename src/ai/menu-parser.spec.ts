import { parseMenuReply } from './menu-parser';

describe('parseMenuReply', () => {
  it('reads a plain JSON array', () => {
    expect(
      parseMenuReply(
        '[{"categoryName":"Entrées","name":"Salade","description":null,"price":12.5}]',
      ),
    ).toEqual([
      {
        categoryName: 'Entrées',
        name: 'Salade',
        description: null,
        price: 12.5,
      },
    ]);
  });

  it('strips reasoning blocks, code fences and surrounding prose', () => {
    const reply =
      '<think>looking at [the menu]</think>Here you go:\n```json\n[{"categoryName":"Plats","name":"Couscous","price":"18"}]\n```';
    expect(parseMenuReply(reply)).toEqual([
      { categoryName: 'Plats', name: 'Couscous', description: null, price: 18 },
    ]);
  });

  it('drops entries without a name and repairs bad fields', () => {
    expect(
      parseMenuReply(
        '[{"name":""},{"name":"Thé","price":-2},{"name":"Café","price":"abc","categoryName":42}]',
      ),
    ).toEqual([
      { categoryName: 'Menu', name: 'Thé', description: null, price: 0 },
      { categoryName: 'Menu', name: 'Café', description: null, price: 0 },
    ]);
  });

  it('throws when there is no array', () => {
    expect(() => parseMenuReply('Sorry, I cannot read this image.')).toThrow();
  });
});
