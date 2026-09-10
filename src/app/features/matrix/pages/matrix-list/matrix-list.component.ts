import { DOCUMENT } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  effect,
  untracked,
  DestroyRef,
  OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatrixService } from '../../services/matrix.service';
import {
  MatrixQuestionDetail,
  MatrixQuestionList,
  MatrixSheet,
} from '../../models/matrix-question.model';
import { ApiError } from '../../../../core/models/api-error.model';
import { SeoService } from '../../../../core/seo/seo.service';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { LanguageCode } from '../../../../core/i18n/i18n.model';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ModalScrollDirective } from '../../../../core/layout/modal-scroll.directive';
import { LoadingSpinnerComponent } from '../../../../shared/ui/loading-spinner/loading-spinner.component';
import { ErrorMessageComponent } from '../../../../shared/ui/error-message/error-message.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { MatrixSheetTabsComponent } from '../../../../shared/ui/matrix-sheet-tabs/matrix-sheet-tabs.component';
import { MatrixFilterBarComponent } from './components/matrix-filter-bar/matrix-filter-bar.component';
import { MatrixGroupedGridComponent } from '../../../../shared/ui/matrix-grouped-grid/matrix-grouped-grid.component';
import { MatrixQuestionDetailComponent } from './components/matrix-question-detail/matrix-question-detail.component';
import {
  SiteSelectComponent,
  SiteSelectOption,
} from '../../../../shared/ui/site-select/site-select.component';

const CHOSEN_SHEET_KEY = 'chosenSheet';
const LINE_BREAKS_PATTERN = /[\r\n]+/g;

@Component({
  selector: 'app-matrix-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LoadingSpinnerComponent,
    ErrorMessageComponent,
    EmptyStateComponent,
    MatrixSheetTabsComponent,
    MatrixFilterBarComponent,
    MatrixGroupedGridComponent,
    MatrixQuestionDetailComponent,
    RouterLink,
    TranslatePipe,
    ModalScrollDirective,
    SiteSelectComponent,
  ],
  templateUrl: './matrix-list.component.html',
  styleUrl: './matrix-list.component.scss',
})
export class MatrixListComponent implements OnInit {
  private readonly matrixService = inject(MatrixService);
  private readonly seoService = inject(SeoService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private languageReloadInitialized = false;

  readonly language = this.i18n.language;

  readonly sheets = signal<MatrixSheet[]>([]);
  readonly selectedSheetKey = signal<string | null>(null);
  readonly questions = signal<MatrixQuestionList | null>(null);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly search = signal('');
  readonly selectedQuestion = signal<MatrixQuestionDetail | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal<ApiError | null>(null);
  readonly detailVisible = signal(false);
  readonly suggestionVisible = signal(false);
  readonly suggestionQuestion = signal('');
  readonly suggestionSheetKey = signal<string | null>(null);
  readonly suggestionSubmitting = signal(false);
  readonly suggestionError = signal<ApiError | null>(null);

  readonly selectedSheet = computed<MatrixSheet | null>(() => {
    const selectedSheetKey = this.selectedSheetKey();
    if (selectedSheetKey === null) return null;
    return this.sheets().find((sheet) => sheet.key === selectedSheetKey) ?? null;
  });

  readonly filteredQuestions = computed<MatrixQuestionList | null>(() => {
    const list = this.questions();
    if (!list) return null;
    const term = this.search().toLowerCase().trim();
    if (!term) return list;

    const sections = list.sections
      .map((section) => ({
        ...section,
        subsections: section.subsections
          .map((subsection) => ({
            ...subsection,
            grades: subsection.grades
              .map((grade) => ({
                ...grade,
                questions: grade.questions.filter((q) => q.question.toLowerCase().includes(term)),
              }))
              .filter((grade) => grade.questions.length > 0),
          }))
          .filter((subsection) => subsection.grades.length > 0),
      }))
      .filter((section) => section.subsections.length > 0);

    return { ...list, sections };
  });

  readonly isEmpty = computed(
    () =>
      !this.loading() && !this.error() && (this.filteredQuestions()?.sections.length ?? 0) === 0,
  );
  readonly canSubmitSuggestion = computed(
    () => this.suggestionQuestion().trim().length > 0 && this.suggestionSheetKey() !== null,
  );
  readonly suggestionDuplicate = computed(() => this.suggestionError()?.status === 409);
  readonly suggestionSheetOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    const sheets = this.sheets();
    if (sheets.length === 0) {
      return [{ value: '', label: this.i18n.translate('shared.notSet') }];
    }
    return sheets.map((sheet) => ({ value: sheet.key, label: sheet.name }));
  });
  readonly readonlyMatrixLabels = computed(() => {
    this.i18n.language();
    return {
      sheetTabsAria: this.i18n.translate('matrix.grid.sheetsAria'),
      section: this.i18n.translate('matrix.grid.section'),
      subsection: this.i18n.translate('matrix.grid.subsection'),
      notSet: this.i18n.translate('shared.notSet'),
      grades: Object.fromEntries(
        ['Junior', 'Junior+', 'Middle', 'Middle+', 'Senior'].map((grade) => [
          grade,
          this.i18n.translate(this.i18n.enumGradeKey(grade)),
        ]),
      ),
    };
  });
  readonly selectedQuestionPageLink = computed<string | null>(() => {
    const question = this.selectedQuestion();
    const language = this.i18n.language();
    if (question === null || language === null) return null;
    return `/${language}/competency-matrix/questions/${question.slug}`;
  });

  private readonly languageReloadEffect = effect(() => {
    const language = this.i18n.language();
    if (language === null) return;
    if (!this.languageReloadInitialized) {
      this.languageReloadInitialized = true;
      return;
    }
    untracked(() => this.reloadLocalizedContent());
  });

  ngOnInit(): void {
    this.seoService.setTranslatedMeta({
      titleKey: 'matrix.seo.title',
      descriptionKey: 'matrix.seo.description',
      canonicalPath: '/competency-matrix',
    });
    this.loadSheets();
  }

  loadSheets(): void {
    this.loading.set(true);
    this.error.set(null);
    this.matrixService
      .getPublicSheets(this.currentLanguage())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sheets) => {
          this.sheets.set(sheets);
          if (sheets.length > 0) {
            const saved = this.storage()?.getItem(CHOSEN_SHEET_KEY);
            const initial =
              saved && sheets.some((sheet) => sheet.key === saved) ? saved : sheets[0].key;
            this.selectedSheetKey.set(initial);
            this.loadQuestions(initial);
          } else {
            this.selectedSheetKey.set(null);
            this.questions.set(null);
            this.loading.set(false);
          }
        },
        error: (err: ApiError) => {
          this.error.set(err);
          this.loading.set(false);
        },
      });
  }

  loadQuestions(sheetKey: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.matrixService
      .getPublicQuestions(sheetKey, this.currentLanguage())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.questions.set(list);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err);
          this.loading.set(false);
        },
      });
  }

  selectSheet(sheetKey: string): void {
    this.selectedSheetKey.set(sheetKey);
    this.storage()?.setItem(CHOSEN_SHEET_KEY, sheetKey);
    this.loadQuestions(sheetKey);
  }

  setSearch(value: string): void {
    this.search.set(value);
  }

  openDetail(slug: string): void {
    this.detailVisible.set(true);
    this.selectedQuestion.set(null);
    this.detailLoading.set(true);
    this.detailError.set(null);
    this.publicDetailRequest(slug)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.selectedQuestion.set(detail);
          this.detailLoading.set(false);
        },
        error: (err: ApiError) => {
          this.detailError.set(err);
          this.detailLoading.set(false);
        },
      });
  }

  openQuestionSuggestion(): void {
    if (this.sheets().length === 0) {
      this.notifications.error(this.i18n.translate('matrix.suggestion.noSheets'));
      return;
    }
    this.suggestionVisible.set(true);
    this.suggestionQuestion.set('');
    this.suggestionSheetKey.set(this.selectedSheetKey());
    this.suggestionSubmitting.set(false);
    this.suggestionError.set(null);
  }

  closeQuestionSuggestion(): void {
    if (this.suggestionSubmitting()) return;
    this.suggestionVisible.set(false);
    this.suggestionQuestion.set('');
    this.suggestionSheetKey.set(null);
    this.suggestionError.set(null);
  }

  setQuestionSuggestion(value: string): void {
    this.suggestionQuestion.set(normalizeSuggestionQuestion(value));
    this.suggestionError.set(null);
  }

  onQuestionSuggestionInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    const value = normalizeSuggestionQuestion(target?.value ?? '');
    if (target !== null && target.value !== value) {
      target.value = value;
    }
    this.setQuestionSuggestion(value);
  }

  onQuestionSuggestionSheetChange(value: string): void {
    this.setQuestionSuggestionSheet(value);
  }

  setQuestionSuggestionSheet(value: string): void {
    const sheetKey = value.trim();
    this.suggestionSheetKey.set(sheetKey.length > 0 ? sheetKey : null);
    this.suggestionError.set(null);
  }

  sendQuestionSuggestion(): void {
    const trimmedQuestion = normalizeSuggestionQuestion(this.suggestionQuestion()).trim();
    if (!trimmedQuestion) return;
    const sheetKey = this.suggestionSheetKey();
    if (sheetKey === null) {
      this.notifications.error(this.i18n.translate('matrix.suggestion.sheetRequired'));
      return;
    }
    this.suggestionSubmitting.set(true);
    this.suggestionError.set(null);
    this.matrixService
      .suggestQuestion(trimmedQuestion, sheetKey)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.suggestionSubmitting.set(false);
          this.suggestionVisible.set(false);
          this.suggestionQuestion.set('');
          this.suggestionSheetKey.set(null);
          this.notifications.success(this.i18n.translate('matrix.suggestion.sent'));
        },
        error: (err: ApiError) => {
          this.suggestionSubmitting.set(false);
          this.suggestionError.set(err);
          const messageKey =
            err.status === 409
              ? 'matrix.suggestion.duplicate'
              : err.status === 429
                ? 'matrix.suggestion.quotaExceeded'
                : 'matrix.suggestion.error';
          this.notifications.error(this.i18n.translate(messageKey));
        },
      });
  }

  closeDetail(): void {
    this.detailVisible.set(false);
    this.selectedQuestion.set(null);
    this.detailError.set(null);
  }

  private reloadLocalizedContent(): void {
    this.loadSheets();
    const detail = this.selectedQuestion();
    if (detail !== null && this.detailVisible()) {
      this.openDetail(detail.slug);
    }
  }

  private currentLanguage(): LanguageCode {
    const language = this.i18n.language();
    if (language === null) {
      throw new Error('I18n language is not initialized');
    }
    return language;
  }

  private publicDetailRequest(slug: string): Observable<MatrixQuestionDetail> {
    const language = this.currentLanguage();
    return this.matrixService.getPublicQuestionBySlug(slug, language);
  }

  private storage(): Storage | null {
    return this.document.defaultView?.localStorage ?? null;
  }
}

function normalizeSuggestionQuestion(value: string): string {
  return value.replace(LINE_BREAKS_PATTERN, ' ');
}
