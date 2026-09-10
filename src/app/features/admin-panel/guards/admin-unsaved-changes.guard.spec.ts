import { TestBed } from '@angular/core/testing';
import { AdminUnsavedChangesService } from '../services/admin-unsaved-changes.service';
import { adminUnsavedChangesGuard } from './admin-unsaved-changes.guard';

describe('adminUnsavedChangesGuard', () => {
  it.each([true, false])('returns the coordinator decision %s', (decision) => {
    const confirmDiscard = jest.fn(() => decision);
    TestBed.configureTestingModule({
      providers: [{ provide: AdminUnsavedChangesService, useValue: { confirmDiscard } }],
    });

    const result = TestBed.runInInjectionContext(() =>
      adminUnsavedChangesGuard(null, {} as never, {} as never, {} as never),
    );

    expect(result).toBe(decision);
    expect(confirmDiscard).toHaveBeenCalledTimes(1);
  });
});
