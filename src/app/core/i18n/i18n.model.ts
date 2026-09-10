export type LanguageCode = 'ru' | 'en';

export interface I18nLanguage {
  code: LanguageCode;
  label: string;
}

export interface I18nLanguagesDto {
  defaultLanguage: LanguageCode;
  languages: I18nLanguage[];
}

export interface I18nBundleDto {
  language: LanguageCode;
  messages: Record<string, string>;
}

export type I18nParams = Record<string, string | number>;

export const SUPPORTED_LANGUAGE_CODES: readonly LanguageCode[] = ['ru', 'en'];

export function isLanguageCode(value: string | null): value is LanguageCode {
  return value === 'ru' || value === 'en';
}
