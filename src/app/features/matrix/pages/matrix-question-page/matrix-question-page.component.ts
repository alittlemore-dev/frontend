import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  EMPTY,
  Observable,
  catchError,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  switchMap,
  tap,
} from 'rxjs';
import { ApiError } from '../../../../core/models/api-error.model';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { LanguageCode } from '../../../../core/i18n/i18n.model';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { SeoAlternate, SeoService } from '../../../../core/seo/seo.service';
import { replaceWikiLinksWithPlainText } from '../../../../core/wiki-links/wiki-links';
import { MatrixQuestionDetail } from '../../models/matrix-question.model';
import { MatrixService } from '../../services/matrix.service';
import { MatrixQuestionDetailComponent } from '../matrix-list/components/matrix-question-detail/matrix-question-detail.component';

const DESCRIPTION_LENGTH = 160;

@Component({
  selector: 'app-matrix-question-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MatrixQuestionDetailComponent, TranslatePipe],
  templateUrl: './matrix-question-page.component.html',
})
export class MatrixQuestionPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly matrixService = inject(MatrixService);
  private readonly seoService = inject(SeoService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly language$ = toObservable(this.i18n.language);

  readonly language = this.i18n.language;
  readonly question = signal<MatrixQuestionDetail | null>(null);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly matrixOverviewLink = computed<string | null>(() => {
    const language = this.i18n.language();
    if (language === null) return null;
    return `/${language}/competency-matrix`;
  });

  ngOnInit(): void {
    combineLatest([
      this.route.paramMap.pipe(
        map((params) => params.get('slug')),
        filter((slug): slug is string => slug !== null),
        distinctUntilChanged(),
      ),
      this.language$.pipe(
        filter((language): language is LanguageCode => language !== null),
        distinctUntilChanged(),
      ),
    ])
      .pipe(
        switchMap(([slug, language]) => this.loadQuestion(slug, language)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private loadQuestion(slug: string, language: LanguageCode): Observable<MatrixQuestionDetail> {
    this.loading.set(true);
    this.error.set(null);
    this.question.set(null);
    return this.matrixService.getPublicQuestionBySlug(slug, language).pipe(
      tap((question) => {
        this.question.set(question);
        this.loading.set(false);
        this.setQuestionSeo(question, language);
      }),
      catchError((err: ApiError) => {
        this.error.set(err);
        this.loading.set(false);
        this.setNotFoundSeo(slug, language);
        return EMPTY;
      }),
    );
  }

  private setQuestionSeo(question: MatrixQuestionDetail, language: LanguageCode): void {
    const path = `/competency-matrix/questions/${question.slug}`;
    const answerText = plainTextFromMarkdown(question.answer);
    this.seoService.setMeta({
      title: question.question,
      description: truncateDescription(answerText),
      canonicalPath: localizedPublicPath(path, language),
      alternates: localizedAlternates(path),
      structuredData: buildFaqStructuredData({
        question: question.question,
        answer: answerText,
      }),
    });
  }

  private setNotFoundSeo(slug: string, language: LanguageCode): void {
    const path = `/competency-matrix/questions/${slug}`;
    this.seoService.setMeta({
      title: this.i18n.translate('matrix.question.notFoundTitle'),
      description: this.i18n.translate('matrix.question.notFoundDescription'),
      canonicalPath: localizedPublicPath(path, language),
      alternates: localizedAlternates(path),
      robots: 'noindex, follow',
    });
  }
}

function localizedPublicPath(path: string, language: LanguageCode): string {
  return `/${language}${path}`;
}

function localizedAlternates(path: string): SeoAlternate[] {
  return [
    { language: 'ru', path: `/ru${path}` },
    { language: 'en', path: `/en${path}` },
  ];
}

function buildFaqStructuredData(params: {
  question: string;
  answer: string;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: params.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: params.answer,
        },
      },
    ],
  };
}

function plainTextFromMarkdown(markdown: string): string {
  return replaceWikiLinksWithPlainText(markdown)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[#>*_~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateDescription(value: string): string {
  if (value.length <= DESCRIPTION_LENGTH) return value;
  return `${value.slice(0, DESCRIPTION_LENGTH - 3).trimEnd()}...`;
}
