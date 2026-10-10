import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, Injector, afterNextRender, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class WorkspaceDetailNavigationService {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly positions = new Map<string, number>();
  private history: string[] = [];

  constructor() {
    this.record(this.router.url);
    this.router.events.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((event) => {
      if (event instanceof NavigationStart && this.router.url.startsWith('/personal-workspace')) {
        this.positions.set(this.router.url, this.document.defaultView?.scrollY ?? 0);
        if (this.positions.size > 40) this.positions.delete(this.positions.keys().next().value!);
      }
      if (event instanceof NavigationEnd) this.record(event.urlAfterRedirects);
    });
  }

  restorePosition(): void {
    const url = this.router.url;
    const position = this.positions.get(url);
    if (position === undefined) return;
    afterNextRender(
      () => {
        if (this.router.url === url)
          this.document.defaultView?.scrollTo({ top: position, behavior: 'instant' });
      },
      { injector: this.injector },
    );
  }

  back(listRoute: string): void {
    const currentPath = this.router.url.split(/[?#]/u, 1)[0];
    const previous = this.history
      .slice(0, -1)
      .reverse()
      .find((url) => url.split(/[?#]/u, 1)[0] !== currentPath);
    if (previous !== undefined) {
      void this.router.navigateByUrl(previous);
      return;
    }
    void this.router.navigate([listRoute], { queryParamsHandling: 'preserve' });
  }

  private record(url: string): void {
    const path = url.split(/[?#]/u, 1)[0];
    if (path !== '/personal-workspace' && !path.startsWith('/personal-workspace/')) {
      this.history = [];
      return;
    }
    const existing = this.history.lastIndexOf(url);
    if (existing !== -1) {
      this.history = this.history.slice(0, existing + 1);
    } else {
      this.history.push(url);
    }
  }
}
