import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '../../../../../../core/i18n/translate.pipe';
import { ApiError } from '../../../../../../core/models/api-error.model';
import { EmptyStateComponent } from '../../../../../../shared/ui/empty-state/empty-state.component';
import { ErrorMessageComponent } from '../../../../../../shared/ui/error-message/error-message.component';
import {
  LocalizedDatePickerComponent,
  LocalizedDatePickerLabels,
} from '../../../../../../shared/ui/localized-date-picker/localized-date-picker.component';
import { LoadingSpinnerComponent } from '../../../../../../shared/ui/loading-spinner/loading-spinner.component';
import { AdminArticleStats } from '../../../../models/article-workspace.model';

@Component({
  selector: 'app-admin-article-statistics-panel',
  standalone: true,
  imports: [
    EmptyStateComponent,
    ErrorMessageComponent,
    LoadingSpinnerComponent,
    LocalizedDatePickerComponent,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './article-statistics-panel.component.html',
})
export class AdminArticleStatisticsPanelComponent {
  readonly stats = input<AdminArticleStats | null>(null);
  readonly loading = input(false);
  readonly error = input<ApiError | null>(null);
  readonly dateFrom = input.required<string>();
  readonly dateTo = input.required<string>();
  readonly dateLocale = input.required<string>();
  readonly datePickerLabels = input.required<LocalizedDatePickerLabels>();

  readonly dateFromChange = output<string>();
  readonly dateToChange = output<string>();
  readonly refresh = output<void>();
  readonly exportCsv = output<void>();
  readonly refreshAttempted = signal(false);
  readonly dateFromPickerValid = signal(true);
  readonly dateToPickerValid = signal(true);
  readonly dateFromInvalid = computed(
    () => this.refreshAttempted() && (this.dateFrom().trim() === '' || !this.dateFromPickerValid()),
  );
  readonly dateToInvalid = computed(
    () => this.refreshAttempted() && (this.dateTo().trim() === '' || !this.dateToPickerValid()),
  );

  setDateFrom(value: string): void {
    this.dateFromChange.emit(value);
  }

  setDateTo(value: string): void {
    this.dateToChange.emit(value);
  }

  setDateFromValidity(valid: boolean): void {
    this.dateFromPickerValid.set(valid);
  }

  setDateToValidity(valid: boolean): void {
    this.dateToPickerValid.set(valid);
  }

  requestRefresh(): void {
    this.refreshAttempted.set(true);
    if (this.dateFromInvalid() || this.dateToInvalid()) return;
    this.refresh.emit();
  }
}
