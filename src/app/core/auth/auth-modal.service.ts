import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthModalService {
  readonly isLoginOpen = signal(false);

  openLogin(): void {
    this.isLoginOpen.set(true);
  }

  closeLogin(): void {
    this.isLoginOpen.set(false);
  }
}
