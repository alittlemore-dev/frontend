export type ManagedAccountRole = 'owner' | 'admin' | 'moderator';
export type EditableManagedAccountRole = 'admin' | 'moderator';
export type ManagedAccountSessionDevice = 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';
export type ManagedAccountSessionAuthMethod = 'password';

export interface ManagedAccountDto {
  username: string;
  role: ManagedAccountRole;
  isActive: boolean;
}

export interface ManagedAccountsDto {
  totalCount: number;
  totalPages: number;
  accounts: ManagedAccountDto[];
}

export interface ManagedAccount {
  username: string;
  role: ManagedAccountRole;
  isActive: boolean;
}

export interface ManagedAccountSessionDto {
  id: string;
  userAgentDisplay: string;
  userAgentBrowser: string;
  userAgentOs: string;
  userAgentDevice: ManagedAccountSessionDevice;
  authMethod: ManagedAccountSessionAuthMethod;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export interface ManagedAccountSessionsDto {
  sessions: ManagedAccountSessionDto[];
}

export interface ManagedAccountSessionRevocationDto {
  currentSessionRevoked: boolean;
}

export interface ManagedAccountSession {
  id: string;
  userAgentDisplay: string;
  userAgentBrowser: string;
  userAgentOs: string;
  userAgentDevice: ManagedAccountSessionDevice;
  authMethod: ManagedAccountSessionAuthMethod;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export interface ManagedAccountSessions {
  sessions: ManagedAccountSession[];
}

export interface ManagedAccountSessionRevocation {
  currentSessionRevoked: boolean;
}

export interface ManagedAccounts {
  totalCount: number;
  totalPages: number;
  accounts: ManagedAccount[];
}

export interface ManagedAccountListParams {
  page: number;
  pageSize: number;
}

export interface ManagedAccountCreatePayload {
  username: string;
  role: EditableManagedAccountRole;
  password: string;
  isActive: boolean;
}

export interface ManagedAccountRoleUpdatePayload {
  role: EditableManagedAccountRole;
}

export interface ManagedAccountPasswordUpdatePayload {
  password: string;
}

export function mapManagedAccountDto(dto: ManagedAccountDto): ManagedAccount {
  return {
    username: dto.username,
    role: dto.role,
    isActive: dto.isActive,
  };
}

export function mapManagedAccountsDto(dto: ManagedAccountsDto): ManagedAccounts {
  return {
    totalCount: dto.totalCount,
    totalPages: dto.totalPages,
    accounts: dto.accounts.map(mapManagedAccountDto),
  };
}

export function mapManagedAccountSessionDto(dto: ManagedAccountSessionDto): ManagedAccountSession {
  return {
    id: dto.id,
    userAgentDisplay: dto.userAgentDisplay,
    userAgentBrowser: dto.userAgentBrowser,
    userAgentOs: dto.userAgentOs,
    userAgentDevice: dto.userAgentDevice,
    authMethod: dto.authMethod,
    createdAt: dto.createdAt,
    lastUsedAt: dto.lastUsedAt,
    expiresAt: dto.expiresAt,
    isCurrent: dto.isCurrent,
  };
}

export function mapManagedAccountSessionsDto(
  dto: ManagedAccountSessionsDto,
): ManagedAccountSessions {
  return {
    sessions: dto.sessions.map(mapManagedAccountSessionDto),
  };
}

export function mapManagedAccountSessionRevocationDto(
  dto: ManagedAccountSessionRevocationDto,
): ManagedAccountSessionRevocation {
  return {
    currentSessionRevoked: dto.currentSessionRevoked,
  };
}
