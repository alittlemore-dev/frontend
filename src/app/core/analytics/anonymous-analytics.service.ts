import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { ApiClient } from '../http/api-client.service';
import { ConsentService } from '../privacy/consent.service';

export type AnalyticsSource = 'Direct' | 'Internal' | 'Search' | 'Social' | 'External' | 'Unknown';
interface ActiveVisit {
  kind: 'Site' | 'Matrix';
  targetId: string;
  source: AnalyticsSource;
  visitorToken: string;
  visitToken: string;
  visibleSeconds: number;
  ready: boolean;
  day: string;
}

@Injectable({ providedIn: 'root' })
export class AnonymousAnalyticsService {
  private readonly document = inject(DOCUMENT);
  private readonly platform = inject(PLATFORM_ID);
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly consent = inject(ConsentService);
  private readonly destroyRef = inject(DestroyRef);
  private started = false;
  private site: ActiveVisit | null = null;
  private matrix: ActiveVisit | null = null;
  private memoryToken: { day: string; token: string } | null = null;
  private internalNavigation = false;
  private navigationSource: AnalyticsSource | null = null;

  start(): void {
    if (this.started || !isPlatformBrowser(this.platform)) return;
    const browser = this.document.defaultView;
    if (browser === null) return;
    this.started = true;
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd || event instanceof NavigationStart),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.navigationSource = this.internalNavigation ? 'Internal' : this.source();
        if (event instanceof NavigationStart) return;
        const page = publicPage(event.urlAfterRedirects);
        if (page !== 'matrix') this.stopMatrix();
        this.site = page === null ? null : this.begin('Site', page);
        this.internalNavigation = true;
      });
    const timer = browser.setInterval(() => {
      this.tick(this.site);
      this.tick(this.matrix);
    }, 1000);
    this.destroyRef.onDestroy(() => browser.clearInterval(timer));
  }

  startMatrix(targetId: string): void {
    this.matrix = this.begin('Matrix', targetId);
  }

  stopMatrix(): void {
    this.matrix = null;
  }

  source(): AnalyticsSource {
    if (this.navigationSource !== null) return this.navigationSource;
    const referrer = this.document.referrer;
    if (!referrer) return 'Direct';
    try {
      const hostname = new URL(referrer).hostname.toLowerCase();
      if (hostname === this.document.defaultView?.location.hostname) return 'Internal';
      if (
        /^(www\.)?(google\.[a-z.]+|bing\.com|yandex\.[a-z.]+|duckduckgo\.com|search\.yahoo\.com)$/.test(
          hostname,
        )
      )
        return 'Search';
      if (
        [
          't.co',
          't.me',
          'telegram.org',
          'vk.com',
          'facebook.com',
          'instagram.com',
          'linkedin.com',
          'reddit.com',
          'x.com',
          'twitter.com',
        ].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
      )
        return 'Social';
      return 'External';
    } catch {
      return 'Unknown';
    }
  }

  private begin(kind: 'Site' | 'Matrix', targetId: string): ActiveVisit | null {
    const browser = this.document.defaultView;
    if (
      !isPlatformBrowser(this.platform) ||
      browser === null ||
      browser.navigator.doNotTrack === '1' ||
      this.auth.canManageContent()
    )
      return null;
    const day = new Date().toISOString().slice(0, 10);
    const token = this.visitorToken(day);
    if (token === null || typeof browser.crypto?.randomUUID !== 'function') return null;
    const visit: ActiveVisit = {
      kind,
      targetId,
      source: this.source(),
      visitorToken: token,
      visitToken: browser.crypto.randomUUID(),
      visibleSeconds: 0,
      ready: false,
      day,
    };
    this.api
      .post<void>('/api/analytics/visits', this.payload(visit, 'View'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          visit.ready = true;
        },
        error: () => undefined,
      });
    return visit;
  }

  private tick(visit: ActiveVisit | null): void {
    if (visit === null || !visit.ready || this.document.visibilityState !== 'visible') return;
    if (visit.day !== new Date().toISOString().slice(0, 10)) return;
    visit.visibleSeconds += 1;
    if (visit.visibleSeconds !== 15) return;
    this.api
      .post<void>('/api/analytics/visits', this.payload(visit, 'Engaged'))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => undefined });
  }

  private payload(visit: ActiveVisit, event: 'View' | 'Engaged'): object {
    return {
      kind: visit.kind,
      targetId: visit.targetId,
      source: visit.source,
      visitorToken: visit.visitorToken,
      visitToken: visit.visitToken,
      event,
    };
  }

  private visitorToken(day: string): string | null {
    const browser = this.document.defaultView;
    if (typeof browser?.crypto?.randomUUID !== 'function') return null;
    if (this.memoryToken?.day === day) return this.memoryToken.token;
    let token: string = browser.crypto.randomUUID();
    try {
      // Persistent daily tokens use the site's existing storage consent; otherwise count sessions.
      const storage = this.consent.cookieConsentAccepted()
        ? browser.localStorage
        : browser.sessionStorage;
      const stored: unknown = JSON.parse(storage.getItem('anonymousAnalyticsDay') ?? 'null');
      if (isDailyToken(stored) && stored.day === day) token = stored.token;
      storage.setItem('anonymousAnalyticsDay', JSON.stringify({ day, token }));
    } catch {
      // Storage can be disabled; the in-memory daily token still deduplicates this session.
    }
    this.memoryToken = { day, token };
    return token;
  }
}

function isDailyToken(value: unknown): value is { day: string; token: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'day' in value &&
    typeof value.day === 'string' &&
    'token' in value &&
    typeof value.token === 'string' &&
    /^[0-9a-f-]{36}$/i.test(value.token)
  );
}

export function publicPage(url: string): string | null {
  const path = url.split(/[?#]/)[0];
  const match =
    /^\/(ru|en)\/(competency\/articles|articles|competency\/matrix|how-this-site-is-built|updates|contacts|sitemap)(?:\/|$)/.exec(
      path,
    );
  if (match === null) return null;
  const pages: Record<string, string> = {
    articles: 'articles',
    'competency/articles': 'articles',
    'competency/matrix': 'matrix',
    'how-this-site-is-built': 'about',
    updates: 'updates',
    contacts: 'contacts',
    sitemap: 'sitemap',
  };
  return pages[match[2]] ?? null;
}
