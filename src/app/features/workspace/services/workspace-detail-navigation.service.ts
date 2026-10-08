import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class WorkspaceDetailNavigationService {
  private readonly router = inject(Router);
  private history: string[] = [];

  constructor() {
    this.record(this.router.url);
    this.router.events.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe((event) => {
      if (event instanceof NavigationEnd) this.record(event.urlAfterRedirects);
    });
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
