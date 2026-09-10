import { Directive, inject } from '@angular/core';
import { NgControl } from '@angular/forms';
import { controlInvalid } from '../utils/admin-validation';

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector -- Native text controls need automatic validation state without per-field attributes.
  selector: 'input[formControlName], textarea[formControlName]',
  standalone: true,
  host: {
    '[class.is-invalid]': 'invalid',
    '[attr.aria-invalid]': "invalid ? 'true' : null",
  },
})
export class AdminControlValidationStateDirective {
  private readonly ngControl = inject(NgControl, { self: true, optional: true });

  get invalid(): boolean {
    const control = this.ngControl?.control;
    return control !== null && control !== undefined && controlInvalid(control, false);
  }
}
