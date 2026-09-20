import { TestBed } from '@angular/core/testing';
import { UnsavedChangesService } from '../../../core/unsaved-changes/unsaved-changes.service';
import { accountUnsavedChangesGuard } from './account-unsaved-changes.guard';

describe('accountUnsavedChangesGuard', () => {
  it.each([true, false])('returns the coordinator decision %s', (decision) => {
    const confirmDiscard = jest.fn(() => decision);
    TestBed.configureTestingModule({
      providers: [{ provide: UnsavedChangesService, useValue: { confirmDiscard } }],
    });

    const result = TestBed.runInInjectionContext(() =>
      accountUnsavedChangesGuard(null, {} as never, {} as never, {} as never),
    );

    expect(result).toBe(decision);
    expect(confirmDiscard).toHaveBeenCalledTimes(1);
  });
});
