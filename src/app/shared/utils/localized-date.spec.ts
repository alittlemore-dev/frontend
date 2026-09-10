import { formatLocalizedDate } from './localized-date';

describe('formatLocalizedDate', () => {
  const value = '2026-06-07T12:34:56+00:00';

  it('formats a Russian date without time', () => {
    expect(formatLocalizedDate(value, 'ru-RU', 'date')).toBe(
      new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(new Date(value)),
    );
  });

  it('formats an English date without time', () => {
    expect(formatLocalizedDate(value, 'en-US', 'date')).toBe(
      new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value)),
    );
  });

  it('formats a Russian local date and time without seconds', () => {
    const formatted = formatLocalizedDate(value, 'ru-RU', 'dateTime');

    expect(formatted).toBe(
      new Intl.DateTimeFormat('ru-RU', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value)),
    );
    expect(formatted).not.toContain('56');
  });

  it('formats an English local date and time without seconds', () => {
    const formatted = formatLocalizedDate(value, 'en-US', 'dateTime');

    expect(formatted).toBe(
      new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value)),
    );
    expect(formatted).not.toContain('56');
  });
});
