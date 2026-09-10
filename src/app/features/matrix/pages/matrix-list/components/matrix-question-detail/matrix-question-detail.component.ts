import { Component, ChangeDetectionStrategy, input, computed, inject } from '@angular/core';
import { LanguageCode } from '../../../../../../core/i18n/i18n.model';
import { I18nService } from '../../../../../../core/i18n/i18n.service';
import { WikiLinkRendererService } from '../../../../../../core/wiki-links/wiki-link-renderer.service';
import { MatrixQuestionDetail } from '../../../../models/matrix-question.model';
import { ApiError } from '../../../../../../core/models/api-error.model';
import { LoadingSpinnerComponent } from '../../../../../../shared/ui/loading-spinner/loading-spinner.component';
import { ErrorMessageComponent } from '../../../../../../shared/ui/error-message/error-message.component';
import { TranslatePipe } from '../../../../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-matrix-question-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LoadingSpinnerComponent, ErrorMessageComponent, TranslatePipe],
  templateUrl: './matrix-question-detail.component.html',
})
export class MatrixQuestionDetailComponent {
  private readonly wikiLinkRenderer = inject(WikiLinkRendererService);
  private readonly i18n = inject(I18nService);

  readonly question = input<MatrixQuestionDetail | null>(null);
  readonly loading = input<boolean>(false);
  readonly error = input<ApiError | null>(null);
  readonly language = input.required<LanguageCode>();

  readonly answerHtml = computed<string>(() => {
    const q = this.question();
    if (!q?.answer) return '';
    return this.wikiLinkRenderer.render(q.answer, this.language());
  });

  readonly interviewAnswerHtml = computed<string>(() => {
    const q = this.question();
    if (!q?.interviewAnswerExplanation) return '';
    return this.wikiLinkRenderer.render(q.interviewAnswerExplanation, this.language());
  });
  readonly interviewFrequencyLabel = computed<string | null>(() => {
    const frequency = this.question()?.interviewFrequency ?? null;
    if (frequency === null) return null;
    return this.i18n.translate(this.i18n.enumInterviewFrequencyKey(frequency));
  });
  readonly suggestedByLabel = computed<string>(() => {
    const username = this.question()?.suggestedByUsername ?? '';
    if (username === 'anon') return this.i18n.translate('enum.role.anon');
    return username;
  });
}
