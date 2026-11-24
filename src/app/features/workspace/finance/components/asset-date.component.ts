import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import {
  LocalizedDatePickerComponent,
  LocalizedDatePickerLabels,
} from '@alittlemore.dev/design-system';
import { I18nService } from '../../../../core/i18n/i18n.service';

@Component({
  selector: 'app-asset-date',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LocalizedDatePickerComponent],
  template: ` <label class="form-label" [for]="inputId()"
      >{{ label() }}
      @if (required()) {
        <span class="required-marker text-danger" aria-hidden="true">*</span>
      }
    </label>
    <ds-localized-date-picker
      controlSize="small"
      [inputId]="inputId()"
      [value]="value()"
      [dateLocale]="i18n.dateLocale()"
      [labels]="labels()"
      [required]="required()"
      [invalid]="false"
      [controlDisabled]="disabled()"
      [readonly]="false"
      (valueChange)="changed.emit($event ?? '')"
    />`,
})
export class AssetDateComponent {
  readonly i18n = inject(I18nService);
  readonly inputId = input.required<string>();
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly required = input(true);
  readonly disabled = input(false);
  readonly changed = output<string>();
  readonly labels = computed(() => financeDatePickerLabels(this.i18n));
}

export function financeDatePickerLabels(i18n: I18nService): LocalizedDatePickerLabels {
  i18n.language();
  return {
    placeholder: i18n.translate('shared.datePicker.placeholder'),
    openCalendar: i18n.translate('shared.datePicker.open'),
    changeCalendar: i18n.translate('shared.datePicker.change'),
    dialog: i18n.translate('shared.datePicker.dialog'),
    previousMonth: i18n.translate('shared.datePicker.previousMonth'),
    nextMonth: i18n.translate('shared.datePicker.nextMonth'),
    openMonthYearPicker: i18n.translate('shared.datePicker.openMonthYearPicker'),
    previousYear: i18n.translate('shared.datePicker.previousYear'),
    nextYear: i18n.translate('shared.datePicker.nextYear'),
    clear: i18n.translate('shared.datePicker.clear'),
    done: i18n.translate('shared.datePicker.done'),
    today: i18n.translate('shared.datePicker.today'),
    selectDate: i18n.translate('shared.datePicker.selectDate'),
    unavailableDate: i18n.translate('shared.datePicker.unavailableDate'),
    cancel: i18n.translate('shared.datePicker.cancel'),
    formatHint: i18n.translate('shared.datePicker.formatHint'),
    invalidDate: i18n.translate('shared.datePicker.invalidDate'),
    requiredDate: i18n.translate('shared.datePicker.requiredDate'),
    keyboardHelp: i18n.translate('shared.datePicker.keyboardHelp'),
  };
}
