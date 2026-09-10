import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

const COOKIE_CONSENT_KEY = 'cookieConsentAccepted';

@Injectable({ providedIn: 'root' })
export class ConsentService {
  private readonly document = inject(DOCUMENT);

  readonly cookieConsentAccepted = signal(this.storage()?.getItem(COOKIE_CONSENT_KEY) === 'true');

  acceptCookieConsent(): void {
    this.storage()?.setItem(COOKIE_CONSENT_KEY, 'true');
    this.cookieConsentAccepted.set(true);
  }

  private storage(): Storage | null {
    return this.document.defaultView?.localStorage ?? null;
  }
}
