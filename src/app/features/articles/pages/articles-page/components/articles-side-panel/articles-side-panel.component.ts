import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import {
  NavigationComponent,
  NavigationGroup,
  NavigationSelection,
} from '@alittlemore.dev/design-system';
import { I18nService } from '../../../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../../../core/i18n/translate.pipe';
import { Router, type Params } from '@angular/router';
import { ArticleTree } from '../../../../models/articles.model';

@Component({
  selector: 'app-articles-side-panel',
  standalone: true,
  imports: [NavigationComponent, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './articles-side-panel.component.html',
})
export class ArticlesSidePanelComponent {
  private readonly i18n = inject(I18nService);

  readonly tree = input.required<ArticleTree>();
  readonly currentSlug = input<string | null>(null);
  readonly articleSelected = output<string>();
  private readonly router = inject(Router);
  readonly queryParams = input<Params>({});
  readonly defaultExpandedGroupKeys: readonly string[] = [];

  readonly sections = computed<readonly NavigationGroup[]>(() => {
    this.i18n.language();
    return this.tree().folders.map((folder) => ({
      key: folder.folderKey,
      label: folder.folder,
      collapsible: true,
      icon: 'folder' as const,
      items: folder.articles.map((article) => ({
        key: article.slug,
        label: article.title,
        href: this.router.serializeUrl(
          this.router.createUrlTree(
            ['/', this.i18n.language(), 'competency', 'articles', article.slug],
            { queryParams: this.queryParams() },
          ),
        ),
        badgeText: article.publishStatus === 'Draft' ? this.i18n.translate('shared.draft') : null,
      })),
    }));
  });
  select(selection: NavigationSelection): void {
    selection.event.preventDefault();
    this.articleSelected.emit(selection.item.key);
  }
}
