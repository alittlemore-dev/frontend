import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { I18nParams } from '../../../../../../core/i18n/i18n.model';
import { TranslatePipe } from '../../../../../../core/i18n/translate.pipe';
import { ArticleSeoAnalysis, ArticleSeoStatus } from '../../../../models/article-seo-analysis';

@Component({
  selector: 'app-admin-article-seo-panel',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './article-seo-panel.component.html',
})
export class ArticleSeoPanelComponent {
  readonly analysis = input.required<ArticleSeoAnalysis>();

  summaryKey(): string {
    return `articles.seoAnalysis.summary.${this.analysis().overallStatus}`;
  }

  summaryParams(): I18nParams {
    const analysis = this.analysis();
    return {
      good: analysis.goodCount,
      warning: analysis.warningCount,
      missing: analysis.missingCount,
      count: analysis.overallStatus === 'missing' ? analysis.missingCount : analysis.warningCount,
    };
  }

  statusKey(status: ArticleSeoStatus): string {
    return `articles.seoAnalysis.status.${status}`;
  }

  statusClass(status: ArticleSeoStatus): string {
    if (status === 'good') return 'badge text-bg-success';
    if (status === 'warning') return 'badge text-bg-warning';
    return 'badge text-bg-danger';
  }
}
