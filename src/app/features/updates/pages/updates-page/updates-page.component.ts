import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { LanguageCode } from '../../../../core/i18n/i18n.model';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { SeoAlternate, SeoService } from '../../../../core/seo/seo.service';
import { groupUpdateEntries, UPDATES_TIMELINE_ENTRIES } from '../../updates.timeline';

@Component({
  selector: 'app-updates-page',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './updates-page.component.html',
  styleUrl: './updates-page.component.scss',
})
export class UpdatesPageComponent implements OnInit {
  private readonly seoService = inject(SeoService);
  private readonly i18n = inject(I18nService);

  readonly updateGroups = computed(() => {
    const language = this.language();
    return groupUpdateEntries(UPDATES_TIMELINE_ENTRIES, language, this.i18n.dateLocale());
  });

  ngOnInit(): void {
    const language = this.language();
    this.seoService.setTranslatedMeta({
      titleKey: 'updates.seo.title',
      descriptionKey: 'updates.seo.description',
      canonicalPath: localizedPath(language),
      alternates: localizedAlternates(),
    });
  }

  private language(): LanguageCode {
    const language = this.i18n.language();
    if (language === null) {
      throw new Error('I18n language is not initialized');
    }
    return language;
  }
}

function localizedPath(language: LanguageCode): string {
  return `/${language}/updates`;
}

function localizedAlternates(): SeoAlternate[] {
  return [
    { language: 'ru', path: localizedPath('ru') },
    { language: 'en', path: localizedPath('en') },
  ];
}
