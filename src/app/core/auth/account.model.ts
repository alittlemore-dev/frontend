import { LanguageCode } from '../i18n/i18n.model';

export type AccountRole = 'anon' | 'user' | 'moderator' | 'admin' | 'owner';

export type AccountGender = 'male' | 'female';

export type TelegramBotId = 'personal-workspace';

export interface TelegramBotSettings {
  enabled: boolean;
  notify: boolean;
}

export interface AccountSettings {
  language: LanguageCode;
  theme: 'light' | 'dark';
  timeZone: string;
  telegramBots: Partial<Record<TelegramBotId, TelegramBotSettings>>;
}

export interface AccountInfo {
  settings: AccountSettings;
  username: string;
  role: AccountRole;
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  gender: AccountGender | null;
  hasAvatar: boolean;
}
