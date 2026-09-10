import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { Observable, map, of, switchMap } from 'rxjs';
import { LanguageCode } from '../../../../core/i18n/i18n.model';
import { ApiError } from '../../../../core/models/api-error.model';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ModalScrollDirective } from '../../../../core/layout/modal-scroll.directive';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorMessageComponent } from '../../../../shared/ui/error-message/error-message.component';
import {
  LocalizedDatePickerComponent,
  LocalizedDatePickerLabels,
} from '../../../../shared/ui/localized-date-picker/localized-date-picker.component';
import { LoadingSpinnerComponent } from '../../../../shared/ui/loading-spinner/loading-spinner.component';
import { MatrixGroupedGridComponent } from '../../../../shared/ui/matrix-grouped-grid/matrix-grouped-grid.component';
import { MatrixSheetTabsComponent } from '../../../../shared/ui/matrix-sheet-tabs/matrix-sheet-tabs.component';
import {
  SiteSelectComponent,
  SiteSelectOption,
} from '../../../../shared/ui/site-select/site-select.component';
import {
  AdminAction,
  AdminActionsDropdownComponent,
} from '../../components/admin-actions-dropdown/admin-actions-dropdown.component';
import { MatrixQuestionFormComponent } from '../../components/matrix-question-form/matrix-question-form.component';
import {
  AdminMatrixGrade,
  AdminMatrixInterviewFrequency,
  AdminMatrixMissingField,
  AdminMatrixPublishStatus,
  AdminMatrixQuestionPayload,
  AdminMatrixQuestionWorkspace,
  AdminMatrixQuestionWorkspaceFilters,
  AdminMatrixWorkspaceFilterOptions,
  AdminMatrixWorkspaceItem,
  AdminMatrixWorkspaceSort,
  AdminReadonlyMatrixQuestionList,
  AdminReadonlyMatrixSheet,
} from '../../models/matrix-question-workspace.model';
import { MatrixQuestionWorkspaceService } from '../../services/matrix-question-workspace.service';
import { AdminUnsavedChangesService } from '../../services/admin-unsaved-changes.service';
import {
  canonicalQueryMatches,
  queryFinite,
  queryNumber,
  queryString,
  readFiniteQuery,
  readIsoDateQuery,
  readOptionalBooleanQuery,
  readOptionalStringQuery,
  readPositiveIntegerQuery,
  replaceAdminQueryParams,
} from '../../utils/admin-query-state';

const GRADES: readonly AdminMatrixGrade[] = ['Junior', 'Junior+', 'Middle', 'Middle+', 'Senior'];
const SORTS: readonly AdminMatrixWorkspaceSort[] = [
  'newest',
  'oldest',
  'grade',
  'interviewFrequency',
  'section',
  'subsection',
  'missingFields',
  'dangerousPublished',
];
const PAGE_SIZES: readonly number[] = [20, 50, 100];
const PAGE_SIZE_VALUES = ['20', '50', '100'] as const;
const INTERVIEW_FREQUENCIES: readonly AdminMatrixInterviewFrequency[] = [
  'constantly',
  'often',
  'rarely',
  'neverSeen',
];
const PUBLISH_STATUSES: readonly AdminMatrixPublishStatus[] = ['Draft', 'Published'];
const WORKSPACE_TABS: readonly WorkspaceTab[] = ['list', 'preview'];
const PREVIEW_LANGUAGES: readonly LanguageCode[] = ['ru', 'en'];
const MATRIX_QUERY_KEYS = [
  'tab',
  'q',
  'sheet',
  'grade',
  'interviewFrequency',
  'sectionId',
  'subsectionId',
  'publishStatus',
  'hasMissingFields',
  'sort',
  'pageSize',
  'publishedFrom',
  'publishedTo',
  'page',
  'previewLanguage',
  'previewSheet',
] as const;

type WorkspaceTab = 'list' | 'preview';

interface PreviewSnapshot {
  language: LanguageCode;
  sheets: AdminReadonlyMatrixSheet[];
  selectedSheetKey: string | null;
  questions: AdminReadonlyMatrixQuestionList | null;
}

interface MatrixWorkspaceQueryState {
  tab: WorkspaceTab;
  searchQuery: string | null;
  sheetKey: string | null;
  grade: AdminMatrixGrade | null;
  interviewFrequency: AdminMatrixInterviewFrequency | null;
  sectionId: string | null;
  subsectionId: string | null;
  publishStatus: AdminMatrixPublishStatus | null;
  hasMissingFields: boolean | null;
  sort: AdminMatrixWorkspaceSort;
  pageSize: number;
  publishedFrom: string | null;
  publishedTo: string | null;
  page: number;
  previewLanguage: LanguageCode | null;
  previewSheet: string | null;
}

@Component({
  selector: 'app-matrix-questions-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    RouterLink,
    LoadingSpinnerComponent,
    ErrorMessageComponent,
    EmptyStateComponent,
    LocalizedDatePickerComponent,
    MatrixSheetTabsComponent,
    MatrixGroupedGridComponent,
    AdminActionsDropdownComponent,
    MatrixQuestionFormComponent,
    ModalScrollDirective,
    SiteSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './matrix-questions-page.component.html',
  styleUrl: './matrix-questions-page.component.scss',
})
export class MatrixQuestionsPageComponent implements OnInit {
  private readonly workspaceService = inject(MatrixQuestionWorkspaceService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly unsavedChangesScope = inject(AdminUnsavedChangesService).createScope(this.destroyRef);
  private currentQueryParams: ParamMap | null = null;
  private appliedQueryState: MatrixWorkspaceQueryState | null = null;
  private skipNextCanonicalLoad: Record<string, string | null> | null = null;

  readonly grades = GRADES;
  readonly sorts = SORTS;
  readonly pageSizes = PAGE_SIZES;

  readonly activeTab = signal<WorkspaceTab>('list');
  readonly workspace = signal<AdminMatrixQuestionWorkspace | null>(null);
  readonly filterOptions = signal<AdminMatrixWorkspaceFilterOptions>({
    sheets: [],
    grades: [],
    interviewFrequencies: [],
    sections: [],
    subsections: [],
    publishStatuses: [],
  });
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly page = signal(1);
  readonly selectedFilterSheetKey = signal('');
  readonly selectedFilterSectionId = signal('');

  readonly previewSheets = signal<AdminReadonlyMatrixSheet[]>([]);
  readonly selectedPreviewSheetKey = signal<string | null>(null);
  readonly previewQuestions = signal<AdminReadonlyMatrixQuestionList | null>(null);
  readonly previewLoading = signal(false);
  readonly previewError = signal<ApiError | null>(null);
  readonly previewLanguage = signal<LanguageCode>(this.currentLanguage());
  readonly previewLanguageLoading = signal(false);
  readonly previewLanguageError = signal<string | null>(null);

  readonly formMode = signal<'create' | null>(null);
  readonly formSubmitting = signal(false);
  readonly formError = signal<ApiError | null>(null);

  readonly filtersForm = this.formBuilder.group({
    searchQuery: [''],
    sheetKey: [''],
    grade: [''],
    interviewFrequency: [''],
    sectionId: [''],
    subsectionId: [''],
    publishStatus: [''],
    publishedFrom: [''],
    publishedTo: [''],
    hasMissingFields: [''],
    sort: this.formBuilder.control<AdminMatrixWorkspaceSort>('newest', {
      validators: Validators.required,
    }),
    pageSize: this.formBuilder.control('20', { validators: Validators.required }),
  });
  readonly dateLocale = computed(() => this.i18n.dateLocale());
  readonly publishedFromValid = signal(true);
  readonly publishedToValid = signal(true);
  readonly datePickerLabels = computed<LocalizedDatePickerLabels>(() => ({
    placeholder: this.datePickerTranslation('placeholder'),
    openCalendar: this.datePickerTranslation('open'),
    changeCalendar: this.datePickerTranslation('change'),
    dialog: this.datePickerTranslation('dialog'),
    previousMonth: this.datePickerTranslation('previousMonth'),
    nextMonth: this.datePickerTranslation('nextMonth'),
    openMonthYearPicker: this.datePickerTranslation('openMonthYearPicker'),
    previousYear: this.datePickerTranslation('previousYear'),
    nextYear: this.datePickerTranslation('nextYear'),
    clear: this.datePickerTranslation('clear'),
    close: this.datePickerTranslation('close'),
    formatHint: this.datePickerTranslation('formatHint'),
    invalidDate: this.datePickerTranslation('invalidDate'),
    requiredDate: this.datePickerTranslation('requiredDate'),
    keyboardHelp: this.datePickerTranslation('keyboardHelp'),
  }));

  readonly isEmpty = computed(() => !this.loading() && (this.workspace()?.items.length ?? 0) === 0);
  readonly canGoBack = computed(() => this.page() > 1);
  readonly canGoForward = computed(() => this.page() < (this.workspace()?.totalPages ?? 1));
  readonly sectionOptions = computed(() => {
    const sheetKey = this.selectedFilterSheetKey();
    if (!sheetKey) return [];
    return this.filterOptions().sheets.find((sheet) => sheet.key === sheetKey)?.sections ?? [];
  });
  readonly subsectionOptions = computed(() => {
    const sectionId = this.selectedFilterSectionId();
    if (!sectionId) return [];
    return this.sectionOptions().find((option) => option.id === sectionId)?.subsections ?? [];
  });
  readonly sheetSelectOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return [
      { value: '', label: this.i18n.translate('shared.notSet') },
      ...this.filterOptions().sheets.map((sheet) => ({
        value: sheet.key,
        label: sheet.label,
      })),
    ];
  });
  readonly gradeSelectOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return [
      { value: '', label: this.gradeLabel(null) },
      ...this.filterOptions().grades.map((grade) => ({
        value: grade,
        label: this.gradeLabel(grade),
      })),
    ];
  });
  readonly interviewFrequencySelectOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return [
      { value: '', label: this.interviewFrequencyLabel(null) },
      ...this.filterOptions().interviewFrequencies.map((frequency) => ({
        value: frequency,
        label: this.interviewFrequencyLabel(frequency),
      })),
    ];
  });
  readonly sectionSelectOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return [
      { value: '', label: this.i18n.translate('shared.notSet') },
      ...this.sectionOptions().map((section) => ({
        value: section.id,
        label: section.label,
      })),
    ];
  });
  readonly subsectionSelectOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return [
      { value: '', label: this.i18n.translate('shared.notSet') },
      ...this.subsectionOptions().map((subsection) => ({
        value: subsection.id,
        label: subsection.label,
      })),
    ];
  });
  readonly publishStatusSelectOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return [
      { value: '', label: this.i18n.translate('shared.notSet') },
      ...this.filterOptions().publishStatuses.map((status) => ({
        value: status,
        label: this.publishStatusLabel(status),
      })),
    ];
  });
  readonly missingFieldsSelectOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return [
      { value: '', label: this.i18n.translate('shared.notSet') },
      { value: 'true', label: this.i18n.translate('adminMatrixWorkspace.hasMissingFields') },
      { value: 'false', label: this.i18n.translate('adminMatrixWorkspace.noMissingFields') },
    ];
  });
  readonly sortSelectOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return SORTS.map((sort) => ({ value: sort, label: this.sortLabel(sort) }));
  });
  readonly pageSizeSelectOptions = PAGE_SIZES.map((pageSize) => ({
    value: String(pageSize),
    label: String(pageSize),
  })) satisfies readonly SiteSelectOption[];
  readonly readonlyMatrixLabels = computed(() => {
    const language = this.previewLanguage();
    return {
      sheetTabsAria: this.i18n.translateForLanguage(language, 'matrix.grid.sheetsAria'),
      section: this.i18n.translateForLanguage(language, 'matrix.grid.section'),
      subsection: this.i18n.translateForLanguage(language, 'matrix.grid.subsection'),
      notSet: this.i18n.translateForLanguage(language, 'shared.notSet'),
      grades: Object.fromEntries(
        GRADES.map((grade) => [
          grade,
          this.i18n.translateForLanguage(language, this.i18n.enumGradeKey(grade)),
        ]),
      ),
    };
  });

  ngOnInit(): void {
    this.setupDependentFilters();
    this.initializeFilterOptionsAndQueryState();
  }

  private setupDependentFilters(): void {
    this.filtersForm.controls.sectionId.disable({ emitEvent: false });
    this.filtersForm.controls.subsectionId.disable({ emitEvent: false });
    this.filtersForm.controls.sheetKey.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((sheetKey) => {
        this.selectedFilterSheetKey.set(sheetKey);
        this.selectedFilterSectionId.set('');
        this.filtersForm.controls.sectionId.setValue('', { emitEvent: false });
        this.filtersForm.controls.subsectionId.setValue('', { emitEvent: false });
        this.refreshDependentFilterControls();
      });
    this.filtersForm.controls.sectionId.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((sectionId) => {
        this.selectedFilterSectionId.set(sectionId);
        this.filtersForm.controls.subsectionId.setValue('', { emitEvent: false });
        this.refreshDependentFilterControls();
      });
  }

  switchTab(tab: WorkspaceTab): void {
    const state = this.requireAppliedQueryState();
    this.commitQueryState({
      ...state,
      tab,
      previewLanguage:
        tab === 'preview'
          ? (state.previewLanguage ?? this.currentLanguage())
          : state.previewLanguage,
      previewSheet:
        tab === 'preview'
          ? (state.previewSheet ?? this.filterOptions().sheets[0]?.key ?? null)
          : state.previewSheet,
    });
  }

  private initializeFilterOptionsAndQueryState(): void {
    this.workspaceService
      .getFilterOptions(this.currentLanguage())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (options) => {
          this.filterOptions.set(options);
          this.refreshDependentFilterControls();
          this.setupQueryState(true);
        },
        error: () => {
          this.notifications.error(this.i18n.translate('adminMatrixWorkspace.optionsError'));
          this.setupQueryState(false);
        },
      });
  }

  loadFilterOptions(): void {
    this.workspaceService
      .getFilterOptions(this.currentLanguage())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (options) => {
          this.filterOptions.set(options);
          this.refreshDependentFilterControls();
        },
        error: () =>
          this.notifications.error(this.i18n.translate('adminMatrixWorkspace.optionsError')),
      });
  }

  loadWorkspace(): void {
    const state = this.appliedQueryState;
    if (state === null) return;
    this.loading.set(true);
    this.error.set(null);
    this.workspaceService
      .listWorkspaceItems(this.buildWorkspaceFilters(state))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (workspace) => {
          const lastPage = Math.max(1, workspace.totalPages);
          if (state.page > lastPage) {
            this.commitQueryState({ ...state, page: lastPage });
            return;
          }
          this.workspace.set(workspace);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err);
          this.loading.set(false);
          this.notifications.error(this.i18n.translate('adminMatrixWorkspace.loadError'));
        },
      });
  }

  applyFilters(): void {
    if (this.filtersForm.invalid || !this.publishedFromValid() || !this.publishedToValid()) {
      this.filtersForm.markAllAsTouched();
      return;
    }
    const state = this.requireAppliedQueryState();
    this.commitQueryState({ ...this.stateFromForm(state), page: 1 });
  }

  resetFilters(): void {
    this.publishedFromValid.set(true);
    this.publishedToValid.set(true);
    this.filtersForm.reset({
      searchQuery: '',
      sheetKey: '',
      grade: '',
      interviewFrequency: '',
      sectionId: '',
      subsectionId: '',
      publishStatus: '',
      publishedFrom: '',
      publishedTo: '',
      hasMissingFields: '',
      sort: 'newest',
      pageSize: '20',
    });
    const state = this.requireAppliedQueryState();
    this.commitQueryState({
      ...emptyMatrixQueryState(),
      tab: state.tab,
      previewLanguage: state.previewLanguage,
      previewSheet: state.previewSheet,
    });
  }

  setPublishedFrom(value: string): void {
    this.filtersForm.controls.publishedFrom.setValue(value);
  }

  setPublishedTo(value: string): void {
    this.filtersForm.controls.publishedTo.setValue(value);
  }

  setPublishedFromValidity(valid: boolean): void {
    this.publishedFromValid.set(valid);
  }

  setPublishedToValidity(valid: boolean): void {
    this.publishedToValid.set(valid);
  }

  previousPage(): void {
    if (!this.canGoBack()) return;
    const state = this.requireAppliedQueryState();
    this.commitQueryState({ ...state, page: state.page - 1 });
  }

  nextPage(): void {
    if (!this.canGoForward()) return;
    const state = this.requireAppliedQueryState();
    this.commitQueryState({ ...state, page: state.page + 1 });
  }

  loadPreviewSheets(): void {
    const state = this.requireAppliedQueryState();
    const language = state.previewLanguage ?? this.currentLanguage();
    this.previewLoading.set(true);
    this.previewError.set(null);
    this.previewLanguageError.set(null);
    const languageBundle =
      language === this.currentLanguage()
        ? of(undefined)
        : this.i18n.ensureLanguageBundle(language);
    languageBundle
      .pipe(
        switchMap(() => this.loadPreviewSnapshot(language, state.previewSheet)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (snapshot) => {
          if (snapshot.selectedSheetKey !== state.previewSheet) {
            this.replaceQueryWithoutLoad({
              ...state,
              previewLanguage: snapshot.language,
              previewSheet: snapshot.selectedSheetKey,
            });
          }
          this.applyPreviewSnapshot(snapshot);
          this.previewLanguageLoading.set(false);
          this.previewLoading.set(false);
        },
        error: (err: ApiError) => {
          if (language === this.previewLanguage() && !this.previewLanguageLoading()) {
            this.previewError.set(err);
          } else {
            this.previewLanguageError.set(this.i18n.translate('matrix.form.previewLanguageError'));
          }
          this.previewLanguageLoading.set(false);
          this.previewLoading.set(false);
        },
      });
  }

  selectPreviewSheet(sheetKey: string): void {
    const state = this.requireAppliedQueryState();
    this.commitQueryState({ ...state, previewSheet: sheetKey });
  }

  setPreviewLanguage(language: LanguageCode): void {
    if (
      this.previewLanguage() === language ||
      this.previewLanguageLoading() ||
      this.previewLoading()
    ) {
      return;
    }
    const state = this.requireAppliedQueryState();
    this.previewLanguageLoading.set(true);
    this.commitQueryState({ ...state, previewLanguage: language });
  }

  previewLanguageSelected(language: LanguageCode): boolean {
    return this.previewLanguage() === language;
  }

  openPreviewQuestion(slug: string): void {
    const questionId = this.previewQuestions()?.questionIdsBySlug[slug];
    if (questionId === undefined) {
      this.notifications.error(this.i18n.translate('adminMatrixWorkspace.loadError'));
      return;
    }
    void this.router.navigate(['/admin-panel/matrix-questions', questionId], {
      queryParamsHandling: 'preserve',
    });
  }

  openCreate(): void {
    this.formMode.set('create');
    this.formError.set(null);
    this.formSubmitting.set(false);
  }

  closeForm(): void {
    if (this.formSubmitting()) return;
    if (!this.unsavedChangesScope.confirmDiscard()) return;
    this.formMode.set(null);
    this.formError.set(null);
  }

  saveQuestion(payload: AdminMatrixQuestionPayload): void {
    this.formSubmitting.set(true);
    this.formError.set(null);
    this.workspaceService
      .createQuestion(payload, this.currentLanguage())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.formSubmitting.set(false);
          this.unsavedChangesScope.commit();
          this.closeForm();
          this.notifications.success(this.i18n.translate('adminMatrixWorkspace.saved'));
          this.loadFilterOptions();
          this.loadWorkspace();
        },
        error: (err: ApiError) => {
          this.formError.set(err);
          this.formSubmitting.set(false);
          this.notifications.error(this.i18n.translate('adminMatrixWorkspace.saveError'));
        },
      });
  }

  publish(item: AdminMatrixWorkspaceItem): void {
    if (item.missingFields.length > 0) {
      this.notifications.error(
        this.i18n.translate('adminMatrixWorkspace.publishMissingFields', {
          fields: this.missingFieldsText(item.missingFields),
        }),
      );
      return;
    }
    this.workspaceService
      .publishQuestion(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notifications.success(this.i18n.translate('matrix.notify.published'));
          this.loadWorkspace();
        },
        error: () => this.notifications.error(this.i18n.translate('matrix.notify.publishError')),
      });
  }

  unpublish(item: AdminMatrixWorkspaceItem): void {
    this.workspaceService
      .unpublishQuestion(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notifications.success(this.i18n.translate('matrix.notify.unpublished'));
          this.loadWorkspace();
        },
        error: () => this.notifications.error(this.i18n.translate('matrix.notify.unpublishError')),
      });
  }

  delete(item: AdminMatrixWorkspaceItem): void {
    if (
      this.document.defaultView?.confirm(
        this.i18n.translate('adminMatrixWorkspace.confirmDelete'),
      ) !== true
    ) {
      return;
    }
    this.workspaceService
      .deleteQuestion(item.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notifications.success(this.i18n.translate('matrix.notify.deleted'));
          this.loadWorkspace();
        },
        error: () => this.notifications.error(this.i18n.translate('matrix.notify.deleteError')),
      });
  }

  matrixActions(item: AdminMatrixWorkspaceItem): AdminAction[] {
    const publicationAction =
      item.publishStatus === 'Published'
        ? {
            id: 'unpublish',
            label: this.i18n.translate('shared.unpublish'),
            destructive: false,
            disabled: false,
          }
        : {
            id: 'publish',
            label: this.i18n.translate('shared.publish'),
            destructive: false,
            disabled: false,
          };
    return [
      {
        id: 'edit',
        label: this.i18n.translate('shared.edit'),
        destructive: false,
        disabled: false,
      },
      publicationAction,
      {
        id: 'delete',
        label: this.i18n.translate('shared.delete'),
        destructive: true,
        disabled: false,
      },
    ];
  }

  handleMatrixAction(actionId: string, item: AdminMatrixWorkspaceItem): void {
    switch (actionId) {
      case 'edit':
        void this.router.navigate(['/admin-panel/matrix-questions', item.id], {
          queryParamsHandling: 'preserve',
        });
        return;
      case 'publish':
        this.publish(item);
        return;
      case 'unpublish':
        this.unpublish(item);
        return;
      case 'delete':
        this.delete(item);
        return;
      default:
        throw new Error(`Unsupported matrix question action: ${actionId}`);
    }
  }

  gradeLabel(grade: AdminMatrixGrade | null): string {
    return grade === null
      ? this.i18n.translate('shared.notSet')
      : this.i18n.translate(this.i18n.enumGradeKey(grade));
  }

  interviewFrequencyLabel(frequency: AdminMatrixInterviewFrequency | null): string {
    return frequency === null
      ? this.i18n.translate('shared.notSet')
      : this.i18n.translate(this.i18n.enumInterviewFrequencyKey(frequency));
  }

  sortLabel(sort: AdminMatrixWorkspaceSort): string {
    return this.i18n.translate(`adminMatrixWorkspace.sort.${sort}`);
  }

  publishStatusLabel(status: AdminMatrixPublishStatus): string {
    return this.i18n.translate(`enum.publishStatus.${status}`);
  }

  missingFieldLabel(field: string): string {
    return this.i18n.translate(`matrix.readiness.field.${field}`);
  }

  missingFieldsText(fields: readonly AdminMatrixMissingField[]): string {
    return fields.map((field) => this.missingFieldLabel(field)).join(', ');
  }

  private buildWorkspaceFilters(
    state: MatrixWorkspaceQueryState,
  ): AdminMatrixQuestionWorkspaceFilters {
    return {
      page: state.page,
      pageSize: state.pageSize,
      language: this.currentLanguage(),
      sort: state.sort,
      searchQuery: state.searchQuery ?? undefined,
      sheetKeys: optionalArray(state.sheetKey),
      grades: optionalArray(state.grade),
      interviewFrequencies: optionalArray(state.interviewFrequency),
      sectionIds: optionalArray(state.sectionId),
      subsectionIds: optionalArray(state.subsectionId),
      publishStatuses: optionalArray(state.publishStatus),
      publishedFrom: state.publishedFrom ?? undefined,
      publishedTo: state.publishedTo ?? undefined,
      hasMissingFields: state.hasMissingFields ?? undefined,
    };
  }

  private refreshDependentFilterControls(): void {
    if (this.selectedFilterSheetKey() && this.sectionOptions().length > 0) {
      this.filtersForm.controls.sectionId.enable({ emitEvent: false });
    } else {
      this.filtersForm.controls.sectionId.disable({ emitEvent: false });
    }

    if (this.selectedFilterSectionId() && this.subsectionOptions().length > 0) {
      this.filtersForm.controls.subsectionId.enable({ emitEvent: false });
    } else {
      this.filtersForm.controls.subsectionId.disable({ emitEvent: false });
    }
  }

  private loadPreviewSnapshot(
    language: LanguageCode,
    requestedSheetKey: string | null,
  ): Observable<PreviewSnapshot> {
    return this.workspaceService.listPreviewSheets(language).pipe(
      switchMap((sheets) => {
        const selectedSheetKey =
          requestedSheetKey !== null && sheets.some((sheet) => sheet.key === requestedSheetKey)
            ? requestedSheetKey
            : (sheets[0]?.key ?? null);
        if (selectedSheetKey === null) {
          return of({ language, sheets, selectedSheetKey, questions: null });
        }
        return this.workspaceService
          .listPreviewQuestions(selectedSheetKey, language)
          .pipe(map((questions) => ({ language, sheets, selectedSheetKey, questions })));
      }),
    );
  }

  private applyPreviewSnapshot(snapshot: PreviewSnapshot): void {
    this.previewLanguage.set(snapshot.language);
    this.previewSheets.set(snapshot.sheets);
    this.selectedPreviewSheetKey.set(snapshot.selectedSheetKey);
    this.previewQuestions.set(snapshot.questions);
  }

  private setupQueryState(validateDynamicValues: boolean): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.currentQueryParams = params;
      const state = this.queryStateFromParams(params, validateDynamicValues);
      const canonical = this.serializeQueryState(state);
      if (
        this.skipNextCanonicalLoad !== null &&
        canonicalQueryMatches(params, MATRIX_QUERY_KEYS, this.skipNextCanonicalLoad)
      ) {
        this.skipNextCanonicalLoad = null;
        return;
      }
      this.applyQueryState(state);
      if (!canonicalQueryMatches(params, MATRIX_QUERY_KEYS, canonical)) {
        this.replaceQueryAndLoad(state, canonical);
        return;
      }
      this.loadForQueryState(state);
    });
  }

  private queryStateFromParams(
    params: ParamMap,
    validateDynamicValues: boolean,
  ): MatrixWorkspaceQueryState {
    const tab = readFiniteQuery(params, 'tab', WORKSPACE_TABS, 'list').value;
    const requestedSheet = readOptionalStringQuery(params, 'sheet').value;
    const sheetKey = this.dynamicValue(
      requestedSheet,
      this.filterOptions().sheets.map((sheet) => sheet.key),
      validateDynamicValues,
    );
    const requestedSectionId = readOptionalStringQuery(params, 'sectionId').value;
    const sections =
      this.filterOptions().sheets.find((sheet) => sheet.key === sheetKey)?.sections ?? [];
    const sectionId = this.dynamicValue(
      requestedSectionId,
      sections.map((section) => section.id),
      validateDynamicValues,
    );
    const requestedSubsectionId = readOptionalStringQuery(params, 'subsectionId').value;
    const subsections = sections.find((section) => section.id === sectionId)?.subsections ?? [];
    const subsectionId = this.dynamicValue(
      requestedSubsectionId,
      subsections.map((subsection) => subsection.id),
      validateDynamicValues,
    );
    const requestedPreviewLanguage = finiteOptionalQuery(
      params,
      'previewLanguage',
      PREVIEW_LANGUAGES,
    );
    const requestedPreviewSheet = this.dynamicValue(
      readOptionalStringQuery(params, 'previewSheet').value,
      this.filterOptions().sheets.map((sheet) => sheet.key),
      validateDynamicValues,
    );
    return {
      tab,
      searchQuery: readOptionalStringQuery(params, 'q').value,
      sheetKey,
      grade: finiteOptionalQuery(params, 'grade', GRADES),
      interviewFrequency: finiteOptionalQuery(params, 'interviewFrequency', INTERVIEW_FREQUENCIES),
      sectionId,
      subsectionId,
      publishStatus: finiteOptionalQuery(params, 'publishStatus', PUBLISH_STATUSES),
      hasMissingFields: readOptionalBooleanQuery(params, 'hasMissingFields').value,
      sort: readFiniteQuery(params, 'sort', SORTS, 'newest').value,
      pageSize: Number(readFiniteQuery(params, 'pageSize', PAGE_SIZE_VALUES, '20').value),
      publishedFrom: readIsoDateQuery(params, 'publishedFrom').value,
      publishedTo: readIsoDateQuery(params, 'publishedTo').value,
      page: readPositiveIntegerQuery(params, 'page', 1).value,
      previewLanguage:
        tab === 'preview'
          ? (requestedPreviewLanguage ?? this.currentLanguage())
          : requestedPreviewLanguage,
      previewSheet:
        tab === 'preview'
          ? (requestedPreviewSheet ?? this.filterOptions().sheets[0]?.key ?? null)
          : requestedPreviewSheet,
    };
  }

  private dynamicValue(
    requested: string | null,
    values: readonly string[],
    validate: boolean,
  ): string | null {
    if (requested === null || !validate) return requested;
    return values.includes(requested) ? requested : null;
  }

  private applyQueryState(state: MatrixWorkspaceQueryState): void {
    this.appliedQueryState = state;
    this.activeTab.set(state.tab);
    this.page.set(state.page);
    this.selectedFilterSheetKey.set(state.sheetKey ?? '');
    this.selectedFilterSectionId.set(state.sectionId ?? '');
    this.filtersForm.setValue(
      {
        searchQuery: state.searchQuery ?? '',
        sheetKey: state.sheetKey ?? '',
        grade: state.grade ?? '',
        interviewFrequency: state.interviewFrequency ?? '',
        sectionId: state.sectionId ?? '',
        subsectionId: state.subsectionId ?? '',
        publishStatus: state.publishStatus ?? '',
        publishedFrom: state.publishedFrom ?? '',
        publishedTo: state.publishedTo ?? '',
        hasMissingFields: state.hasMissingFields === null ? '' : String(state.hasMissingFields),
        sort: state.sort,
        pageSize: String(state.pageSize),
      },
      { emitEvent: false },
    );
    this.refreshDependentFilterControls();
  }

  private stateFromForm(state: MatrixWorkspaceQueryState): MatrixWorkspaceQueryState {
    const raw = this.filtersForm.getRawValue();
    return {
      ...state,
      searchQuery: queryString(raw.searchQuery),
      sheetKey: queryString(raw.sheetKey),
      grade: finiteFormValue(raw.grade, GRADES),
      interviewFrequency: finiteFormValue(raw.interviewFrequency, INTERVIEW_FREQUENCIES),
      sectionId: queryString(raw.sectionId),
      subsectionId: queryString(raw.subsectionId),
      publishStatus: finiteFormValue(raw.publishStatus, PUBLISH_STATUSES),
      hasMissingFields: raw.hasMissingFields === '' ? null : raw.hasMissingFields === 'true',
      sort: raw.sort,
      pageSize: Number(raw.pageSize),
      publishedFrom: queryString(raw.publishedFrom),
      publishedTo: queryString(raw.publishedTo),
    };
  }

  private commitQueryState(state: MatrixWorkspaceQueryState): void {
    const canonical = this.serializeQueryState(state);
    if (
      this.currentQueryParams !== null &&
      canonicalQueryMatches(this.currentQueryParams, MATRIX_QUERY_KEYS, canonical)
    ) {
      this.applyQueryState(state);
      this.loadForQueryState(state);
      return;
    }
    this.replaceQueryAndLoad(state, canonical);
  }

  private serializeQueryState(state: MatrixWorkspaceQueryState): Record<string, string | null> {
    return {
      tab: queryFinite(state.tab, 'list'),
      q: state.searchQuery,
      sheet: state.sheetKey,
      grade: state.grade,
      interviewFrequency: state.interviewFrequency,
      sectionId: state.sectionId,
      subsectionId: state.subsectionId,
      publishStatus: state.publishStatus,
      hasMissingFields: state.hasMissingFields === null ? null : String(state.hasMissingFields),
      sort: queryFinite(state.sort, 'newest'),
      pageSize: queryNumber(state.pageSize, 20),
      publishedFrom: state.publishedFrom,
      publishedTo: state.publishedTo,
      page: queryNumber(state.page, 1),
      previewLanguage: state.previewLanguage,
      previewSheet: state.previewSheet,
    };
  }

  private requireAppliedQueryState(): MatrixWorkspaceQueryState {
    const state = this.appliedQueryState;
    if (state === null) throw new Error('Matrix workspace query state is not initialized');
    return state;
  }

  private replaceQueryAndLoad(
    state: MatrixWorkspaceQueryState,
    canonical: Record<string, string | null>,
  ): void {
    this.applyQueryState(state);
    this.skipNextCanonicalLoad = canonical;
    void replaceAdminQueryParams(this.router, this.route, canonical);
    this.loadForQueryState(state);
  }

  private replaceQueryWithoutLoad(state: MatrixWorkspaceQueryState): void {
    const canonical = this.serializeQueryState(state);
    this.applyQueryState(state);
    this.skipNextCanonicalLoad = canonical;
    void replaceAdminQueryParams(this.router, this.route, canonical);
  }

  private loadForQueryState(state: MatrixWorkspaceQueryState): void {
    if (state.tab === 'preview') this.loadPreviewSheets();
    else this.loadWorkspace();
  }

  private datePickerTranslation(key: string): string {
    this.i18n.language();
    return this.i18n.translate(`shared.datePicker.${key}`);
  }

  currentLanguage(): LanguageCode {
    const language = this.i18n.language();
    if (language === null) {
      throw new Error('I18n language is not initialized');
    }
    return language;
  }
}

function emptyMatrixQueryState(): MatrixWorkspaceQueryState {
  return {
    tab: 'list',
    searchQuery: null,
    sheetKey: null,
    grade: null,
    interviewFrequency: null,
    sectionId: null,
    subsectionId: null,
    publishStatus: null,
    hasMissingFields: null,
    sort: 'newest',
    pageSize: 20,
    publishedFrom: null,
    publishedTo: null,
    page: 1,
    previewLanguage: null,
    previewSheet: null,
  };
}

function optionalArray<T>(value: T | null): T[] | undefined {
  return value === null ? undefined : [value];
}

function finiteOptionalQuery<T extends string>(
  params: ParamMap,
  key: string,
  values: readonly T[],
): T | null {
  const value = readOptionalStringQuery(params, key).value;
  return value !== null && values.includes(value as T) ? (value as T) : null;
}

function finiteFormValue<T extends string>(value: string, values: readonly T[]): T | null {
  return values.includes(value as T) ? (value as T) : null;
}
