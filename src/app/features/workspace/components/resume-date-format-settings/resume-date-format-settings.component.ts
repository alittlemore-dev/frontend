import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ResumeDateFormat, ResumeLanguage } from '../../models/resume-workspace.model';
import { formatResumeDocumentDate } from '../resume-document-preview/resume-document.model';

@Component({
  selector: 'app-resume-date-format-settings',
  imports: [ReactiveFormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resume-date-format-settings.component.html',
  styleUrl: './resume-date-format-settings.component.scss',
})
export class ResumeDateFormatSettingsComponent {
  readonly control = input.required<FormControl<ResumeDateFormat>>();
  readonly formats = input.required<readonly ResumeDateFormat[]>();
  readonly language = input.required<ResumeLanguage>();
  readonly invalid = input(false);
  readonly message = input('');
  private readonly i18n = inject(I18nService);
  readonly options = computed(() => {
    this.i18n.language();
    return this.formats().map((value) => ({
      value,
      label: this.i18n.translate(`resumeWorkspace.dateFormat.${value}`),
      example: ['2024-08-19', '2026-01-15']
        .map((date) => formatResumeDocumentDate(date, value, this.language()))
        .join(' — '),
    }));
  });
}
