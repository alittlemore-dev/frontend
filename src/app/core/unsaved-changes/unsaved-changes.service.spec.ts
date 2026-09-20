import { DestroyRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { UnsavedChangesService } from './unsaved-changes.service';
import { I18nService } from '../i18n/i18n.service';

describe('Unsaved changes application adapter', () => {
  it('uses localized confirmation across application form scopes', () => {
    const translate = jest.fn(() => 'Discard local edits?');
    TestBed.configureTestingModule({
      providers: [{ provide: I18nService, useValue: { translate } }],
    });
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const service = TestBed.inject(UnsavedChangesService);
    const value = signal('original');
    const scope = service.createScope(TestBed.inject(DestroyRef));
    scope.registerSource(value, signal(true));
    value.set('edited');
    expect(service.confirmDiscard()).toBe(false);
    expect(confirm).toHaveBeenCalledWith('Discard local edits?');
    expect(translate).toHaveBeenCalledWith('shared.unsavedChanges.confirmDiscard');
    service.discardChanges();
    expect(service.hasChanges()).toBe(false);
    confirm.mockRestore();
  });
});
