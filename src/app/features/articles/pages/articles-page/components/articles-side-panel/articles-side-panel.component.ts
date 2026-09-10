import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import {
  FoldableTreeComponent,
  FoldableTreeSection,
} from '../../../../../../shared/ui/foldable-tree/foldable-tree.component';
import { I18nService } from '../../../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../../../core/i18n/translate.pipe';
import { ArticleTree } from '../../../../models/articles.model';

@Component({
  selector: 'app-articles-side-panel',
  standalone: true,
  imports: [FoldableTreeComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './articles-side-panel.component.html',
})
export class ArticlesSidePanelComponent {
  private readonly i18n = inject(I18nService);

  readonly tree = input.required<ArticleTree>();
  readonly currentSlug = input<string | null>(null);
  readonly articleSelected = output<string>();
  readonly closePanel = output<void>();
  readonly defaultExpandedSectionKeys: readonly string[] = [];

  readonly sections = computed<readonly FoldableTreeSection[]>(() => {
    this.i18n.language();
    return this.tree().folders.map((folder) => ({
      key: folder.folderKey,
      label: folder.folder,
      trailingText: String(folder.articles.length),
      items: folder.articles.map((article) => ({
        key: article.slug,
        label: article.title,
        badgeText: article.publishStatus === 'Draft' ? this.i18n.translate('shared.draft') : null,
      })),
    }));
  });
}
