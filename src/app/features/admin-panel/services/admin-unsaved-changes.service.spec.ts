import { DOCUMENT } from '@angular/common';
import { DestroyRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../../core/i18n/i18n.service';
import {
  AdminUnsavedChangesService,
  AdminUnsavedChangesSource,
} from './admin-unsaved-changes.service';

class TestDestroyRef extends DestroyRef {
  override destroyed = false;
  private readonly callbacks = new Set<() => void>();

  override onDestroy(callback: () => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  destroy(): void {
    this.destroyed = true;
    for (const callback of this.callbacks) callback();
    this.callbacks.clear();
  }
}

describe('AdminUnsavedChangesService', () => {
  let service: AdminUnsavedChangesService;
  let destroyRef: TestDestroyRef;
  let translate: jest.Mock<string, [string]>;
  let browserWindow: Window;

  beforeEach(() => {
    translate = jest.fn(() => 'Discard unsaved changes?');
    TestBed.configureTestingModule({
      providers: [AdminUnsavedChangesService, { provide: I18nService, useValue: { translate } }],
    });
    service = TestBed.inject(AdminUnsavedChangesService);
    destroyRef = new TestDestroyRef();
    browserWindow = TestBed.inject(DOCUMENT).defaultView as Window;
  });

  afterEach(() => {
    destroyRef.destroy();
    jest.restoreAllMocks();
  });

  it('compares current state with its baseline and becomes clean after a full revert', () => {
    const current = signal<unknown>({ title: 'Draft', tags: new Set(['angular', 'python']) });
    const active = signal(true);
    const scope = service.createScope(destroyRef);

    scope.registerSource(current, active);

    expect(scope.hasChanges()).toBe(false);
    current.set({ title: 'Changed', tags: new Set(['python', 'angular']) });
    expect(scope.hasChanges()).toBe(true);
    current.set({ title: 'Draft', tags: new Set(['python', 'angular']) });
    expect(scope.hasChanges()).toBe(false);
  });

  it('normalizes files by metadata instead of object identity', () => {
    const current = signal<unknown>(
      new File(['first'], 'cover.png', { type: 'image/png', lastModified: 123 }),
    );
    const active = signal(true);
    const scope = service.createScope(destroyRef);

    scope.registerSource(current, active);
    current.set(new File(['first'], 'cover.png', { type: 'image/png', lastModified: 123 }));
    expect(scope.hasChanges()).toBe(false);

    current.set(
      new File(['larger payload'], 'cover.png', { type: 'image/png', lastModified: 123 }),
    );
    expect(scope.hasChanges()).toBe(true);
  });

  it('commits a source or the whole scope as the new baseline', () => {
    const first = signal<unknown>('first');
    const second = signal<unknown>('second');
    const active = signal(true);
    const scope = service.createScope(destroyRef);
    const firstRegistration: AdminUnsavedChangesSource = scope.registerSource(first, active);
    scope.registerSource(second, active);

    first.set('changed first');
    second.set('changed second');
    firstRegistration.commit();
    expect(firstRegistration.hasChanges()).toBe(false);
    expect(scope.hasChanges()).toBe(true);

    scope.commit();
    expect(scope.hasChanges()).toBe(false);
  });

  it('confirms only changes outside explicitly preserved sources', () => {
    const confirm = jest.spyOn(browserWindow, 'confirm').mockReturnValue(false);
    const first = signal<unknown>('first');
    const second = signal<unknown>('second');
    const scope = service.createScope(destroyRef);
    const firstRegistration = scope.registerSource(first, signal(true));
    scope.registerSource(second, signal(true));

    first.set('changed first');
    expect(scope.confirmDiscardExcept([firstRegistration])).toBe(true);
    expect(confirm).not.toHaveBeenCalled();

    second.set('changed second');
    expect(scope.confirmDiscardExcept([firstRegistration])).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('accepts all current changes after an explicit global discard', () => {
    const current = signal<unknown>('initial');
    const scope = service.createScope(destroyRef);
    scope.registerSource(current, signal(true));
    current.set('changed');

    service.discardChanges();

    expect(service.hasChanges()).toBe(false);
  });

  it('ignores inactive and unregistered sources', () => {
    const current = signal<unknown>('initial');
    const active = signal(true);
    const scope = service.createScope(destroyRef);
    const registration = scope.registerSource(current, active);

    current.set('changed');
    expect(scope.hasChanges()).toBe(true);
    active.set(false);
    expect(scope.hasChanges()).toBe(false);
    active.set(true);
    expect(scope.hasChanges()).toBe(true);

    registration.unregister();
    expect(scope.hasChanges()).toBe(false);
  });

  it('removes a destroyed scope from global state', () => {
    const current = signal<unknown>('initial');
    const scope = service.createScope(destroyRef);
    scope.registerSource(current, signal(true));
    current.set('changed');

    expect(service.hasChanges()).toBe(true);
    destroyRef.destroy();
    expect(service.hasChanges()).toBe(false);
  });

  it('asks for localized confirmation only when changes exist', () => {
    const confirm = jest.spyOn(browserWindow, 'confirm').mockReturnValue(false);
    const current = signal<unknown>('initial');
    const scope = service.createScope(destroyRef);
    scope.registerSource(current, signal(true));

    expect(scope.confirmDiscard()).toBe(true);
    expect(confirm).not.toHaveBeenCalled();

    current.set('changed');
    expect(scope.confirmDiscard()).toBe(false);
    expect(service.confirmDiscard()).toBe(false);
    expect(translate).toHaveBeenCalledWith('adminUnsavedChanges.confirmDiscard');
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
  });

  it('installs beforeunload only while at least one scope has changes', () => {
    const addEventListener = jest.spyOn(browserWindow, 'addEventListener');
    const removeEventListener = jest.spyOn(browserWindow, 'removeEventListener');
    const current = signal<unknown>('initial');
    const scope = service.createScope(destroyRef);
    scope.registerSource(current, signal(true));

    TestBed.tick();
    expect(addEventListener).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));

    current.set('changed');
    TestBed.tick();
    expect(addEventListener).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    const listener = addEventListener.mock.calls.find(([type]) => type === 'beforeunload')?.[1];
    const event = new Event('beforeunload', { cancelable: true });
    (listener as EventListener)(event);
    expect(event.defaultPrevented).toBe(true);

    current.set('initial');
    TestBed.tick();
    expect(removeEventListener).toHaveBeenCalledWith('beforeunload', listener);
  });
});
