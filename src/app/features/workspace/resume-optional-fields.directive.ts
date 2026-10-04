import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { AbstractControl } from '@angular/forms';

@Directive({ selector: 'details[appResumeOptionalFields]' })
export class ResumeOptionalFieldsDirective implements OnChanges {
  @Input({ required: true }) appResumeOptionalFields: readonly AbstractControl[] = [];
  @Input() validationAttempt = 0;
  private readonly element = inject<ElementRef<HTMLDetailsElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.document.defaultView) return;
    if (changes['appResumeOptionalFields'])
      this.element.nativeElement.open = this.appResumeOptionalFields.some((control) =>
        Boolean(control.value),
      );
    // Native disclosure state may have changed without changing Angular's bound values.
    if (
      this.validationAttempt > 0 &&
      this.appResumeOptionalFields.some((control) => control.invalid)
    )
      this.element.nativeElement.open = true;
  }
}
