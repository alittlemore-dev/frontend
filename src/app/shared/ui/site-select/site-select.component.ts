import { isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  PLATFORM_ID,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';

export interface SiteSelectOption {
  readonly value: string;
  readonly label: string;
}

interface RenderedSiteSelectOption extends SiteSelectOption {
  readonly id: string;
  readonly index: number;
  readonly active: boolean;
  readonly committed: boolean;
}

export type SiteSelectAppearance = 'default' | 'bordered';
export type SiteSelectControlSize = 'default' | 'small';

const PAGE_JUMP = 10;
const TYPEAHEAD_RESET_MILLISECONDS = 700;

@Component({
  selector: 'app-site-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './site-select.component.html',
  styleUrl: './site-select.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SiteSelectComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => SiteSelectComponent),
      multi: true,
    },
  ],
})
export class SiteSelectComponent implements ControlValueAccessor, Validator {
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly triggerElement =
    viewChild.required<ElementRef<HTMLButtonElement>>('selectTrigger');
  private readonly listboxElement = viewChild.required<ElementRef<HTMLElement>>('selectListbox');
  private readonly optionElements = viewChildren<ElementRef<HTMLElement>>('selectOption');

  readonly inputId = input.required<string>();
  readonly options = input.required<readonly SiteSelectOption[]>();
  readonly value = input<string>();
  readonly controlSize = input.required<SiteSelectControlSize>();
  readonly appearance = input.required<SiteSelectAppearance>();
  readonly required = input.required<boolean>();
  readonly invalid = input.required<boolean>();
  readonly controlDisabled = input.required<boolean>();
  readonly testId = input<string>();
  readonly ariaDescribedBy = input<string>();

  readonly valueChange = output<string>();

  readonly open = signal(false);
  readonly activeIndex = signal<number | null>(null);
  readonly formValue = signal('');
  readonly formDisabled = signal(false);

  readonly listboxId = computed(() => `${this.inputId()}-listbox`);
  readonly listboxTestId = computed(() => {
    const testId = this.testId();
    return testId === undefined ? null : `${testId}-listbox`;
  });
  readonly effectiveDisabled = computed(() => this.controlDisabled() || this.formDisabled());
  readonly selectedOption = computed(
    () => this.options().find((option) => option.value === this.formValue()) ?? null,
  );
  readonly displayLabel = computed(() => this.selectedOption()?.label ?? '');
  readonly activeOptionId = computed(() => {
    if (!this.open()) return null;
    const index = this.activeIndex();
    return index === null ? null : `${this.listboxId()}-option-${index}`;
  });
  readonly renderedOptions = computed<readonly RenderedSiteSelectOption[]>(() => {
    const activeIndex = this.activeIndex();
    const committedValue = this.formValue();
    return this.options().map((option, index) => ({
      ...option,
      id: `${this.listboxId()}-option-${index}`,
      index,
      active: this.open() && index === activeIndex,
      committed: option.value === committedValue,
    }));
  });

  private onFormChange: ((value: string) => void) | null = null;
  private onFormTouched: (() => void) | null = null;
  private onValidatorChange: (() => void) | null = null;
  private typeaheadBuffer = '';
  private typeaheadUpdatedAt = 0;
  private pendingInitialActive: 'selected' | 'first' | 'last' = 'selected';
  private suppressNextEscapeKeyup = false;

  private readonly externalValueEffect = effect(() => {
    const externalValue = this.value();
    if (externalValue !== undefined) {
      this.formValue.set(externalValue);
      this.onValidatorChange?.();
    }
  });

  writeValue(value: unknown): void {
    this.formValue.set(typeof value === 'string' ? value : '');
  }

  focus(options: FocusOptions): void {
    if (this.isBrowser) {
      this.triggerElement().nativeElement.focus(options);
    }
  }

  scrollIntoView(options: ScrollIntoViewOptions): void {
    const scrollIntoView = this.triggerElement().nativeElement.scrollIntoView;
    if (this.isBrowser && typeof scrollIntoView === 'function') {
      scrollIntoView.call(this.triggerElement().nativeElement, options);
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onFormChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onFormTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.formDisabled.set(disabled);
    if (disabled && this.open()) this.closeList(false);
  }

  validate(control: AbstractControl<unknown>): ValidationErrors | null {
    const value = typeof control.value === 'string' ? control.value : '';
    return this.required() && value.trim() === '' ? { required: true } : null;
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  onTriggerClick(): void {
    if (this.open()) return;
    const initialActive = this.pendingInitialActive;
    this.pendingInitialActive = 'selected';
    this.prepareOpen(initialActive);
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (this.effectiveDisabled()) return;
    if (event.key !== 'Escape') this.suppressNextEscapeKeyup = false;
    if (this.open()) {
      this.handleOpenKeydown(event);
      return;
    }
    this.handleClosedKeydown(event);
  }

  onTriggerKeyup(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || !this.suppressNextEscapeKeyup) return;
    this.suppressNextEscapeKeyup = false;
    event.preventDefault();
    event.stopPropagation();
  }

  chooseOption(index: number): void {
    this.commitIndex(index, true);
  }

  onPopoverToggle(event: ToggleEvent): void {
    if (event.newState === 'open') {
      this.open.set(true);
      this.changeDetectorRef.detectChanges();
      this.scrollActiveOptionIntoView();
      return;
    }
    if (!this.open()) return;
    this.open.set(false);
    this.activeIndex.set(null);
    this.resetTypeahead();
    this.markTouched();
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  onViewportChange(): void {
    if (this.open()) this.closeList(false);
  }

  private handleClosedKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.openViaTrigger('selected');
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.openViaTrigger('first');
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.openViaTrigger('selected');
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      this.openViaTrigger('first');
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      this.openViaTrigger('last');
      return;
    }
    if (isPrintableKey(event)) {
      event.preventDefault();
      this.openViaTrigger('selected');
      this.moveByTypeahead(event.key);
    }
  }

  private handleOpenKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.suppressNextEscapeKeyup = true;
      event.preventDefault();
      event.stopPropagation();
      this.closeList(true);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.commitActive(true);
      return;
    }
    if (event.key === 'Tab') {
      this.commitActive(false);
      return;
    }
    if (event.altKey && event.key === 'ArrowUp') {
      event.preventDefault();
      this.commitActive(true);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.moveActive(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.moveActive(-1);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      this.setActiveIndex(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      this.setActiveIndex(this.options().length - 1);
      return;
    }
    if (event.key === 'PageDown') {
      event.preventDefault();
      this.moveActive(PAGE_JUMP);
      return;
    }
    if (event.key === 'PageUp') {
      event.preventDefault();
      this.moveActive(-PAGE_JUMP);
      return;
    }
    if (isPrintableKey(event)) {
      event.preventDefault();
      this.moveByTypeahead(event.key);
    }
  }

  private openViaTrigger(initialActive: 'selected' | 'first' | 'last'): void {
    this.pendingInitialActive = initialActive;
    this.triggerElement().nativeElement.click();
  }

  private prepareOpen(initialActive: 'selected' | 'first' | 'last'): void {
    const options = this.options();
    if (this.effectiveDisabled() || options.length === 0) return;
    let index = options.findIndex((option) => option.value === this.formValue());
    if (initialActive === 'first' || index < 0) index = 0;
    if (initialActive === 'last') index = options.length - 1;
    this.activeIndex.set(index);
    this.open.set(true);
    this.resetTypeahead();
    this.changeDetectorRef.detectChanges();
  }

  private closeList(restoreFocus: boolean): void {
    const listbox = this.listboxElement().nativeElement;
    this.open.set(false);
    this.activeIndex.set(null);
    this.resetTypeahead();
    if (this.isBrowser && typeof listbox.hidePopover === 'function') {
      try {
        listbox.hidePopover();
      } catch {
        // The native popover may already have been dismissed by the browser.
      }
    }
    this.markTouched();
    this.changeDetectorRef.detectChanges();
    if (restoreFocus) this.focus({ preventScroll: false });
  }

  private commitActive(restoreFocus: boolean): void {
    const index = this.activeIndex();
    if (index === null) {
      this.closeList(restoreFocus);
      return;
    }
    this.commitIndex(index, restoreFocus);
  }

  private commitIndex(index: number, restoreFocus: boolean): void {
    const option = this.options()[index];
    if (option === undefined) return;
    this.formValue.set(option.value);
    this.valueChange.emit(option.value);
    this.onFormChange?.(option.value);
    this.onValidatorChange?.();
    this.closeList(restoreFocus);
  }

  private moveActive(delta: number): void {
    const options = this.options();
    if (options.length === 0) return;
    const current = this.activeIndex() ?? 0;
    this.setActiveIndex(Math.min(Math.max(current + delta, 0), options.length - 1));
  }

  private setActiveIndex(index: number): void {
    if (this.options().length === 0) return;
    const normalizedIndex = Math.min(Math.max(index, 0), this.options().length - 1);
    this.activeIndex.set(normalizedIndex);
    this.changeDetectorRef.detectChanges();
    this.scrollActiveOptionIntoView();
  }

  private moveByTypeahead(key: string): void {
    const options = this.options();
    if (options.length === 0) return;
    const now = Date.now();
    const normalizedKey = normalizeLabel(key);
    const withinSequence = now - this.typeaheadUpdatedAt <= TYPEAHEAD_RESET_MILLISECONDS;
    const repeatedCharacter =
      withinSequence &&
      this.typeaheadBuffer.length > 0 &&
      [...this.typeaheadBuffer].every((character) => character === normalizedKey);
    this.typeaheadBuffer = withinSequence
      ? `${this.typeaheadBuffer}${normalizedKey}`
      : normalizedKey;
    this.typeaheadUpdatedAt = now;
    const search = repeatedCharacter ? normalizedKey : this.typeaheadBuffer;
    const startIndex = repeatedCharacter ? (this.activeIndex() ?? -1) + 1 : 0;
    const match = findMatchingIndex(options, search, startIndex);
    if (match !== null) this.setActiveIndex(match);
  }

  private scrollActiveOptionIntoView(): void {
    const index = this.activeIndex();
    if (index === null || !this.isBrowser) return;
    const option = this.optionElements().find(
      (element) => Number(element.nativeElement.dataset['index']) === index,
    );
    if (option === undefined) return;
    const scrollIntoView = option.nativeElement.scrollIntoView;
    if (typeof scrollIntoView === 'function') {
      scrollIntoView.call(option.nativeElement, { block: 'nearest' });
    }
  }

  private resetTypeahead(): void {
    this.typeaheadBuffer = '';
    this.typeaheadUpdatedAt = 0;
  }

  private markTouched(): void {
    this.onFormTouched?.();
  }
}

function findMatchingIndex(
  options: readonly SiteSelectOption[],
  search: string,
  startIndex: number,
): number | null {
  for (let offset = 0; offset < options.length; offset += 1) {
    const index = (startIndex + offset) % options.length;
    if (normalizeLabel(options[index].label).startsWith(search)) return index;
  }
  return null;
}

function normalizeLabel(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function isPrintableKey(event: KeyboardEvent): boolean {
  return (
    event.key.length === 1 &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    event.key.trim() !== ''
  );
}
