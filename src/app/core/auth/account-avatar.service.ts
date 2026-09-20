import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, OnDestroy, PLATFORM_ID, Signal, inject, signal } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import { AccountInfo } from './account.model';

@Injectable({ providedIn: 'root' })
export class AccountAvatarService implements OnDestroy {
  private readonly apiClient = inject(ApiClient);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly currentObjectUrl = signal<string | null>(null);
  private account: AccountInfo | null = null;

  readonly objectUrl: Signal<string | null> = this.currentObjectUrl.asReadonly();

  loadFor(account: AccountInfo): Observable<void> {
    this.account = account;
    if (!this.isBrowser || !account.hasAvatar) {
      this.replace(null);
      return of(void 0);
    }

    return this.apiClient.getBlob('/api/auth/account/me/avatar').pipe(
      map((blob) => {
        this.replace(blob);
      }),
      catchError(() => {
        this.replace(null);
        return of(void 0);
      }),
    );
  }

  reload(): Observable<void> {
    if (this.account === null) return of(void 0);
    return this.loadFor(this.account);
  }

  clear(): void {
    this.account = null;
    this.replace(null);
  }

  ngOnDestroy(): void {
    this.clear();
  }

  private replace(blob: Blob | null): void {
    if (!this.isBrowser) return;
    const urlApi = this.document.defaultView?.URL;
    if (urlApi === undefined) return;

    const previous = this.currentObjectUrl();
    if (previous !== null) {
      urlApi.revokeObjectURL(previous);
    }
    this.currentObjectUrl.set(blob === null ? null : urlApi.createObjectURL(blob));
  }
}
