import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import {
  KnowledgeQuickCreateDialogComponent,
  KnowledgeQuickCreateForm,
  KnowledgeQuickCreateKind,
} from './quick-create-dialog.component';

describe('KnowledgeQuickCreateDialogComponent keyboard interaction', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [KnowledgeQuickCreateDialogComponent],
      providers: [provideI18nTesting()],
    }),
  );

  function create(kind: KnowledgeQuickCreateKind, embedded: boolean) {
    const fixture = TestBed.createComponent(KnowledgeQuickCreateDialogComponent);
    const names = {
      firstName: new FormControl('', { nonNullable: true }),
      lastName: new FormControl('', { nonNullable: true }),
    };
    const date = new FormGroup({
      day: new FormControl('', { nonNullable: true }),
      month: new FormControl('', { nonNullable: true }),
      year: new FormControl<number | null>(null),
    });
    const form: KnowledgeQuickCreateForm =
      kind === 'person'
        ? new FormGroup(names)
        : kind === 'birthday'
          ? new FormGroup({ ...names, date })
          : new FormGroup({ displayName: new FormControl('', { nonNullable: true }), date });
    fixture.componentRef.setInput('kind', kind);
    fixture.componentRef.setInput('embedded', embedded);
    fixture.componentRef.setInput('form', form);
    fixture.componentRef.setInput('submitting', false);
    fixture.componentRef.setInput('submitted', false);
    fixture.componentRef.setInput('error', null);
    fixture.detectChanges();
    return fixture;
  }

  it.each(['person', 'birthday', 'date'] as const)(
    'allows native typing, deletion, selection, paste and navigation in the %s dialog',
    (kind) => {
      const fixture = create(kind, false);
      const close = jest.fn();
      fixture.componentInstance.closeRequested.subscribe(close);
      const inputs = (fixture.nativeElement as HTMLElement).querySelectorAll('input');
      expect(inputs.length).toBeGreaterThan(0);
      for (const input of inputs) {
        for (const options of [
          { key: 'a' },
          { key: ' ' },
          { key: 'Backspace' },
          { key: 'Delete' },
          { key: 'ArrowLeft' },
          { key: 'Tab' },
          { key: 'Enter' },
          { key: 'a', ctrlKey: true },
          { key: 'v', ctrlKey: true },
          { key: 'a', metaKey: true },
          { key: 'v', metaKey: true },
        ]) {
          const event = new KeyboardEvent('keydown', {
            ...options,
            bubbles: true,
            cancelable: true,
          });
          input.dispatchEvent(event);
          expect(event.defaultPrevented).toBe(false);
        }
      }
      expect(close).not.toHaveBeenCalled();
    },
  );

  it('requests closing once when Escape is pressed inside a field', () => {
    const fixture = create('date', false);
    const close = jest.fn();
    fixture.componentInstance.closeRequested.subscribe(close);
    (fixture.nativeElement as HTMLElement)
      .querySelector('input')!
      .dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
    expect(close).toHaveBeenCalledTimes(1);
  });

  it.each(['person', 'birthday', 'date'] as const)(
    'allows native text input when the %s fields are embedded in the calendar form',
    (kind) => {
      const fixture = create(kind, true);
      const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;
      const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
      input.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      input.value = 'Keyboard input';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      expect(fixture.componentInstance.form().value).toMatchObject(
        kind === 'date' ? { displayName: 'Keyboard input' } : { firstName: 'Keyboard input' },
      );
    },
  );
});
