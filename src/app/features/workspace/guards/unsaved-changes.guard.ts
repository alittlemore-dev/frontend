import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { UnsavedChangesService } from '../../../core/unsaved-changes/unsaved-changes.service';

export const unsavedChangesGuard: CanDeactivateFn<unknown> = () =>
  inject(UnsavedChangesService).confirmDiscard();
