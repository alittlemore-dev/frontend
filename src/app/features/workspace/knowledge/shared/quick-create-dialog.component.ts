import {
  ErrorMessageComponent,
  SiteSelectComponent,
  SiteSelectOption,
} from '@alittlemore.dev/design-system';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ApiError } from '../../../../core/models/api-error.model';
import { VALIDATION_LIMITS, controlInvalid, validationMessage } from '../../utils/validation';

export type KnowledgeQuickCreateKind = 'person' | 'birthday' | 'date';
export interface AnnualDateControls {
  day: FormControl<string>;
  month: FormControl<string>;
  year: FormControl<number | null>;
}
export interface PersonQuickCreateControls {
  firstName: FormControl<string>;
  lastName: FormControl<string>;
}
export interface BirthdayQuickCreateControls extends PersonQuickCreateControls {
  date: FormGroup<AnnualDateControls>;
}
export interface DateQuickCreateControls {
  displayName: FormControl<string>;
  date: FormGroup<AnnualDateControls>;
}
export type KnowledgeQuickCreateForm =
  | FormGroup<PersonQuickCreateControls>
  | FormGroup<BirthdayQuickCreateControls>
  | FormGroup<DateQuickCreateControls>;

@Component({
  selector: 'app-knowledge-quick-create-dialog',
  standalone: true,
  imports: [
    CdkTrapFocus,
    NgTemplateOutlet,
    ReactiveFormsModule,
    TranslatePipe,
    ErrorMessageComponent,
    SiteSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './quick-create-dialog.component.html',
})
export class KnowledgeQuickCreateDialogComponent {
  private readonly i18n = inject(I18nService);
  readonly kind = input.required<KnowledgeQuickCreateKind>();
  readonly embedded = input(false);
  readonly form = input.required<KnowledgeQuickCreateForm>();
  readonly submitting = input.required<boolean>();
  readonly submitted = input.required<boolean>();
  readonly error = input.required<ApiError | null>();
  readonly titleKeyOverride = input<string | null>(null);
  readonly submitRequested = output<void>();
  readonly closeRequested = output<void>();
  readonly limits = VALIDATION_LIMITS;
  readonly titleKey = computed(
    () =>
      this.titleKeyOverride() ??
      (this.kind() === 'date'
        ? 'knowledgeDates.createTitle'
        : this.kind() === 'birthday'
          ? 'workspaceDashboard.calendar.createBirthday'
          : 'knowledgePeople.createTitle'),
  );
  readonly dayOptions: readonly SiteSelectOption[] = Array.from({ length: 31 }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  }));
  readonly monthOptions = computed<readonly SiteSelectOption[]>(() => {
    const formatter = new Intl.DateTimeFormat(this.i18n.dateLocale(), {
      month: 'long',
      timeZone: 'UTC',
    });
    return Array.from({ length: 12 }, (_, month) => ({
      value: String(month + 1),
      label: formatter.format(new Date(Date.UTC(2000, month, 1))),
    }));
  });

  invalid(field: string): boolean {
    const form: AbstractControl<unknown> = this.form();
    const control = form.get(field);
    return control !== null && controlInvalid(control, this.submitted());
  }

  message(field: string): string | null {
    const form: AbstractControl<unknown> = this.form();
    const control = form.get(field);
    return control === null ? null : validationMessage(control, this.i18n);
  }
}
