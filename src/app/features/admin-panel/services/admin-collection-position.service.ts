import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, Injector, afterNextRender, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationStart, Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AdminCollectionPositionService {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly positions = new Map<string, { top: number; href: string | null }>();

  constructor() {
    this.router.events.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((event) => {
      if (!(event instanceof NavigationStart) || !this.router.url.startsWith('/admin-panel/'))
        return;
      this.positions.set(this.router.url, {
        top: this.document.defaultView?.scrollY ?? 0,
        href: this.document.activeElement?.closest('a')?.getAttribute('href') ?? null,
      });
      if (this.positions.size > 40) this.positions.delete(this.positions.keys().next().value!);
    });
  }

  restore(): void {
    const url = this.router.url;
    const position = this.positions.get(url);
    if (position === undefined) return;
    afterNextRender(
      () => {
        if (this.router.url !== url) return;
        if (position.href !== null)
          Array.from(this.document.querySelectorAll<HTMLAnchorElement>('a[href]'))
            .find((link) => link.getAttribute('href') === position.href)
            ?.focus({ preventScroll: true });
        this.document.defaultView?.scrollTo({ top: position.top, behavior: 'instant' });
      },
      { injector: this.injector },
    );
  }
}
