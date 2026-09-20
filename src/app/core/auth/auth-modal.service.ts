import type { AccountInfo } from './account.model';
import { Injectable, signal } from '@angular/core';

export interface LoginOptions {
  required?: boolean;
  account?: AccountInfo | null;
  returnUrl?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthModalService {
  readonly isLoginOpen = signal(false);
  readonly loginRequired = signal(false);
  private returnUrl: string | null = null;
  private recoveryAccount: AccountInfo | null = null;

  openLogin(options: LoginOptions = {}): void {
    if (options.account && !this.recoveryAccount) this.recoveryAccount = options.account;
    this.loginRequired.set(this.loginRequired() || options.required === true);
    if (options.returnUrl !== undefined) this.returnUrl = safeReturnUrl(options.returnUrl);
    this.isLoginOpen.set(true);
  }

  requiresPrivateStateReset(account: AccountInfo | null): boolean {
    return (
      this.loginRequired() &&
      (!this.recoveryAccount ||
        this.recoveryAccount.username !== account?.username ||
        this.recoveryAccount.role !== account?.role)
    );
  }

  closeLogin(): void {
    if (this.loginRequired()) return;
    this.reset();
  }

  completeLogin(): string | null {
    const returnUrl = this.returnUrl;
    this.reset();
    return returnUrl;
  }

  private reset(): void {
    this.isLoginOpen.set(false);
    this.loginRequired.set(false);
    this.returnUrl = null;
    this.recoveryAccount = null;
  }
}

export function safeReturnUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const decoded = decodeURIComponent(value);
    if (
      !decoded.startsWith('/') ||
      decoded.startsWith('//') ||
      decoded.includes('\\') ||
      Array.from(decoded).some((character) => character.charCodeAt(0) < 32)
    )
      return null;
    const path = new URL(decoded, 'https://local.invalid').pathname;
    return /^\/login(?:[;/]|$)/.test(path) ? null : value;
  } catch {
    return null;
  }
}
