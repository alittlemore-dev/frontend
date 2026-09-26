import { isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  DestroyRef,
  Directive,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  PLATFORM_ID,
  Renderer2,
  effect,
  inject,
  numberAttribute,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgControl } from '@angular/forms';
import { I18nService } from '../../core/i18n/i18n.service';

let nextCounterId = 0;

@Directive({
  selector:
    'input[appResumeTextLimit][formControlName], textarea[appResumeTextLimit][formControlName]',
  standalone: true,
  host: { class: 'resume-limited-input' },
})
export class ResumeTextLimitDirective implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true, transform: numberAttribute }) appResumeTextLimit = 0;

  private readonly element = inject<ElementRef<HTMLInputElement | HTMLTextAreaElement>>(ElementRef);
  private readonly control = inject(NgControl, { self: true });
  private readonly renderer = inject(Renderer2);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private counter: HTMLElement | null = null;
  private originalDescription: string | null = null;

  constructor() {
    effect(() => {
      this.i18n.language();
      this.update();
    });
  }

  ngAfterViewInit(): void {
    if (!this.browser) return;
    const input = this.element.nativeElement;
    const parent = this.renderer.parentNode(input);
    if (parent === null) return;

    const counter = this.renderer.createElement('span') as HTMLElement;
    const id = input.id ? `${input.id}-limit` : `resume-text-limit-${++nextCounterId}`;
    this.renderer.setAttribute(counter, 'id', id);
    this.renderer.addClass(counter, 'resume-text-limit-counter');
    this.renderer.insertBefore(parent, counter, this.renderer.nextSibling(input));
    this.originalDescription = input.getAttribute('aria-describedby');
    this.renderer.setAttribute(
      input,
      'aria-describedby',
      [this.originalDescription, id].filter(Boolean).join(' '),
    );
    this.counter = counter;
    this.control.control?.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value: unknown) => this.update(value));
    this.update();
  }

  ngOnChanges(): void {
    this.update();
  }

  @HostListener('input')
  onInput(): void {
    this.update(this.element.nativeElement.value);
  }

  ngOnDestroy(): void {
    if (this.counter === null) return;
    const input = this.element.nativeElement;
    const parent = this.renderer.parentNode(this.counter);
    if (parent !== null) this.renderer.removeChild(parent, this.counter);
    if (this.originalDescription === null) {
      this.renderer.removeAttribute(input, 'aria-describedby');
    } else {
      this.renderer.setAttribute(input, 'aria-describedby', this.originalDescription);
    }
  }

  private update(value: unknown = this.control.control?.value): void {
    if (this.counter === null) return;
    const length =
      typeof value === 'string' ? value.length : this.element.nativeElement.value.length;
    const exceeded = length > this.appResumeTextLimit;
    const near = !exceeded && length >= this.appResumeTextLimit * 0.9;
    const input = this.element.nativeElement;

    this.renderer.setProperty(this.counter, 'textContent', `${length}/${this.appResumeTextLimit}`);
    this.renderer.setAttribute(
      this.counter,
      'aria-label',
      this.i18n.translate(
        exceeded ? 'resumeWorkspace.limit.charactersExceeded' : 'resumeWorkspace.limit.characters',
        { actual: length, max: this.appResumeTextLimit },
      ),
    );
    this.renderer.setAttribute(this.counter, 'aria-live', exceeded ? 'polite' : 'off');
    this.renderer[exceeded ? 'addClass' : 'removeClass'](input, 'resume-limit-exceeded');
    this.renderer[exceeded ? 'addClass' : 'removeClass'](this.counter, 'resume-limit-exceeded');
    this.renderer[near ? 'addClass' : 'removeClass'](this.counter, 'resume-limit-near');
  }
}
