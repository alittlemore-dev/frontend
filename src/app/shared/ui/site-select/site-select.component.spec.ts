import { PLATFORM_ID, Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { SiteSelectComponent, SiteSelectOption } from './site-select.component';

const OPTIONS: readonly SiteSelectOption[] = [
  { value: '', label: 'Not set' },
  { value: 'alpha', label: 'Alpha' },
  { value: 'beta', label: 'Beta' },
  { value: 'bravo', label: 'Bravo' },
  { value: 'charlie', label: 'Charlie' },
];

describe('SiteSelectComponent', () => {
  let fixture: ComponentFixture<SiteSelectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SiteSelectComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SiteSelectComponent);
    fixture.componentRef.setInput('inputId', 'example-select');
    fixture.componentRef.setInput('options', OPTIONS);
    fixture.componentRef.setInput('value', 'alpha');
    fixture.componentRef.setInput('controlSize', 'default');
    fixture.componentRef.setInput('appearance', 'default');
    fixture.componentRef.setInput('required', false);
    fixture.componentRef.setInput('invalid', false);
    fixture.componentRef.setInput('controlDisabled', false);
    fixture.componentRef.setInput('testId', 'example');
    fixture.detectChanges();
    installPopoverMethods(listbox());
  });

  it('renders the selected label and complete select-only combobox semantics', () => {
    const control = trigger();
    const popup = listbox();

    expect(control.textContent).toContain('Alpha');
    expect(control.getAttribute('role')).toBe('combobox');
    expect(control.getAttribute('aria-haspopup')).toBe('listbox');
    expect(control.getAttribute('aria-controls')).toBe(popup.id);
    expect(popup.id).toBe('example-select-listbox');
    expect(control.getAttribute('aria-expanded')).toBe('false');
    expect(control.getAttribute('aria-required')).toBeNull();
    expect(control.getAttribute('aria-invalid')).toBeNull();
    expect(popup.getAttribute('role')).toBe('listbox');
    expect(optionValues()).toEqual(['', 'alpha', 'beta', 'bravo', 'charlie']);
  });

  it('opens without changing the value and exposes the active option', () => {
    const valueChange = jest.fn();
    fixture.componentInstance.valueChange.subscribe(valueChange);

    dispatchKey(trigger(), 'ArrowDown');

    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(trigger().getAttribute('aria-activedescendant')).toBe(option('alpha').id);
    expect(option('alpha').getAttribute('aria-selected')).toBe('true');
    expect(valueChange).not.toHaveBeenCalled();
  });

  it('navigates without committing and accepts the active option with Enter', () => {
    const valueChange = jest.fn();
    fixture.componentInstance.valueChange.subscribe(valueChange);
    dispatchKey(trigger(), 'ArrowDown');

    dispatchKey(trigger(), 'ArrowDown');
    expect(trigger().textContent).toContain('Alpha');
    expect(trigger().getAttribute('aria-activedescendant')).toBe(option('beta').id);
    expect(valueChange).not.toHaveBeenCalled();

    dispatchKey(trigger(), 'Enter');
    expect(valueChange).toHaveBeenCalledWith('beta');
    expect(trigger().textContent).toContain('Beta');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger());
  });

  it('cancels keyboard navigation with Escape', () => {
    const valueChange = jest.fn();
    const parentKeydown = jest.fn();
    const parentKeyup = jest.fn();
    fixture.componentInstance.valueChange.subscribe(valueChange);
    fixture.nativeElement.addEventListener('keydown', parentKeydown);
    fixture.nativeElement.addEventListener('keyup', parentKeyup);
    dispatchKey(trigger(), 'ArrowDown');
    dispatchKey(trigger(), 'End');
    parentKeydown.mockClear();

    dispatchKey(trigger(), 'Escape');
    trigger().dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));

    expect(valueChange).not.toHaveBeenCalled();
    expect(trigger().textContent).toContain('Alpha');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(parentKeydown).not.toHaveBeenCalled();
    expect(parentKeyup).not.toHaveBeenCalled();
  });

  it('supports Home, End, PageUp, PageDown and locale-aware typeahead', () => {
    dispatchKey(trigger(), 'End');
    expect(activeValue()).toBe('charlie');

    dispatchKey(trigger(), 'Home');
    expect(activeValue()).toBe('');

    dispatchKey(trigger(), 'PageDown');
    expect(activeValue()).toBe('charlie');

    dispatchKey(trigger(), 'PageUp');
    expect(activeValue()).toBe('');

    dispatchKey(trigger(), 'b');
    expect(activeValue()).toBe('beta');

    dispatchKey(trigger(), 'b');
    expect(activeValue()).toBe('bravo');
  });

  it('commits on Tab without preventing normal focus traversal', () => {
    const valueChange = jest.fn();
    fixture.componentInstance.valueChange.subscribe(valueChange);
    dispatchKey(trigger(), 'ArrowDown');
    dispatchKey(trigger(), 'ArrowDown');
    const event = dispatchKey(trigger(), 'Tab');

    expect(valueChange).toHaveBeenCalledWith('beta');
    expect(event.defaultPrevented).toBe(false);
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('commits an option clicked with the pointer', () => {
    const valueChange = jest.fn();
    fixture.componentInstance.valueChange.subscribe(valueChange);
    trigger().click();
    fixture.detectChanges();

    option('charlie').click();
    fixture.detectChanges();

    expect(valueChange).toHaveBeenCalledWith('charlie');
    expect(trigger().textContent).toContain('Charlie');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('renders compact, bordered, invalid, required and disabled states', () => {
    fixture.componentRef.setInput('controlSize', 'small');
    fixture.componentRef.setInput('appearance', 'bordered');
    fixture.componentRef.setInput('required', true);
    fixture.componentRef.setInput('invalid', true);
    fixture.componentRef.setInput('controlDisabled', true);
    fixture.componentRef.setInput('ariaDescribedBy', 'example-error');
    fixture.detectChanges();

    expect(trigger().classList).toContain('site-select-trigger-small');
    expect(trigger().classList).toContain('site-select-trigger-bordered');
    expect(trigger().classList).toContain('is-invalid');
    expect(trigger().getAttribute('aria-required')).toBe('true');
    expect(trigger().getAttribute('aria-invalid')).toBe('true');
    expect(trigger().getAttribute('aria-describedby')).toBe('example-error');
    expect(trigger().disabled).toBe(true);

    trigger().click();
    fixture.detectChanges();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps external value and option updates synchronized', () => {
    fixture.componentRef.setInput('value', 'beta');
    fixture.detectChanges();
    expect(trigger().textContent).toContain('Beta');

    fixture.componentRef.setInput('options', [
      { value: '', label: 'Not set' },
      { value: 'delta', label: 'Delta' },
    ]);
    fixture.detectChanges();
    expect(trigger().textContent?.trim()).toBe('');
  });

  function trigger(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('#example-select') as HTMLButtonElement;
  }

  function listbox(): HTMLElement {
    return fixture.nativeElement.querySelector('[data-testid="example-listbox"]') as HTMLElement;
  }

  function option(value: string): HTMLElement {
    const element = [...listbox().querySelectorAll<HTMLElement>('[role="option"]')].find(
      (candidate) => candidate.dataset['value'] === value,
    );
    expect(element).toBeDefined();
    return element!;
  }

  function optionValues(): string[] {
    return [...listbox().querySelectorAll<HTMLElement>('[role="option"]')].map(
      (element) => element.dataset['value'] ?? '',
    );
  }

  function activeValue(): string {
    const activeId = trigger().getAttribute('aria-activedescendant');
    const active = activeId ? listbox().querySelector<HTMLElement>(`#${activeId}`) : null;
    return active?.dataset['value'] ?? '';
  }

  function dispatchKey(element: HTMLElement, key: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    fixture.detectChanges();
    return event;
  }
});

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, SiteSelectComponent],
  template: `
    <app-site-select
      inputId="form-select"
      [options]="options"
      controlSize="default"
      appearance="default"
      [required]="true"
      [invalid]="control.invalid && control.touched"
      [controlDisabled]="false"
      [formControl]="control"
    />
  `,
})
class SiteSelectFormHostComponent {
  readonly options = OPTIONS;
  readonly control = new FormControl('', {
    nonNullable: true,
    validators: Validators.required,
  });
}

describe('SiteSelectComponent with Angular Forms', () => {
  it('bridges values, disabled state, touched state and required validation', async () => {
    await TestBed.configureTestingModule({
      imports: [SiteSelectFormHostComponent],
    }).compileComponents();
    const fixture = TestBed.createComponent(SiteSelectFormHostComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement.querySelector('app-site-select') as HTMLElement;
    const trigger = host.querySelector('#form-select') as HTMLButtonElement;
    const popup = host.querySelector('[role="listbox"]') as HTMLElement;
    installPopoverMethods(popup);

    expect(fixture.componentInstance.control.hasError('required')).toBe(true);
    trigger.click();
    fixture.detectChanges();
    const beta = [...popup.querySelectorAll<HTMLElement>('[role="option"]')].find(
      (element) => element.dataset['value'] === 'beta',
    );
    beta?.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.control.value).toBe('beta');
    expect(fixture.componentInstance.control.touched).toBe(true);
    expect(fixture.componentInstance.control.valid).toBe(true);

    fixture.componentInstance.control.disable();
    fixture.detectChanges();
    expect(trigger.disabled).toBe(true);

    fixture.componentInstance.control.enable();
    fixture.componentInstance.control.setValue('alpha');
    fixture.detectChanges();
    expect(trigger.textContent).toContain('Alpha');
  });
});

describe('SiteSelectComponent on the server', () => {
  it('renders without accessing browser-only popover APIs', async () => {
    await TestBed.configureTestingModule({
      imports: [SiteSelectComponent],
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    }).compileComponents();
    const fixture = TestBed.createComponent(SiteSelectComponent);
    fixture.componentRef.setInput('inputId', 'server-select');
    fixture.componentRef.setInput('options', OPTIONS);
    fixture.componentRef.setInput('value', 'alpha');
    fixture.componentRef.setInput('controlSize', 'default');
    fixture.componentRef.setInput('appearance', 'default');
    fixture.componentRef.setInput('required', false);
    fixture.componentRef.setInput('invalid', false);
    fixture.componentRef.setInput('controlDisabled', false);

    expect(() => fixture.detectChanges()).not.toThrow();
    expect(fixture.nativeElement.querySelector('#server-select').textContent).toContain('Alpha');
  });
});

function installPopoverMethods(popover: HTMLElement): void {
  Object.defineProperty(popover, 'showPopover', {
    configurable: true,
    value: (): void => popover.setAttribute('data-popover-open', ''),
  });
  Object.defineProperty(popover, 'hidePopover', {
    configurable: true,
    value: (): void => popover.removeAttribute('data-popover-open'),
  });
}
