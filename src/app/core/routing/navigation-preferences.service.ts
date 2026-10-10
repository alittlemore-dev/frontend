import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class NavigationPreferencesService {
  private readonly document = inject(DOCUMENT);

  collapsed(scope: 'workspace' | 'admin'): boolean {
    try {
      return (
        this.document.defaultView?.localStorage.getItem(`${scope}NavigationCollapsed`) === 'true'
      );
    } catch {
      return false;
    }
  }

  setCollapsed(scope: 'workspace' | 'admin', collapsed: boolean): void {
    try {
      this.document.defaultView?.localStorage.setItem(
        `${scope}NavigationCollapsed`,
        String(collapsed),
      );
    } catch {
      return;
    }
  }
}
