import { WorkspaceFieldTargetDirective } from '../../form-field-focus.directive';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { ControlContainer, ReactiveFormsModule } from '@angular/forms';
import { SiteSelectComponent, SiteSelectOption } from '@alittlemore.dev/design-system';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ResumeTextLimitDirective } from '../../resume-text-limit.directive';

@Component({
  selector: 'app-resume-editor-header',
  imports: [
    WorkspaceFieldTargetDirective,
    ReactiveFormsModule,
    SiteSelectComponent,
    TranslatePipe,
    ResumeTextLimitDirective,
  ],
  viewProviders: [
    { provide: ControlContainer, useFactory: () => inject(ControlContainer, { skipSelf: true }) },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resume-editor-header.component.html',
  styleUrl: './resume-editor-header.component.scss',
})
export class ResumeEditorHeaderComponent {
  readonly ready = input(false);
  readonly title = input('');
  readonly mode = input<'edit' | 'preview'>('edit');
  readonly languageOptions = input.required<readonly SiteSelectOption[]>();
  readonly titleMax = input.required<number>();
  readonly titleInvalid = input(false);
  readonly titleMessage = input<string | null>(null);
  readonly languageInvalid = input(false);
  readonly languageMessage = input<string | null>(null);
  readonly unsaved = input(false);
  readonly saving = input(false);
  readonly saveFailed = input(false);
  readonly saveDisabled = input(false);
  readonly deleteDisabled = input(false);
  readonly back = output<void>();
  readonly save = output<void>();
  readonly edit = output<void>();
  readonly preview = output<void>();
  readonly exportResume = output<void>();
  readonly deleteResume = output<void>();
}
