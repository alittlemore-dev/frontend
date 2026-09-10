export type LocalizedDateDisplay = 'date' | 'dateTime';

export function formatLocalizedDate(
  value: string,
  locale: string,
  display: LocalizedDateDisplay,
): string {
  const options: Intl.DateTimeFormatOptions =
    display === 'date' ? { dateStyle: 'medium' } : { dateStyle: 'medium', timeStyle: 'short' };

  return new Intl.DateTimeFormat(locale, options).format(new Date(value));
}
