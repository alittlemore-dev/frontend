export type AccountRole = 'anon' | 'user' | 'moderator' | 'admin' | 'owner';

export type AccountGender = 'male' | 'female';

export interface AccountInfo {
  username: string;
  role: AccountRole;
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  gender: AccountGender | null;
  hasAvatar: boolean;
}
