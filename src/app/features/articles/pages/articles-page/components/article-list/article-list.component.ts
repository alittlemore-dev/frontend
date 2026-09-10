import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '../../../../../../core/i18n/translate.pipe';
import { formatLocalizedDate } from '../../../../../../shared/utils/localized-date';
import { ArticleSummary } from '../../../../models/articles.model';

@Component({
  selector: 'app-article-list',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './article-list.component.html',
})
export class ArticleListComponent {
  readonly articles = input.required<ArticleSummary[]>();
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly dateLocale = input.required<string>();

  readonly articleSelected = output<string>();
  readonly tagSelected = output<string>();
  readonly pageChange = output<number>();

  readonly hasPrevious = computed(() => this.page() > 1);
  readonly hasNext = computed(() => this.page() < this.totalPages());

  articleDate(article: ArticleSummary): string {
    return formatLocalizedDate(this.articleDateValue(article), this.dateLocale(), 'date');
  }

  articleDateValue(article: ArticleSummary): string {
    return article.publishedAt ?? article.updatedAt;
  }

  previousPage(): void {
    if (this.hasPrevious()) {
      this.pageChange.emit(this.page() - 1);
    }
  }

  nextPage(): void {
    if (this.hasNext()) {
      this.pageChange.emit(this.page() + 1);
    }
  }
}
