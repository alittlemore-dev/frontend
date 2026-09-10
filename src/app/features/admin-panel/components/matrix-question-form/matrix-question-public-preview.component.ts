import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { LanguageCode } from '../../../../core/i18n/i18n.model';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { WikiLinkRendererService } from '../../../../core/wiki-links/wiki-link-renderer.service';
import { AdminMatrixInterviewFrequency } from '../../models/matrix-question-workspace.model';

export interface MatrixQuestionPreviewResource {
  key: string;
  name: string;
  url: string;
  context: string;
}

@Component({
  selector: 'app-matrix-question-public-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './matrix-question-public-preview.component.html',
})
export class MatrixQuestionPublicPreviewComponent {
  private readonly wikiLinkRenderer = inject(WikiLinkRendererService);
  private readonly i18n = inject(I18nService);

  readonly question = input.required<string>();
  readonly answer = input.required<string>();
  readonly interviewAnswerExplanation = input.required<string>();
  readonly interviewFrequency = input.required<AdminMatrixInterviewFrequency | null>();
  readonly resources = input.required<readonly MatrixQuestionPreviewResource[]>();
  readonly language = input.required<LanguageCode>();
  readonly bundleVersion = input.required<number>();

  readonly answerHtml = computed(() =>
    this.wikiLinkRenderer.render(this.answer(), this.language()),
  );
  readonly interviewAnswerHtml = computed(() =>
    this.wikiLinkRenderer.render(this.interviewAnswerExplanation(), this.language()),
  );
  readonly interviewFrequencyLabel = computed<string | null>(() => {
    this.bundleVersion();
    const frequency = this.interviewFrequency();
    if (frequency === null) return null;
    return this.i18n.translateForLanguage(
      this.language(),
      this.i18n.enumInterviewFrequencyKey(frequency),
    );
  });

  previewMessage(key: string): string {
    this.bundleVersion();
    return this.i18n.translateForLanguage(this.language(), key);
  }
}
