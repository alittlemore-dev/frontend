import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { AdminUnsavedChangesService } from '../services/admin-unsaved-changes.service';

export const adminUnsavedChangesGuard: CanDeactivateFn<unknown> = () =>
  inject(AdminUnsavedChangesService).confirmDiscard();
