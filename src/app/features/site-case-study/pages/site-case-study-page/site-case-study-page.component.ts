import { ChangeDetectionStrategy, Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LanguageCode } from '../../../../core/i18n/i18n.model';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { SeoAlternate, SeoService } from '../../../../core/seo/seo.service';

interface ArchitectureBlock {
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly technologies: readonly string[];
}

@Component({
  selector: 'app-site-case-study-page',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './site-case-study-page.component.html',
  styleUrl: './site-case-study-page.component.scss',
})
export class SiteCaseStudyPageComponent implements OnInit {
  private readonly seoService = inject(SeoService);
  private readonly i18n = inject(I18nService);

  readonly architectureBlocks: readonly ArchitectureBlock[] = [
    {
      titleKey: 'siteBuild.architecture.backendTitle',
      bodyKey: 'siteBuild.architecture.backendBody',
      technologies: ['Litestar', 'SQLAlchemy', 'PostgreSQL', 'Dishka', 'TaskIQ'],
    },
    {
      titleKey: 'siteBuild.architecture.frontendTitle',
      bodyKey: 'siteBuild.architecture.frontendBody',
      technologies: ['Angular', 'SSR', 'TypeScript', 'Bootstrap'],
    },
    {
      titleKey: 'siteBuild.architecture.infraTitle',
      bodyKey: 'siteBuild.architecture.infraBody',
      technologies: ['nginx', 'Docker', 'MinIO', 'Valkey', 'GitHub Actions'],
    },
    {
      titleKey: 'siteBuild.architecture.agentTitle',
      bodyKey: 'siteBuild.architecture.agentBody',
      technologies: ['Litestar REST', 'local stdio MCP', 'WireGuard', 'mTLS', 'Draft-only'],
    },
  ];

  readonly decisionKeys: readonly string[] = [
    'siteBuild.decision.cleanArchitecture',
    'siteBuild.decision.localizedContent',
    'siteBuild.decision.privacyAnalytics',
    'siteBuild.decision.deployManifest',
  ];

  readonly matrixLink = computed(() => `/${this.language()}/competency-matrix`);
  readonly articlesLink = computed(() => `/${this.language()}/articles`);

  ngOnInit(): void {
    const language = this.language();
    this.seoService.setTranslatedMeta({
      titleKey: 'siteBuild.seo.title',
      descriptionKey: 'siteBuild.seo.description',
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
  return `/${language}/how-this-site-is-built`;
}

function localizedAlternates(): SeoAlternate[] {
  return [
    { language: 'ru', path: localizedPath('ru') },
    { language: 'en', path: localizedPath('en') },
  ];
}
