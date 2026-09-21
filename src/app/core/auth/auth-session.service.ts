import { Injectable, computed, signal } from '@angular/core';
import type { AccountInfo } from './account.model';

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly sessionGeneration = signal(0);
  readonly generation = this.sessionGeneration.asReadonly();
  readonly currentUser = signal<AccountInfo | null>(null);
  readonly isOwner = computed(() => this.currentUser()?.role === 'owner');
  readonly isAdmin = computed(() => this.currentUser()?.role === 'admin');
  readonly canManageContent = computed(() => {
    const role = this.currentUser()?.role;
    return role === 'owner' || role === 'admin' || role === 'moderator';
  });
  readonly canManageTeam = computed(() => {
    const role = this.currentUser()?.role;
    return role === 'owner' || role === 'admin';
  });
  readonly isLoggedIn = computed(
    () => this.currentUser() !== null && this.currentUser()?.role !== 'anon',
  );

  setCurrentUser(account: AccountInfo): void {
    const next = account.role === 'anon' ? null : account;
    if (next?.username !== this.currentUser()?.username)
      this.sessionGeneration.update((value) => value + 1);
    this.currentUser.set(next);
  }

  clear(): void {
    this.sessionGeneration.update((value) => value + 1);
    this.currentUser.set(null);
  }
}
