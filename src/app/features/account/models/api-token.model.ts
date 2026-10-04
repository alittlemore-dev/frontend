export interface ApiPermission {
  code: string;
  service: string;
  domain: string;
  action: string;
}

export interface ApiToken {
  id: string;
  name: string;
  permissions: string[];
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  status: 'active' | 'expired' | 'revoked';
}

export interface ApiTokenCreate {
  name: string;
  password: string;
  permissions: string[];
  expiresAt: string;
}
