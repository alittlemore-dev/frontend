import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, type ParamMap } from '@angular/router';
import { debounceTime, merge } from 'rxjs';
import { ApiError } from '../../../../core/models/api-error.model';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ModalScrollDirective } from '../../../../core/layout/modal-scroll.directive';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import {
  ErrorMessageComponent,
  errorDisplayMessages,
} from '../../../../shared/ui/error-message/error-message.component';
import { LoadingSpinnerComponent } from '../../../../shared/ui/loading-spinner/loading-spinner.component';
import { formatLocalizedDate } from '../../../../shared/utils/localized-date';
import { MatrixQuestionFormComponent } from '../../components/matrix-question-form/matrix-question-form.component';
import { AdminRemoveButtonComponent } from '../../components/admin-remove-button/admin-remove-button.component';
import {
  QueuedMatrixImportIssue,
  QueuedMatrixImportIssueCode,
  QueuedMatrixImportPreview,
  QueuedMatrixQuestion,
  type AdminMatrixGrade,
} from '../../models/matrix-question-queue.model';
import {
  AdminMatrixQuestionCreateInitialValue,
  AdminMatrixQuestionPayload,
} from '../../models/matrix-question-workspace.model';
import { MatrixQuestionQueueService } from '../../services/matrix-question-queue.service';
import {
  AdminUnsavedChangesService,
  AdminUnsavedChangesSource,
} from '../../services/admin-unsaved-changes.service';
import { ADMIN_VALIDATION_LIMITS } from '../../utils/admin-validation';
import {
  canonicalQueryMatches,
  queryString,
  readOptionalStringQuery,
  replaceAdminQueryParams,
} from '../../utils/admin-query-state';
import {
  SiteSelectComponent,
  SiteSelectOption,
} from '../../../../shared/ui/site-select/site-select.component';

const LINE_BREAKS_PATTERN = /[\r\n]+/g;
const IMPORT_FILE_ACCEPT =
  '.txt,.csv,.xlsx,.xlsm,text/plain,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12';
const FILTER_URL_SYNC_DEBOUNCE_MS = 150;
const QUEUE_QUERY_KEYS = ['q', 'sheet', 'grade', 'availability'] as const;
const GRADES: readonly AdminMatrixGrade[] = ['Junior', 'Junior+', 'Middle', 'Middle+', 'Senior'];

type QueueAddMode = 'manual' | 'import';
type QueueCreateDestination = 'next' | 'edit';
type QueueGradeFilter = '' | 'notSet' | AdminMatrixGrade;
type QueueAvailabilityFilter = '' | 'available' | 'claimed';

interface QueueFilters {
  searchQuery: string;
  sheet: string;
  grade: QueueGradeFilter;
  availability: QueueAvailabilityFilter;
}

const IMPORT_ISSUE_KEY: Record<QueuedMatrixImportIssueCode, string> = {
  questionNotText: 'adminMatrixQueue.importIssue.questionNotText',
  questionBlank: 'adminMatrixQueue.importIssue.questionBlank',
  questionTooLong: 'adminMatrixQueue.importIssue.questionTooLong',
  sheetNotText: 'adminMatrixQueue.importIssue.sheetNotText',
  gradeNotText: 'adminMatrixQueue.importIssue.gradeNotText',
  gradeInvalid: 'adminMatrixQueue.importIssue.gradeInvalid',
  duplicateInFile: 'adminMatrixQueue.importIssue.duplicateInFile',
  duplicateInQueue: 'adminMatrixQueue.importIssue.duplicateInQueue',
};

@Component({
  selector: 'app-matrix-question-queue-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    LoadingSpinnerComponent,
    ErrorMessageComponent,
    EmptyStateComponent,
    MatrixQuestionFormComponent,
    ModalScrollDirective,
    SiteSelectComponent,
    AdminRemoveButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './matrix-question-queue-page.component.html',
  styleUrl: './matrix-question-queue-page.component.scss',
})
export class MatrixQuestionQueuePageComponent implements OnInit {
  private readonly queueService = inject(MatrixQuestionQueueService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly notifications = inject(NotificationService);
  readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly unsavedChanges = inject(AdminUnsavedChangesService);

  readonly unsavedChangesScope = this.unsavedChanges.createScope(this.destroyRef);
  private readonly questionForm = viewChild(MatrixQuestionFormComponent);

  readonly questions = signal<QueuedMatrixQuestion[]>([]);
  readonly grades = GRADES;
  readonly filtersForm = this.formBuilder.group({
    searchQuery: [''],
    sheet: [''],
    grade: this.formBuilder.control<QueueGradeFilter>(''),
    availability: this.formBuilder.control<QueueAvailabilityFilter>(''),
  });
  private readonly filters = signal<QueueFilters>({
    searchQuery: '',
    sheet: '',
    grade: '',
    availability: '',
  });
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly selectedQuestion = signal<QueuedMatrixQuestion | null>(null);
  readonly submitting = signal(false);
  readonly formError = signal<ApiError | null>(null);
  readonly rejectingQuestionId = signal<string | null>(null);
  readonly releasingClaimQuestionId = signal<string | null>(null);
  readonly manualAddVisible = signal(false);
  readonly addMode = signal<QueueAddMode>('manual');
  readonly manualAddQuestion = signal('');
  readonly manualAddSubmitted = signal(false);
  readonly manualAddSubmitting = signal(false);
  readonly importFileAccept = IMPORT_FILE_ACCEPT;
  readonly selectedImportFile = signal<File | null>(null);
  readonly importPreview = signal<QueuedMatrixImportPreview | null>(null);
  readonly selectedImportRowNumbers = signal<ReadonlySet<number>>(new Set<number>());
  readonly importPreviewSubmitting = signal(false);
  readonly importSubmitting = signal(false);
  readonly importError = signal<ApiError | null>(null);
  readonly importFileSelectionErrorKey = signal<string | null>(null);
  readonly importBusy = computed(() => this.importPreviewSubmitting() || this.importSubmitting());
  readonly importSelectedCount = computed(() => this.selectedImportRowNumbers().size);
  readonly importValidCount = computed(
    () => this.importPreview()?.rows.filter((row) => row.canImport).length ?? 0,
  );
  readonly importInvalidCount = computed(
    () => this.importPreview()?.rows.filter((row) => !row.canImport).length ?? 0,
  );
  readonly importDuplicateCount = computed(
    () =>
      this.importPreview()?.rows.filter((row) =>
        row.issues.some(
          (issue) => issue.code === 'duplicateInFile' || issue.code === 'duplicateInQueue',
        ),
      ).length ?? 0,
  );
  readonly hasQuestions = computed(() => this.questions().length > 0);
  readonly sheetOptions = computed(() => {
    const options = new Set(
      this.questions()
        .map((question) => question.sheet?.trim() ?? '')
        .filter((sheet) => sheet !== '' && sheet !== 'notSet'),
    );
    const activeSheet = this.filters().sheet;
    if (activeSheet !== '' && activeSheet !== 'notSet') options.add(activeSheet);
    return Array.from(options);
  });
  readonly sheetSelectOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return [
      { value: '', label: this.i18n.translate('adminMatrixQueue.filters.all') },
      { value: 'notSet', label: this.i18n.translate('shared.notSet') },
      ...this.sheetOptions().map((sheet) => ({ value: sheet, label: sheet })),
    ];
  });
  readonly gradeSelectOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return [
      { value: '', label: this.i18n.translate('adminMatrixQueue.filters.all') },
      { value: 'notSet', label: this.i18n.translate('shared.notSet') },
      ...GRADES.map((grade) => ({ value: grade, label: this.gradeLabel(grade) })),
    ];
  });
  readonly availabilitySelectOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return [
      { value: '', label: this.i18n.translate('adminMatrixQueue.filters.all') },
      {
        value: 'available',
        label: this.i18n.translate('adminMatrixQueue.filters.available'),
      },
      { value: 'claimed', label: this.i18n.translate('adminMatrixQueue.filters.claimed') },
    ];
  });
  readonly filteredQuestions = computed(() => {
    const filters = this.filters();
    const searchQuery = normalizeSearch(filters.searchQuery);
    return this.questions().filter((question) => {
      const matchesSearch =
        searchQuery === '' ||
        [
          question.question,
          question.sheet,
          question.section,
          question.subsection,
          question.suggestedByUsername,
        ].some((value) => normalizeSearch(value ?? '').includes(searchQuery));
      const matchesSheet =
        filters.sheet === '' ||
        (filters.sheet === 'notSet'
          ? question.sheet === null || question.sheet.trim() === ''
          : question.sheet === filters.sheet);
      const matchesGrade =
        filters.grade === '' ||
        (filters.grade === 'notSet' ? question.grade === null : question.grade === filters.grade);
      const matchesAvailability =
        filters.availability === '' ||
        (filters.availability === 'available' ? question.claim === null : question.claim !== null);
      return matchesSearch && matchesSheet && matchesGrade && matchesAvailability;
    });
  });
  readonly hasFilteredQuestions = computed(() => this.filteredQuestions().length > 0);
  readonly totalQuestionCount = computed(() => this.questions().length);
  readonly shownQuestionCount = computed(() => this.filteredQuestions().length);
  readonly availableQuestionCount = computed(
    () => this.filteredQuestions().filter((question) => question.claim === null).length,
  );
  readonly claimedQuestionCount = computed(
    () => this.filteredQuestions().filter((question) => question.claim !== null).length,
  );
  readonly manualAddQuestionError = computed(() => {
    const question = this.manualAddQuestion().trim();
    if (question.length === 0) return 'validation.required';
    if (question.length > ADMIN_VALIDATION_LIMITS.shortText) return 'validation.maxLength';
    return null;
  });
  readonly selectedImportFileLabel = computed(() => {
    const file = this.selectedImportFile();
    if (file === null) return null;
    return this.i18n.translate('adminMatrixQueue.importSelectedFile', { filename: file.name });
  });
  readonly importErrorMessages = computed(() => {
    const error = this.importError();
    if (error === null) return [];
    return errorDisplayMessages(error);
  });
  readonly formErrorMessages = computed(() => {
    const error = this.formError();
    if (error === null) return [];
    return errorDisplayMessages(error);
  });
  readonly selectedQuestionProcessing = computed(() => {
    const questionId = this.selectedQuestion()?.id;
    return (
      this.submitting() || (questionId !== undefined && this.rejectingQuestionId() === questionId)
    );
  });
  readonly selectedQuestionInitialValue = computed<AdminMatrixQuestionCreateInitialValue | null>(
    () => {
      const question = this.selectedQuestion();
      if (question === null) return null;
      return {
        slug: `queued-question-${question.id}`,
        subsectionId: null,
        preferredSheetKey: question.sheet,
        grade: question.grade,
        interviewFrequency: null,
        publishStatus: 'Draft',
        translations: {
          ru: {
            question: question.question,
            answer: '',
            interviewAnswerExplanation: '',
          },
          en: {
            question: question.question,
            answer: '',
            interviewAnswerExplanation: '',
          },
        },
      };
    },
  );
  private readonly manualAddDraft = computed(() => this.manualAddQuestion());
  private readonly manualAddDraftActive = computed(() => this.manualAddVisible());
  private readonly importDraft = computed(() => ({
    file: this.selectedImportFile(),
    preview: this.importPreview(),
    selectedRowNumbers: this.selectedImportRowNumbers(),
  }));
  private readonly importDraftActive = computed(
    () => this.manualAddVisible() && this.addMode() === 'import',
  );
  private readonly manualAddUnsavedSource: AdminUnsavedChangesSource;
  private readonly importUnsavedSource: AdminUnsavedChangesSource;
  private createDestination: QueueCreateDestination = 'next';

  constructor() {
    this.manualAddUnsavedSource = this.unsavedChangesScope.registerSource(
      this.manualAddDraft,
      this.manualAddDraftActive,
    );
    this.importUnsavedSource = this.unsavedChangesScope.registerSource(
      this.importDraft,
      this.importDraftActive,
    );
  }

  ngOnInit(): void {
    this.setupFilters();
    this.loadQueue();
  }

  resetFilters(): void {
    const filters: QueueFilters = {
      searchQuery: '',
      sheet: '',
      grade: '',
      availability: '',
    };
    this.filtersForm.reset(filters, { emitEvent: false });
    this.filters.set(filters);
    this.syncFiltersToUrl(filters);
  }

  gradeLabel(grade: AdminMatrixGrade): string {
    return this.i18n.translate(this.i18n.enumGradeKey(grade));
  }

  loadQueue(): void {
    this.loading.set(true);
    this.error.set(null);
    this.queueService
      .listQueuedQuestions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (questions) => {
          this.questions.set(questions);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err);
          this.loading.set(false);
          this.notifications.error(this.i18n.translate('adminMatrixQueue.loadError'));
        },
      });
  }

  formatCreatedAt(value: string): string {
    return formatLocalizedDate(value, this.i18n.dateLocale(), 'dateTime');
  }

  formatClaimExpiresAt(value: string): string {
    return formatLocalizedDate(value, this.i18n.dateLocale(), 'dateTime');
  }

  selectQuestion(question: QueuedMatrixQuestion): void {
    if (question.claim !== null) {
      this.notifications.error(this.i18n.translate('adminMatrixQueue.claimBlocked'));
      return;
    }
    this.selectedQuestion.set(question);
    this.formError.set(null);
    this.submitting.set(false);
  }

  closeCreateModal(): void {
    if (this.selectedQuestionProcessing()) return;
    if (!this.unsavedChangesScope.confirmDiscard()) return;
    this.selectedQuestion.set(null);
    this.formError.set(null);
  }

  openManualAdd(): void {
    this.addMode.set('manual');
    this.manualAddQuestion.set('');
    this.manualAddSubmitted.set(false);
    this.manualAddSubmitting.set(false);
    this.resetImportState();
    this.manualAddUnsavedSource.commit();
    this.importUnsavedSource.commit();
    this.manualAddVisible.set(true);
  }

  closeManualAdd(): void {
    if (this.manualAddSubmitting() || this.importBusy()) return;
    if (!this.unsavedChangesScope.confirmDiscard()) return;
    this.manualAddVisible.set(false);
    this.manualAddQuestion.set('');
    this.manualAddSubmitted.set(false);
    this.addMode.set('manual');
    this.resetImportState();
    this.manualAddUnsavedSource.commit();
    this.importUnsavedSource.commit();
  }

  setAddMode(mode: QueueAddMode): void {
    if (mode === this.addMode()) return;
    if (
      mode === 'manual' &&
      this.importUnsavedSource.hasChanges() &&
      !this.unsavedChangesScope.confirmDiscard()
    ) {
      return;
    }
    this.addMode.set(mode);
    this.importError.set(null);
    this.importFileSelectionErrorKey.set(null);
    if (mode === 'manual') {
      this.resetImportState();
      this.importUnsavedSource.commit();
    }
  }

  setManualAddQuestion(value: string): void {
    this.manualAddQuestion.set(normalizeManualQuestion(value));
  }

  onManualAddQuestionInput(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    const value = normalizeManualQuestion(target?.value ?? '');
    if (target !== null && target.value !== value) {
      target.value = value;
    }
    this.setManualAddQuestion(value);
  }

  onManualAddQuestionPaste(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text') ?? '';
    if (!text) return;
    event.preventDefault();
    this.setManualAddQuestion(text);
  }

  submitQueueAdd(): void {
    if (this.addMode() === 'manual') {
      this.createQueuedQuestion();
      return;
    }
    if (this.importPreview() === null) {
      this.previewQueuedQuestions();
      return;
    }
    this.confirmQueuedQuestionsImport();
  }

  createQueuedQuestion(): void {
    this.manualAddSubmitted.set(true);
    const question = normalizeManualQuestion(this.manualAddQuestion()).trim();
    if (this.manualAddQuestionError() !== null) return;
    this.manualAddSubmitting.set(true);
    this.queueService
      .createQueuedQuestion(question)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.manualAddSubmitting.set(false);
          this.manualAddVisible.set(false);
          this.manualAddQuestion.set('');
          this.manualAddSubmitted.set(false);
          this.manualAddUnsavedSource.commit();
          this.notifications.success(this.i18n.translate('adminMatrixQueue.addManualAdded'));
          this.loadQueue();
        },
        error: () => {
          this.manualAddSubmitting.set(false);
          this.notifications.error(this.i18n.translate('adminMatrixQueue.addManualError'));
        },
      });
  }

  onImportFileInputChange(event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (!this.selectImportFiles(target?.files ?? null) && target !== null) target.value = '';
  }

  onImportDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onImportDrop(event: DragEvent): void {
    event.preventDefault();
    this.selectImportFiles(event.dataTransfer?.files ?? null);
  }

  previewQueuedQuestions(): void {
    const file = this.selectedImportFile();
    if (file === null) {
      this.importFileSelectionErrorKey.set('adminMatrixQueue.importOneFileOnly');
      return;
    }
    this.importPreviewSubmitting.set(true);
    this.importError.set(null);
    this.importFileSelectionErrorKey.set(null);
    this.queueService
      .previewQueuedQuestions(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (preview) => {
          this.importPreviewSubmitting.set(false);
          this.importPreview.set(preview);
          this.selectedImportRowNumbers.set(
            new Set(
              preview.rows.filter((row) => row.selectedByDefault).map((row) => row.rowNumber),
            ),
          );
        },
        error: (err: ApiError) => {
          this.importPreviewSubmitting.set(false);
          this.importError.set(err);
          this.notifications.error(this.i18n.translate('adminMatrixQueue.importError'));
        },
      });
  }

  confirmQueuedQuestionsImport(): void {
    const file = this.selectedImportFile();
    const preview = this.importPreview();
    if (file === null || preview === null || this.importSelectedCount() === 0) return;
    if (this.manualAddUnsavedSource.hasChanges() && !this.unsavedChangesScope.confirmDiscard()) {
      return;
    }
    const selectedRows = preview.rows
      .filter((row) => this.selectedImportRowNumbers().has(row.rowNumber))
      .map((row) => row.rowNumber);
    this.importSubmitting.set(true);
    this.importError.set(null);
    this.queueService
      .importQueuedQuestions(file, selectedRows)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (questions) => {
          this.importSubmitting.set(false);
          this.manualAddVisible.set(false);
          this.manualAddQuestion.set('');
          this.manualAddSubmitted.set(false);
          this.addMode.set('manual');
          this.resetImportState();
          this.manualAddUnsavedSource.commit();
          this.importUnsavedSource.commit();
          this.notifications.success(
            this.i18n.translate('adminMatrixQueue.importAdded', { count: questions.length }),
          );
          this.loadQueue();
        },
        error: (err: ApiError) => {
          this.importSubmitting.set(false);
          this.importError.set(err);
          this.notifications.error(this.i18n.translate('adminMatrixQueue.importError'));
        },
      });
  }

  onImportRowSelectionChange(rowNumber: number, event: Event): void {
    const target = event.target as HTMLInputElement | null;
    if (target === null) return;
    this.selectedImportRowNumbers.update((selectedRows) => {
      const updatedRows = new Set(selectedRows);
      if (target.checked) updatedRows.add(rowNumber);
      else updatedRows.delete(rowNumber);
      return updatedRows;
    });
  }

  importIssueMessage(issue: QueuedMatrixImportIssue): string {
    return this.i18n.translate(IMPORT_ISSUE_KEY[issue.code], {
      max: String(ADMIN_VALIDATION_LIMITS.shortText),
      rows: issue.relatedRowNumbers.join(', '),
    });
  }

  rejectQuestion(question: QueuedMatrixQuestion): void {
    if (question.claim !== null) {
      this.notifications.error(this.i18n.translate('adminMatrixQueue.claimBlocked'));
      return;
    }
    this.rejectQueuedQuestion(question, false);
  }

  releaseAgentClaim(question: QueuedMatrixQuestion): void {
    if (question.claim === null || this.releasingClaimQuestionId() !== null) return;
    const confirmed =
      this.document.defaultView?.confirm(
        this.i18n.translate('adminMatrixQueue.confirmReleaseClaim', {
          agent: question.claim.agentClientName,
        }),
      ) ?? false;
    if (!confirmed) return;
    this.releasingClaimQuestionId.set(question.id);
    this.queueService
      .releaseAgentClaim(question.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.releasingClaimQuestionId.set(null);
          this.questions.update((questions) =>
            questions.map((item) => (item.id === question.id ? { ...item, claim: null } : item)),
          );
          this.notifications.success(this.i18n.translate('adminMatrixQueue.claimReleased'));
        },
        error: () => {
          this.releasingClaimQuestionId.set(null);
          this.notifications.error(this.i18n.translate('adminMatrixQueue.claimReleaseError'));
          this.loadQueue();
        },
      });
  }

  rejectSelectedQuestionAndAdvance(): void {
    const question = this.selectedQuestion();
    if (question === null) {
      this.notifications.error(this.i18n.translate('adminMatrixQueue.rejectError'));
      return;
    }
    this.rejectQueuedQuestion(question, true);
  }

  skipSelectedQuestion(): void {
    if (this.selectedQuestionProcessing()) return;
    const question = this.selectedQuestion();
    if (question === null) return;
    if (!this.unsavedChangesScope.confirmDiscard()) return;
    this.questionForm()?.discardAuxiliaryDrafts();
    this.selectedQuestion.set(this.nextQuestionAfter(question.id));
    this.formError.set(null);
  }

  createQuestionAndEdit(): void {
    if (this.selectedQuestionProcessing()) return;
    this.createDestination = 'edit';
    this.questionForm()?.submit();
    this.createDestination = 'next';
  }

  private rejectQueuedQuestion(question: QueuedMatrixQuestion, advance: boolean): void {
    if (this.submitting() || this.rejectingQuestionId() !== null) return;
    const confirmed =
      this.document.defaultView?.confirm(this.i18n.translate('adminMatrixQueue.confirmReject')) ??
      false;
    if (!confirmed) return;
    const nextQuestion = advance ? this.nextQuestionAfter(question.id) : null;
    this.rejectingQuestionId.set(question.id);
    this.queueService
      .rejectQueuedQuestion(question.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.rejectingQuestionId.set(null);
          this.questions.update((questions) =>
            questions.filter((queuedQuestion) => queuedQuestion.id !== question.id),
          );
          if (this.selectedQuestion()?.id === question.id) {
            this.questionForm()?.discardAuxiliaryDrafts();
          }
          if (advance) {
            this.selectedQuestion.set(nextQuestion);
            this.formError.set(null);
          } else if (this.selectedQuestion()?.id === question.id) {
            this.selectedQuestion.set(null);
            this.formError.set(null);
          }
          this.notifications.success(this.i18n.translate('adminMatrixQueue.rejected'));
        },
        error: (error: ApiError) => {
          this.rejectingQuestionId.set(null);
          if (error.status === 409) {
            this.handleClaimConflict();
          } else {
            this.notifications.error(this.i18n.translate('adminMatrixQueue.rejectError'));
          }
        },
      });
  }

  createQuestion(payload: AdminMatrixQuestionPayload): void {
    const destination = this.createDestination;
    this.createDestination = 'next';
    const question = this.selectedQuestion();
    if (question === null) {
      this.notifications.error(this.i18n.translate('adminMatrixQueue.createError'));
      return;
    }
    this.submitting.set(true);
    this.formError.set(null);
    const nextQuestion = this.nextQuestionAfter(question.id);
    this.queueService
      .createQuestionFromQueue(question.id, payload, this.currentLanguage())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (createdQuestion) => {
          this.submitting.set(false);
          this.questions.update((questions) =>
            questions.filter((queuedQuestion) => queuedQuestion.id !== question.id),
          );
          this.questionForm()?.discardAuxiliaryDrafts();
          this.formError.set(null);
          this.notifications.success(this.i18n.translate('adminMatrixQueue.created'));
          if (destination === 'edit') {
            this.selectedQuestion.set(null);
            this.unsavedChangesScope.commit();
            void this.router.navigate(['/admin-panel/matrix-questions', createdQuestion.id], {
              queryParams: { returnTo: 'queue' },
              queryParamsHandling: 'merge',
            });
            return;
          }
          this.selectedQuestion.set(nextQuestion);
        },
        error: (err: ApiError) => {
          this.submitting.set(false);
          this.formError.set(err);
          if (err.status === 409) {
            this.handleClaimConflict();
          } else {
            this.notifications.error(this.i18n.translate('adminMatrixQueue.createError'));
          }
        },
      });
  }

  questionStructure(question: QueuedMatrixQuestion): string {
    return [question.grade, question.sheet, question.section, question.subsection]
      .filter((value) => value !== null && value !== '')
      .join(' / ');
  }

  suggestedByLabel(question: QueuedMatrixQuestion): string {
    if (question.suggestedByUsername === 'anon') {
      return this.i18n.translate('enum.role.anon');
    }
    return question.suggestedByUsername;
  }

  manualAddErrorMessage(): string | null {
    if (!this.manualAddSubmitted()) return null;
    const errorKey = this.manualAddQuestionError();
    if (errorKey === null) return null;
    if (errorKey === 'validation.maxLength') {
      return this.i18n.translate(errorKey, {
        max: String(ADMIN_VALIDATION_LIMITS.shortText),
      });
    }
    return this.i18n.translate(errorKey);
  }

  currentLanguage(): 'ru' | 'en' {
    const language = this.i18n.language();
    if (language === null) {
      throw new Error('I18n language is not initialized');
    }
    return language;
  }

  private nextQuestionAfter(questionId: string): QueuedMatrixQuestion | null {
    const questions = this.filteredQuestions();
    const questionIndex = questions.findIndex((question) => question.id === questionId);
    if (questionIndex < 0) return null;
    return questions.slice(questionIndex + 1).find((question) => question.claim === null) ?? null;
  }

  private handleClaimConflict(): void {
    this.notifications.error(this.i18n.translate('adminMatrixQueue.claimConflict'));
    this.loadQueue();
  }

  private setupFilters(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const result = this.filtersFromQueryParams(params);
      this.filtersForm.setValue(result, { emitEvent: false });
      this.filters.set(result);
      const canonical = this.serializeFilters(result);
      if (!canonicalQueryMatches(params, QUEUE_QUERY_KEYS, canonical)) {
        void replaceAdminQueryParams(this.router, this.route, canonical);
      }
    });
    this.filtersForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.filters.set(this.filtersForm.getRawValue());
    });
    this.filtersForm.controls.searchQuery.valueChanges
      .pipe(debounceTime(FILTER_URL_SYNC_DEBOUNCE_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncFiltersToUrl(this.filtersForm.getRawValue()));
    merge(
      this.filtersForm.controls.sheet.valueChanges,
      this.filtersForm.controls.grade.valueChanges,
      this.filtersForm.controls.availability.valueChanges,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncFiltersToUrl(this.filtersForm.getRawValue()));
  }

  private filtersFromQueryParams(params: ParamMap): QueueFilters {
    const gradeParam = readOptionalStringQuery(params, 'grade').value;
    const availabilityParam = readOptionalStringQuery(params, 'availability').value;
    const grade = isQueueGradeFilter(gradeParam) ? gradeParam : '';
    const availability = isQueueAvailabilityFilter(availabilityParam) ? availabilityParam : '';
    return {
      searchQuery: readOptionalStringQuery(params, 'q').value ?? '',
      sheet: readOptionalStringQuery(params, 'sheet').value ?? '',
      grade,
      availability,
    };
  }

  private syncFiltersToUrl(filters: QueueFilters): void {
    void replaceAdminQueryParams(this.router, this.route, this.serializeFilters(filters));
  }

  private serializeFilters(filters: QueueFilters): Record<string, string | null> {
    return {
      q: queryString(filters.searchQuery),
      sheet: queryString(filters.sheet),
      grade: filters.grade || null,
      availability: filters.availability || null,
    };
  }

  private selectImportFiles(files: FileList | File[] | null): boolean {
    const selectedFiles = files === null ? [] : Array.from(files);
    const nextFile = selectedFiles.length === 1 ? selectedFiles[0] : null;
    const currentFile = this.selectedImportFile();
    if (currentFile !== null && nextFile !== null && filesEqual(currentFile, nextFile)) {
      this.importFileSelectionErrorKey.set(null);
      return true;
    }
    if (this.importUnsavedSource.hasChanges() && !this.unsavedChangesScope.confirmDiscard()) {
      return false;
    }
    this.importError.set(null);
    this.clearImportPreview();
    if (selectedFiles.length !== 1) {
      this.selectedImportFile.set(null);
      this.importFileSelectionErrorKey.set('adminMatrixQueue.importOneFileOnly');
      return true;
    }
    this.selectedImportFile.set(selectedFiles[0]);
    this.importFileSelectionErrorKey.set(null);
    return true;
  }

  private resetImportState(): void {
    this.selectedImportFile.set(null);
    this.clearImportPreview();
    this.importPreviewSubmitting.set(false);
    this.importSubmitting.set(false);
    this.importError.set(null);
    this.importFileSelectionErrorKey.set(null);
  }

  private clearImportPreview(): void {
    this.importPreview.set(null);
    this.selectedImportRowNumbers.set(new Set<number>());
  }
}

function normalizeManualQuestion(value: string): string {
  return value.replace(LINE_BREAKS_PATTERN, ' ');
}

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function isQueueGradeFilter(value: string | null): value is QueueGradeFilter {
  return value === '' || value === 'notSet' || GRADES.some((grade) => grade === value);
}

function isQueueAvailabilityFilter(value: string | null): value is QueueAvailabilityFilter {
  return value === '' || value === 'available' || value === 'claimed';
}

function filesEqual(first: File, second: File): boolean {
  return (
    first.name === second.name &&
    first.size === second.size &&
    first.type === second.type &&
    first.lastModified === second.lastModified
  );
}
