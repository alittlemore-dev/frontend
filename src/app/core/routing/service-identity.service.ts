import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

export type SiteService = 'site' | 'workspace' | 'matrix' | 'articles' | 'admin';

const SERVICE_LOGOS: Record<SiteService, string> = {
  site: '/logo-64x64.webp',
  workspace: '/brand/archive-portal-64.png',
  matrix: '/logo-64x64.webp',
  articles: '/logo-64x64.webp',
  admin: '/brand/admin-frame-64.png',
};

@Injectable({ providedIn: 'root' })
export class ServiceIdentityService {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  readonly service = computed(() => serviceFromUrl(this.url()));
  readonly logo = computed(() => {
    const path = new URL(this.url(), 'http://localhost').pathname;
    if (/^\/(?:ru\/|en\/)?how-this-site-is-built\/?$/u.test(path)) return null;
    return SERVICE_LOGOS[this.service()];
  });
  readonly labelKey = computed(() => {
    const service = this.service();
    return service === 'site' ? 'siteBuild.hero.logoAlt' : `shell.services.${service}`;
  });

  constructor() {
    effect(() => {
      const favicon = this.document.querySelector<HTMLLinkElement>('#service-favicon');
      if (favicon === null) return;
      const service = this.service();
      favicon.href =
        service === 'admin'
          ? SERVICE_LOGOS.admin
          : service === 'workspace'
            ? '/brand/workspace-favicon.ico'
            : '/favicon.ico';
      favicon.type = service === 'admin' ? 'image/png' : 'image/x-icon';
    });
  }
}

export function serviceFromUrl(url: string): SiteService {
  const path = new URL(url, 'http://localhost').pathname;
  if (/^\/personal-workspace(?:\/|$)/u.test(path)) return 'workspace';
  if (/^\/admin-panel(?:\/|$)/u.test(path)) return 'admin';
  if (/^\/(?:ru\/|en\/)?competency\/matrix(?:\/|$)/u.test(path)) return 'matrix';
  if (/^\/(?:ru\/|en\/)?competency\/articles(?:\/|$)/u.test(path)) return 'articles';
  return 'site';
}
