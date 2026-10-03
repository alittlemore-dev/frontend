import { NotificationService } from '@alittlemore.dev/design-system';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { Temporal } from 'temporal-polyfill';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { ApiError } from '../../../../core/models/api-error.model';
import {
  UnsavedChangesService,
  UnsavedChangesSource,
  UnsavedValue,
} from '../../../../core/unsaved-changes/unsaved-changes.service';
import { KnowledgeDatesService } from '../../knowledge/dates/services/dates.service';
import { PeopleService } from '../../knowledge/people/services/people.service';
import { annualDateValidator } from '../../knowledge/shared/annual-date';
import {
  AnnualDateControls,
  BirthdayQuickCreateControls,
  DateQuickCreateControls,
  KnowledgeQuickCreateDialogComponent,
  KnowledgeQuickCreateForm,
} from '../../knowledge/shared/quick-create-dialog.component';
import { VALIDATION_LIMITS, trimRequired } from '../../utils/validation';

@Component({
  selector: 'app-calendar-knowledge-create',
  standalone: true,
  imports: [KnowledgeQuickCreateDialogComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-knowledge-quick-create-dialog
    [kind]="kind()"
    [embedded]="embedded()"
    [form]="form"
    [submitting]="submitting()"
    [submitted]="submitted()"
    [error]="error()"
    [titleKeyOverride]="titleKey()"
    (submitRequested)="save()"
    (closeRequested)="close()"
    ><ng-content
  /></app-knowledge-quick-create-dialog>`,
})
export class CalendarKnowledgeCreateComponent {
  private readonly people = inject(PeopleService);
  private readonly dates = inject(KnowledgeDatesService);
  private readonly i18n = inject(I18nService);
  private readonly notifications = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly unsavedScope = inject(UnsavedChangesService).createScope(this.destroyRef);
  private readonly unsavedSource: UnsavedChangesSource;
  readonly kind = input.required<'birthday' | 'date'>();
  readonly embedded = input(false);
  readonly initialDate = input.required<string | null>();
  readonly titleKey = input<string | null>(null);
  readonly saved = output<void>();
  readonly closed = output<void>();
  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly active = signal(true);
  readonly snapshot = signal<UnsavedValue>({});
  readonly birthdayForm = new FormGroup<BirthdayQuickCreateControls>({
    firstName: new FormControl('', {
      nonNullable: true,
      validators: [trimRequired, Validators.maxLength(VALIDATION_LIMITS.shortText)],
    }),
    lastName: new FormControl('', {
      nonNullable: true,
      validators: [trimRequired, Validators.maxLength(VALIDATION_LIMITS.shortText)],
    }),
    date: createDateGroup(),
  });
  readonly dateForm = new FormGroup<DateQuickCreateControls>({
    displayName: new FormControl('', {
      nonNullable: true,
      validators: [trimRequired, Validators.maxLength(VALIDATION_LIMITS.shortText)],
    }),
    date: createDateGroup(),
  });

  get form(): KnowledgeQuickCreateForm {
    return this.kind() === 'birthday' ? this.birthdayForm : this.dateForm;
  }

  constructor() {
    this.unsavedSource = this.unsavedScope.registerSource(this.snapshot, this.active);
    this.birthdayForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.snapshot.set(this.birthdayForm.getRawValue()));
    this.dateForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.snapshot.set(this.dateForm.getRawValue()));
    effect(() => {
      const initial = this.initialDate();
      const kind = this.kind();
      untracked(() => {
        this.submitted.set(false);
        this.error.set(null);
        const date = initial === null ? null : Temporal.PlainDate.from(initial);
        const value = {
          day: date === null ? '' : String(date.day),
          month: date === null ? '' : String(date.month),
          year: null,
        };
        if (kind === 'birthday')
          this.birthdayForm.reset({ firstName: '', lastName: '', date: value });
        else this.dateForm.reset({ displayName: '', date: value });
        this.snapshot.set(this.form.getRawValue());
        this.unsavedSource.commit();
      });
    });
  }

  close(): void {
    if (!this.confirmDiscard()) return;
    this.active.set(false);
    this.closed.emit();
  }

  confirmDiscard(): boolean {
    return !this.submitting() && this.unsavedScope.confirmDiscard();
  }

  save(): void {
    if (this.submitting()) return;
    this.submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notifications.error(
        this.i18n.translate(
          this.kind() === 'birthday'
            ? 'knowledgePeople.validationError'
            : 'knowledgeDates.validationError',
        ),
      );
      return;
    }
    const dateValue =
      this.kind() === 'birthday'
        ? this.birthdayForm.getRawValue().date
        : this.dateForm.getRawValue().date;
    const date = {
      day: Number(dateValue.day),
      month: Number(dateValue.month),
      year: dateValue.year,
    };
    const request: Observable<{ id: string }> =
      this.kind() === 'birthday'
        ? this.people.createPerson({
            firstName: this.birthdayForm.getRawValue().firstName.trim(),
            lastName: this.birthdayForm.getRawValue().lastName.trim(),
            birthday: date,
          })
        : this.dates.createDate({
            displayName: this.dateForm.getRawValue().displayName.trim(),
            date,
          });
    this.submitting.set(true);
    this.error.set(null);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.submitting.set(false);
        this.unsavedSource.commit();
        this.active.set(false);
        this.notifications.success(
          this.i18n.translate(
            this.kind() === 'birthday'
              ? 'knowledgePeople.createSuccess'
              : 'knowledgeDates.createSuccess',
          ),
        );
        this.saved.emit();
      },
      error: (error: ApiError) => {
        this.submitting.set(false);
        this.error.set(error);
        this.notifications.error(
          this.i18n.translate(
            this.kind() === 'birthday'
              ? 'knowledgePeople.createError'
              : 'knowledgeDates.createError',
          ),
        );
      },
    });
  }
}

function createDateGroup(): FormGroup<AnnualDateControls> {
  return new FormGroup<AnnualDateControls>(
    {
      day: new FormControl('', { nonNullable: true, validators: Validators.required }),
      month: new FormControl('', { nonNullable: true, validators: Validators.required }),
      year: new FormControl<number | null>(null),
    },
    { validators: annualDateValidator },
  );
}
