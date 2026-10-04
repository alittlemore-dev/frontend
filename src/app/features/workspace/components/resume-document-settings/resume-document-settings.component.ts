import { CdkDrag, CdkDropList } from '@angular/cdk/drag-drop';
import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import {
  RESUME_SECTION_KEYS,
  ResumeSectionKey,
  ResumeSettings,
  resumeSectionOrder,
} from '../../models/resume-workspace.model';
import { ResumeReorderDirective } from '../../resume-reorder.directive';

@Component({
  selector: 'app-resume-document-settings',
  imports: [CdkDrag, CdkDropList, ResumeReorderDirective, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resume-document-settings.component.html',
  styleUrl: './resume-document-settings.component.scss',
})
export class ResumeDocumentSettingsComponent {
  readonly settings = input.required<ResumeSettings>();
  readonly disabled = input(false);
  readonly settingsChange = output<ResumeSettings>();
  private readonly i18n = inject(I18nService);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  readonly positionNotice = signal('');
  readonly sections = computed(() => {
    this.i18n.language();
    return resumeSectionOrder(this.settings(), 'simple').map((key) => ({
      key,
      label: this.i18n.translate(
        `resumeWorkspace.tabs.${key === 'additionalSections' ? 'additional' : key}`,
      ),
      visible: !this.settings().hiddenSections.includes(key),
    }));
  });

  move(from: number, to: number): void {
    const order = this.sections().map((section) => section.key);
    if (
      this.disabled() ||
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= order.length ||
      to >= order.length
    )
      return;
    const [section] = order.splice(from, 1);
    order.splice(to, 0, section);
    const active = this.document.activeElement;
    this.settingsChange.emit({ ...this.settings(), sectionOrder: order });
    afterNextRender(
      () => {
        if (active instanceof HTMLElement && this.document.contains(active))
          active.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
    this.positionNotice.set(
      this.i18n.translate('resumeWorkspace.editor.moved', { index: to + 1, count: order.length }),
    );
  }

  setVisible(key: ResumeSectionKey, visible: boolean): void {
    if (this.disabled()) return;
    const hidden = new Set(this.settings().hiddenSections);
    if (visible) hidden.delete(key);
    else hidden.add(key);
    this.settingsChange.emit({
      ...this.settings(),
      hiddenSections: RESUME_SECTION_KEYS.filter((section) => hidden.has(section)),
    });
  }
}
