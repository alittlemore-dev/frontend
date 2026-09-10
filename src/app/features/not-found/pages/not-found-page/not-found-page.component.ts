import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { LanguageCode } from '../../../../core/i18n/i18n.model';
import { localizedPublicHomePath } from '../../../../core/routing/public-home';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { SeoService } from '../../../../core/seo/seo.service';

@Component({
  selector: 'app-not-found-page',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './not-found-page.component.html',
  styleUrl: './not-found-page.component.scss',
})
export class NotFoundPageComponent implements OnInit {
  private readonly seoService = inject(SeoService);
  private readonly i18n = inject(I18nService);

  readonly homeLink = computed(() => localizedPublicHomePath(this.currentLanguage()));

  ngOnInit(): void {
    this.seoService.setTranslatedMeta({
      titleKey: 'notFound.seo.title',
      descriptionKey: 'notFound.seo.description',
    });
  }

  private currentLanguage(): LanguageCode {
    const language = this.i18n.language();
    if (language === null) {
      throw new Error('I18n language is not initialized');
    }
    return language;
  }
}
