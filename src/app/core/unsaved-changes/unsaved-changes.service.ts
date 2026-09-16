import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject } from '@angular/core';
import {
  UnsavedChangesService as DesignSystemUnsavedChangesService,
  UnsavedChangesScope,
} from '@alittlemore.dev/design-system';
import { I18nService } from '../i18n/i18n.service';

export { UnsavedChangesScope } from '@alittlemore.dev/design-system';
export type { UnsavedChangesSource, UnsavedValue } from '@alittlemore.dev/design-system';

@Injectable({ providedIn: 'root' })
export class UnsavedChangesService {
  private readonly changes = inject(DesignSystemUnsavedChangesService);
  private readonly document = inject(DOCUMENT);
  private readonly i18n = inject(I18nService);
  readonly hasChanges = this.changes.hasChanges;

  createScope(destroyRef: DestroyRef): UnsavedChangesScope {
    return this.changes.createScope(destroyRef, () => this.confirm());
  }

  confirmDiscard(): boolean {
    return this.changes.confirmDiscard(() => this.confirm());
  }

  discardChanges(): void {
    this.changes.discardChanges();
  }

  private confirm(): boolean {
    return (
      this.document.defaultView?.confirm(
        this.i18n.translate('adminUnsavedChanges.confirmDiscard'),
      ) ?? false
    );
  }
}
