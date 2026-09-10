import { slugify } from './slugify';

describe('slugify', () => {
  it('transliterates Cyrillic text and sanitizes separators', () => {
    expect(slugify('Что такое Promise в JS?')).toBe('chto-takoe-promise-v-js');
  });

  it('removes accents and trims generated dashes', () => {
    expect(slugify('  Café déjà vu!  ')).toBe('cafe-deja-vu');
  });
});
