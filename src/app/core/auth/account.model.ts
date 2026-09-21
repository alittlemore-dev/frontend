import { LanguageCode } from '../i18n/i18n.model';

export type AccountRole = 'anon' | 'user' | 'moderator' | 'admin' | 'owner';

export type AccountGender = 'male' | 'female';

export interface AccountSettings {
  language: LanguageCode;
  theme: 'light' | 'dark';
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
