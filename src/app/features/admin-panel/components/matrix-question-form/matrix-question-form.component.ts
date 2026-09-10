import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  Injector,
  OnChanges,
  OnInit,
  Output,
  PLATFORM_ID,
  SimpleChanges,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { EMPTY, catchError, map } from 'rxjs';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MarkdownEditorComponent } from '../../../../core/editor/markdown-editor.component';
import { MarkdownEditorStickyBottomInsetDirective } from '../../../../core/editor/markdown-editor.sticky-bottom-inset.directive';
import { LanguageCode } from '../../../../core/i18n/i18n.model';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { slugify } from '../../../../shared/utils/slugify';
import {
  AdminMatrixGrade,
  AdminMatrixInterviewFrequency,
  AdminMatrixQuestionCreateInitialValue,
  AdminMatrixQuestionDetailDto,
  AdminMatrixQuestionPayload,
  AdminMatrixResource,
  AdminMatrixResourceAttachmentPayload,
  AdminMatrixPublishStatus,
} from '../../models/matrix-question-workspace.model';
import { MatrixQuestionWorkspaceService } from '../../services/matrix-question-workspace.service';
import { MatrixStructurePickerComponent } from '../matrix-structure-picker/matrix-structure-picker.component';
import { AdminControlValidationStateDirective } from '../../directives/admin-control-validation-state.directive';
import {
  AdminUnsavedChangesScope,
  AdminUnsavedChangesSource,
} from '../../services/admin-unsaved-changes.service';
import {
  MatrixQuestionPreviewResource,
  MatrixQuestionPublicPreviewComponent,
} from './matrix-question-public-preview.component';
import {
  MatrixQuestionTranslationChange,
  MatrixQuestionTranslationField,
} from './matrix-question-translation.model';
import { MatrixQuestionTranslationWorkspaceComponent } from './matrix-question-translation-workspace.component';
import { matrixQuestionTranslationFieldKey } from './matrix-question-translation-package';
import {
  MatrixQuestionReadinessFieldId,
  MatrixQuestionReadinessItem,
  analyzeMatrixQuestionReadiness,
  matrixQuestionResourceContextKey,
  matrixQuestionTranslationFieldSignature,
} from './matrix-question-readiness.model';
import { MatrixQuestionReadinessPanelComponent } from './matrix-question-readiness-panel.component';
import {
  SiteSelectComponent,
  SiteSelectOption,
} from '../../../../shared/ui/site-select/site-select.component';
import {
  ADMIN_VALIDATION_LIMITS,
  controlInvalid,
  isHttpUrl,
  isRequiredShortText,
  slugValidator,
  trimRequired,
  validationMessage,
} from '../../utils/admin-validation';

const GRADES: readonly AdminMatrixGrade[] = ['Junior', 'Junior+', 'Middle', 'Middle+', 'Senior'];
const INTERVIEW_FREQUENCIES: readonly AdminMatrixInterviewFrequency[] = [
  'constantly',
  'often',
  'rarely',
  'neverSeen',
];
const PUBLISH_STATUSES: readonly AdminMatrixPublishStatus[] = ['Draft', 'Published'];
const RESOURCE_SEARCH_LIMIT = 10;
const READINESS_FORM_FIELDS = [
  'slug',
  'subsectionId',
  'questionRu',
  'questionEn',
  'answerRu',
  'answerEn',
  'interviewAnswerExplanationRu',
  'interviewAnswerExplanationEn',
] as const satisfies readonly MatrixQuestionReadinessFieldId[];

type MatrixQuestionField =
  | 'slug'
  | 'subsectionId'
  | 'questionRu'
  | 'questionEn'
  | 'answerRu'
  | 'answerEn'
  | 'interviewAnswerExplanationRu'
  | 'interviewAnswerExplanationEn';
type NewResourceField = 'nameRu' | 'nameEn' | 'url';
type MatrixQuestionDisplayMode = 'ru' | 'en' | 'ruEn';
type MatrixQuestionViewMode = 'edit' | 'translation' | 'preview';

interface AdminMatrixAttachedResourceTranslations {
  ru: { name: string; context: string };
  en: { name: string; context: string };
}

interface AdminMatrixResourceDraft {
  id: string;
  name: string;
  url: string;
  context: string;
  isNew: boolean;
  translations: AdminMatrixAttachedResourceTranslations;
}

@Component({
  selector: 'app-admin-matrix-question-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MarkdownEditorComponent,
    MarkdownEditorStickyBottomInsetDirective,
    TranslatePipe,
    MatrixStructurePickerComponent,
    MatrixQuestionPublicPreviewComponent,
    MatrixQuestionTranslationWorkspaceComponent,
    MatrixQuestionReadinessPanelComponent,
    AdminControlValidationStateDirective,
    SiteSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './matrix-question-form.component.html',
  styles: [
    `
      .required-marker {
        color: var(--bs-danger);
        font-weight: 700;
      }

      .matrix-markdown-editor {
        border-radius: var(--bs-border-radius);
      }

      .matrix-markdown-editor-invalid {
        outline: 1px solid var(--bs-danger);
        outline-offset: 2px;
        box-shadow: 0 0 0 0.25rem rgba(var(--bs-danger-rgb), 0.25);
      }

      .matrix-question-form-action-footer {
        position: sticky;
        bottom: 0;
        z-index: 2;
        background-color: var(--bs-body-bg);
      }

      :host-context(.modal-body) .matrix-question-form-action-footer {
        bottom: calc(0rem - var(--bs-modal-padding, 1rem));
      }
    `,
  ],
})
export class MatrixQuestionFormComponent implements OnChanges, OnInit {
  private readonly workspaceService = inject(MatrixQuestionWorkspaceService);
  private readonly i18n = inject(I18nService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  @Input({ required: true }) mode!: 'create' | 'edit';
  @Input({ required: true }) question!: AdminMatrixQuestionDetailDto | null;
  @Input({ required: true }) createInitialValue!: AdminMatrixQuestionCreateInitialValue | null;
  @Input({ required: true }) submitting!: boolean;
  @Input({ required: true }) submitLabelKey!: string;
  @Input({ required: true }) showCancelAction!: boolean;
  @Input({ required: true }) unsavedChangesScope!: AdminUnsavedChangesScope;

  @Output() readonly questionSave = new EventEmitter<AdminMatrixQuestionPayload>();
  @Output() readonly formCancel = new EventEmitter<void>();

  readonly grades = GRADES;
  readonly interviewFrequencies = INTERVIEW_FREQUENCIES;
  readonly publishStatuses = PUBLISH_STATUSES;
  readonly gradeSelectOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return [
      { value: '', label: this.gradeLabel(null) },
      ...GRADES.map((grade) => ({ value: grade, label: this.gradeLabel(grade) })),
    ];
  });
  readonly interviewFrequencySelectOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return [
      { value: '', label: this.interviewFrequencyLabel(null) },
      ...INTERVIEW_FREQUENCIES.map((frequency) => ({
        value: frequency,
        label: this.interviewFrequencyLabel(frequency),
      })),
    ];
  });
  readonly publishStatusSelectOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return PUBLISH_STATUSES.map((status) => ({
      value: status,
      label: this.publishStatusLabel(status),
    }));
  });
  readonly formSubmitted = signal(false);
  readonly publishError = signal<string | null>(null);
  readonly resourceDrafts = signal<AdminMatrixResourceDraft[]>([]);
  readonly resourceSearchResults = signal<AdminMatrixResource[]>([]);
  readonly newResourceNameRu = signal('');
  readonly newResourceNameEn = signal('');
  readonly newResourceUrl = signal('');
  readonly newResourceSubmitted = signal(false);
  readonly validationLimits = ADMIN_VALIDATION_LIMITS;
  readonly localizedDisplayMode = signal<MatrixQuestionDisplayMode>('ru');
  readonly viewMode = signal<MatrixQuestionViewMode>('edit');
  readonly previewLanguage = signal<LanguageCode>(this.currentLanguage());
  readonly previewLanguageLoading = signal(false);
  readonly previewLanguageError = signal<string | null>(null);
  readonly previewBundleVersion = signal(0);
  readonly translationResetKey = signal('create:blank');
  readonly focusRenderVersion = signal(0);
  readonly reviewedTranslationSignatures = signal<ReadonlyMap<string, string>>(
    new Map<string, string>(),
  );
  readonly showRuLocalizedFields = computed(() => this.localizedDisplayMode() !== 'en');
  readonly showEnLocalizedFields = computed(() => this.localizedDisplayMode() !== 'ru');

  private nextNewResourceId = -1;
  private questionUnsavedSource: AdminUnsavedChangesSource | null = null;
  private newResourceUnsavedSource: AdminUnsavedChangesSource | null = null;
  private readonly structurePicker = viewChild(MatrixStructurePickerComponent);
  private readonly translationWorkspace = viewChild(MatrixQuestionTranslationWorkspaceComponent);
  private readonly answerRuEditor = viewChild<MarkdownEditorComponent>('answerRuEditor');
  private readonly answerEnEditor = viewChild<MarkdownEditorComponent>('answerEnEditor');
  private readonly explanationRuEditor = viewChild<MarkdownEditorComponent>('explanationRuEditor');
  private readonly explanationEnEditor = viewChild<MarkdownEditorComponent>('explanationEnEditor');
  private previousTranslationResetKey: string | undefined;
  private previousTranslationFieldSignatures = new Map<string, string>();

  readonly questionForm = this.formBuilder.group({
    slug: [
      '',
      [trimRequired, Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText), slugValidator],
    ],
    subsectionId: new FormControl<string | null>(null, { validators: Validators.required }),
    grade: this.formBuilder.control<AdminMatrixGrade | ''>(''),
    interviewFrequency: this.formBuilder.control<AdminMatrixInterviewFrequency | ''>(''),
    publishStatus: this.formBuilder.control<AdminMatrixPublishStatus>('Draft', {
      validators: Validators.required,
    }),
    questionRu: ['', [trimRequired, Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText)]],
    questionEn: ['', [trimRequired, Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText)]],
    answerRu: ['', Validators.maxLength(ADMIN_VALIDATION_LIMITS.matrixLongText)],
    answerEn: ['', Validators.maxLength(ADMIN_VALIDATION_LIMITS.matrixLongText)],
    interviewAnswerExplanationRu: [
      '',
      Validators.maxLength(ADMIN_VALIDATION_LIMITS.matrixLongText),
    ],
    interviewAnswerExplanationEn: [
      '',
      Validators.maxLength(ADMIN_VALIDATION_LIMITS.matrixLongText),
    ],
  });
  private readonly questionFormValue = toSignal(
    this.questionForm.valueChanges.pipe(map(() => this.questionForm.getRawValue())),
    { initialValue: this.questionForm.getRawValue() },
  );
  private readonly questionUnsavedSnapshot = computed(() => ({
    question: this.questionFormValue(),
    resources: this.resourceDrafts(),
  }));
  private readonly newResourceUnsavedSnapshot = computed(() => ({
    nameRu: this.newResourceNameRu(),
    nameEn: this.newResourceNameEn(),
    url: this.newResourceUrl(),
  }));
  private readonly unsavedTrackingActive = signal(true);
  readonly previewContent = computed(() => {
    const value = this.questionFormValue();
    const language = this.previewLanguage();
    return language === 'ru'
      ? {
          question: value.questionRu,
          answer: value.answerRu,
          interviewAnswerExplanation: value.interviewAnswerExplanationRu,
          interviewFrequency: value.interviewFrequency || null,
        }
      : {
          question: value.questionEn,
          answer: value.answerEn,
          interviewAnswerExplanation: value.interviewAnswerExplanationEn,
          interviewFrequency: value.interviewFrequency || null,
        };
  });
  readonly previewResources = computed<MatrixQuestionPreviewResource[]>(() => {
    const language = this.previewLanguage();
    return this.resourceDrafts().map((resource) => ({
      key: resource.id,
      name: resource.translations[language].name,
      url: resource.url,
      context: resource.translations[language].context,
    }));
  });
  readonly translationFields = computed<MatrixQuestionTranslationField[]>(() => {
    const value = this.questionFormValue();
    const questionFields: MatrixQuestionTranslationField[] = [
      {
        scope: 'question',
        fieldId: 'question',
        source: value.questionRu,
        translation: value.questionEn,
        editable: true,
        required: true,
        maxLength: ADMIN_VALIDATION_LIMITS.shortText,
      },
      {
        scope: 'question',
        fieldId: 'answer',
        source: value.answerRu,
        translation: value.answerEn,
        editable: true,
        required: true,
        maxLength: ADMIN_VALIDATION_LIMITS.matrixLongText,
      },
      {
        scope: 'question',
        fieldId: 'interviewAnswerExplanation',
        source: value.interviewAnswerExplanationRu,
        translation: value.interviewAnswerExplanationEn,
        editable: true,
        required: true,
        maxLength: ADMIN_VALIDATION_LIMITS.matrixLongText,
      },
    ];
    const resourceFields = this.resourceDrafts().flatMap<MatrixQuestionTranslationField>(
      (resource) => [
        {
          scope: 'resource',
          resourceId: resource.id,
          fieldId: 'name',
          resourceLabel: resource.translations[this.currentLanguage()].name,
          resourceUrl: resource.url,
          source: resource.translations.ru.name,
          translation: resource.translations.en.name,
          editable: resource.isNew,
          required: resource.isNew,
          maxLength: ADMIN_VALIDATION_LIMITS.shortText,
        },
        {
          scope: 'resource',
          resourceId: resource.id,
          fieldId: 'context',
          resourceLabel: resource.translations[this.currentLanguage()].name,
          resourceUrl: resource.url,
          source: resource.translations.ru.context,
          translation: resource.translations.en.context,
          editable: true,
          required: false,
          maxLength: ADMIN_VALIDATION_LIMITS.matrixLongText,
        },
      ],
    );
    return [...questionFields, ...resourceFields];
  });
  readonly readiness = computed(() => {
    const value = this.questionFormValue();
    const invalidFields = new Set<MatrixQuestionReadinessFieldId>();
    for (const field of READINESS_FORM_FIELDS) {
      if (this.questionForm.controls[field].invalid) invalidFields.add(field);
    }
    const invalidResourceContextKeys = new Set<string>();
    for (const resource of this.resourceDrafts()) {
      for (const language of ['ru', 'en'] as const) {
        if (
          resource.translations[language].context.length > ADMIN_VALIDATION_LIMITS.matrixLongText
        ) {
          invalidResourceContextKeys.add(matrixQuestionResourceContextKey(resource.id, language));
        }
      }
    }
    return analyzeMatrixQuestionReadiness({
      slug: value.slug,
      subsectionId: value.subsectionId,
      grade: value.grade === '' ? null : value.grade,
      interviewFrequency: value.interviewFrequency === '' ? null : value.interviewFrequency,
      fields: this.translationFields(),
      resources: this.resourceDrafts().map((resource) => ({
        id: resource.id,
        label: resource.translations[this.currentLanguage()].name,
        contextRu: resource.translations.ru.context,
        contextEn: resource.translations.en.context,
      })),
      invalidFields,
      invalidResourceContextKeys,
      reviewedTranslationSignatures: this.reviewedTranslationSignatures(),
    });
  });

  constructor() {
    effect(() => {
      const resetKey = this.translationResetKey();
      const signatures = new Map(
        this.translationFields().map((field) => [
          matrixQuestionTranslationFieldKey(field),
          matrixQuestionTranslationFieldSignature(field),
        ]),
      );
      untracked(() => this.reconcileReviewedTranslations(resetKey, signatures));
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['question'] || changes['mode'] || changes['createInitialValue']) {
      this.resetFromQuestion();
      this.questionUnsavedSource?.commit();
    }
  }

  ngOnInit(): void {
    this.questionUnsavedSource = this.unsavedChangesScope.registerSource(
      this.questionUnsavedSnapshot,
      this.unsavedTrackingActive,
    );
    this.newResourceUnsavedSource = this.unsavedChangesScope.registerSource(
      this.newResourceUnsavedSnapshot,
      this.unsavedTrackingActive,
    );
    this.destroyRef.onDestroy(() => {
      this.questionUnsavedSource?.unregister();
      this.newResourceUnsavedSource?.unregister();
    });
  }

  acceptSavedQuestion(question: AdminMatrixQuestionDetailDto): void {
    this.question = question;
    this.resetFromQuestion();
    this.questionUnsavedSource?.commit();
  }

  discardDraftsAndAcceptQuestion(question: AdminMatrixQuestionDetailDto): void {
    this.discardAuxiliaryDrafts();
    this.acceptSavedQuestion(question);
  }

  discardAuxiliaryDrafts(): void {
    this.structurePicker()?.discardDrafts();
    this.newResourceNameRu.set('');
    this.newResourceNameEn.set('');
    this.newResourceUrl.set('');
    this.newResourceSubmitted.set(false);
    this.newResourceUnsavedSource?.commit();
  }

  submit(): void {
    this.formSubmitted.set(true);
    this.publishError.set(null);
    const readiness = this.readiness();
    if (!readiness.canSaveDraft) {
      this.questionForm.markAllAsTouched();
      this.publishError.set(
        this.i18n.translate('matrix.readiness.saveBlocked', {
          count: readiness.draftBlockerCount,
        }),
      );
      const firstDraftBlocker = readiness.issues.find((issue) => issue.severity === 'draftBlocker');
      if (firstDraftBlocker !== undefined) this.selectReadinessItem(firstDraftBlocker);
      return;
    }
    if (this.questionForm.controls.publishStatus.value === 'Published' && !readiness.canPublish) {
      const publicationBlockers = readiness.issues.filter(
        (issue) => issue.severity === 'publicationBlocker',
      );
      this.publishError.set(
        this.i18n.translate('adminMatrixWorkspace.publishMissingFields', {
          fields: publicationBlockers
            .map((issue) => this.i18n.translate(issue.labelKey, issue.labelParams))
            .join(', '),
        }),
      );
      if (publicationBlockers[0] !== undefined) {
        this.selectReadinessItem(publicationBlockers[0]);
      }
      return;
    }
    if (
      this.mode === 'create' &&
      this.questionUnsavedSource !== null &&
      !this.unsavedChangesScope.confirmDiscardExcept([this.questionUnsavedSource])
    ) {
      return;
    }
    const payload = this.buildQuestionPayload();
    this.questionSave.emit(payload);
  }

  selectReadinessItem(item: MatrixQuestionReadinessItem): void {
    this.focusRenderVersion.update((version) => version + 1);
    const target = item.target;
    if (target.kind === 'translation') {
      this.viewMode.set('translation');
      this.afterNextRender(() =>
        this.translationWorkspace()?.focusTranslationField(target.translationKey),
      );
      return;
    }

    this.viewMode.set('edit');
    if (target.kind === 'field') {
      const displayMode = displayModeForReadinessField(target.fieldId);
      if (displayMode !== null) this.localizedDisplayMode.set(displayMode);
      this.afterNextRender(() => this.focusReadinessField(target.fieldId));
      return;
    }
    if (target.kind === 'resourceSearch') {
      this.afterNextRender(() =>
        this.scrollAndFocus(
          this.host.nativeElement.querySelector<HTMLElement>(
            '[data-testid="matrix-resource-search"]',
          ),
        ),
      );
      return;
    }
    this.afterNextRender(() => this.focusResourceContext(target.resourceId, target.language));
  }

  reviewIdenticalTranslation(field: MatrixQuestionTranslationField): void {
    const reviewed = new Map(this.reviewedTranslationSignatures());
    reviewed.set(
      matrixQuestionTranslationFieldKey(field),
      matrixQuestionTranslationFieldSignature(field),
    );
    this.reviewedTranslationSignatures.set(reviewed);
  }

  fieldInvalid(field: MatrixQuestionField): boolean {
    return controlInvalid(this.questionForm.controls[field], this.formSubmitted());
  }

  fieldMessage(field: MatrixQuestionField): string | null {
    return validationMessage(this.questionForm.controls[field], this.i18n);
  }

  selectQuestionSubsection(subsectionId: string | null): void {
    this.questionForm.controls.subsectionId.setValue(subsectionId);
    this.questionForm.controls.subsectionId.markAsTouched();
    this.questionForm.controls.subsectionId.markAsDirty();
  }

  generateSlug(): void {
    const source = this.questionForm.controls.questionEn.value.trim();
    if (!source) return;
    this.questionForm.controls.slug.setValue(slugify(source));
    this.questionForm.controls.slug.markAsDirty();
    this.questionForm.controls.slug.markAsTouched();
  }

  canGenerateSlug(): boolean {
    return this.questionForm.controls.questionEn.value.trim() !== '';
  }

  setLocalizedDisplayMode(mode: MatrixQuestionDisplayMode): void {
    this.localizedDisplayMode.set(mode);
  }

  localizedDisplayModeSelected(mode: MatrixQuestionDisplayMode): boolean {
    return this.localizedDisplayMode() === mode;
  }

  setPreviewLanguage(language: LanguageCode): void {
    if (this.previewLanguage() === language || this.previewLanguageLoading()) return;
    this.previewLanguageLoading.set(true);
    this.previewLanguageError.set(null);
    this.i18n
      .ensureLanguageBundle(language)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => {
          this.previewLanguageLoading.set(false);
          this.previewLanguageError.set(this.i18n.translate('matrix.form.previewLanguageError'));
          return EMPTY;
        }),
      )
      .subscribe(() => {
        this.previewLanguage.set(language);
        this.previewLanguageLoading.set(false);
        this.previewBundleVersion.update((version) => version + 1);
      });
  }

  previewLanguageSelected(language: LanguageCode): boolean {
    return this.previewLanguage() === language;
  }

  showPreview(): void {
    this.previewLanguageError.set(null);
    this.previewBundleVersion.update((version) => version + 1);
    this.viewMode.set('preview');
  }

  showTranslation(): void {
    this.viewMode.set('translation');
  }

  showEdit(): void {
    this.viewMode.set('edit');
  }

  showEnglishPreview(): void {
    this.publishError.set(null);
    this.previewLanguageError.set(null);
    if (this.previewLanguage() === 'en') {
      this.showPreview();
      return;
    }
    if (this.previewLanguageLoading()) return;
    this.previewLanguageLoading.set(true);
    this.i18n
      .ensureLanguageBundle('en')
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        catchError(() => {
          this.previewLanguageLoading.set(false);
          this.publishError.set(this.i18n.translate('matrix.form.previewLanguageError'));
          return EMPTY;
        }),
      )
      .subscribe(() => {
        this.previewLanguage.set('en');
        this.previewLanguageLoading.set(false);
        this.previewBundleVersion.update((version) => version + 1);
        this.viewMode.set('preview');
      });
  }

  applyTranslationChange(change: MatrixQuestionTranslationChange): void {
    if (change.scope === 'question') {
      if (change.fieldId === 'question') {
        this.updateFormControl(this.questionForm.controls.questionEn, change.value);
      } else if (change.fieldId === 'answer') {
        this.updateFormControl(this.questionForm.controls.answerEn, change.value);
      } else if (change.fieldId === 'interviewAnswerExplanation') {
        this.updateFormControl(
          this.questionForm.controls.interviewAnswerExplanationEn,
          change.value,
        );
      }
      return;
    }
    const resourceIndex = this.resourceDrafts().findIndex(
      (resource) => resource.id === change.resourceId,
    );
    if (resourceIndex < 0) return;
    if (change.fieldId === 'name') {
      this.updateResourceName(resourceIndex, 'en', change.value);
      return;
    }
    if (change.fieldId === 'context') {
      this.updateResourceContext(resourceIndex, 'en', change.value);
    }
  }

  setAnswerRu(value: string): void {
    this.updateMarkdownContent(this.questionForm.controls.answerRu, value);
  }

  setAnswerEn(value: string): void {
    this.updateMarkdownContent(this.questionForm.controls.answerEn, value);
  }

  setInterviewAnswerExplanationRu(value: string): void {
    this.updateMarkdownContent(this.questionForm.controls.interviewAnswerExplanationRu, value);
  }

  setInterviewAnswerExplanationEn(value: string): void {
    this.updateMarkdownContent(this.questionForm.controls.interviewAnswerExplanationEn, value);
  }

  searchResources(value: string): void {
    const searchName = value.trim();
    if (searchName.length < 2) {
      this.resourceSearchResults.set([]);
      return;
    }
    this.workspaceService
      .searchResources(searchName, RESOURCE_SEARCH_LIMIT, this.currentLanguage())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resources) => this.resourceSearchResults.set(resources),
        error: () => {
          this.resourceSearchResults.set([]);
          this.publishError.set(this.i18n.translate('matrix.notify.resourcesError'));
        },
      });
  }

  attachResource(resource: AdminMatrixResource): void {
    if (this.resourceDrafts().some((draft) => !draft.isNew && draft.id === resource.id)) return;
    this.resourceDrafts.update((drafts) => [
      ...drafts,
      {
        ...resource,
        context: '',
        translations: {
          ru: { name: resource.translations.ru.name, context: '' },
          en: { name: resource.translations.en.name, context: '' },
        },
        isNew: false,
      },
    ]);
  }

  addNewResource(): void {
    this.newResourceSubmitted.set(true);
    const nameRu = this.newResourceNameRu().trim();
    const nameEn = this.newResourceNameEn().trim();
    const url = this.newResourceUrl().trim();
    if (
      !isRequiredShortText(nameRu) ||
      !isRequiredShortText(nameEn) ||
      !this.newResourceUrlValid()
    ) {
      return;
    }
    this.resourceDrafts.update((drafts) => [
      ...drafts,
      {
        id: `new-${this.nextNewResourceId--}`,
        name: this.currentLanguage() === 'ru' ? nameRu : nameEn,
        url,
        context: '',
        translations: {
          ru: { name: nameRu, context: '' },
          en: { name: nameEn, context: '' },
        },
        isNew: true,
      },
    ]);
    this.newResourceNameRu.set('');
    this.newResourceNameEn.set('');
    this.newResourceUrl.set('');
    this.newResourceSubmitted.set(false);
  }

  updateResourceContext(index: number, language: 'ru' | 'en', context: string): void {
    this.resourceDrafts.update((drafts) =>
      drafts.map((draft, currentIndex) =>
        currentIndex === index
          ? {
              ...draft,
              context: language === this.currentLanguage() ? context : draft.context,
              translations: {
                ...draft.translations,
                [language]: { ...draft.translations[language], context },
              },
            }
          : draft,
      ),
    );
  }

  updateResourceName(index: number, language: 'ru' | 'en', name: string): void {
    this.resourceDrafts.update((drafts) =>
      drafts.map((draft, currentIndex) =>
        currentIndex === index && draft.isNew
          ? {
              ...draft,
              name: language === this.currentLanguage() ? name : draft.name,
              translations: {
                ...draft.translations,
                [language]: { ...draft.translations[language], name },
              },
            }
          : draft,
      ),
    );
  }

  detachResource(index: number): void {
    this.resourceDrafts.update((drafts) =>
      drafts.filter((_, currentIndex) => currentIndex !== index),
    );
  }

  newResourceFieldInvalid(field: NewResourceField): boolean {
    if (!this.newResourceSubmitted()) return false;
    return this.newResourceFieldMessage(field) !== null;
  }

  newResourceFieldMessage(field: NewResourceField): string | null {
    const value = this.newResourceValue(field).trim();
    if (value === '') return this.i18n.translate('validation.required');
    if (field === 'url') {
      if (value.length > ADMIN_VALIDATION_LIMITS.url) {
        return this.i18n.translate('validation.maxLength', {
          max: String(ADMIN_VALIDATION_LIMITS.url),
        });
      }
      return isHttpUrl(value) ? null : this.i18n.translate('validation.url');
    }
    if (value.length > ADMIN_VALIDATION_LIMITS.shortText) {
      return this.i18n.translate('validation.maxLength', {
        max: String(ADMIN_VALIDATION_LIMITS.shortText),
      });
    }
    return null;
  }

  resourceContextInvalid(index: number, language: 'ru' | 'en'): boolean {
    return (
      this.resourceDrafts()[index]?.translations[language].context.length >
      ADMIN_VALIDATION_LIMITS.matrixLongText
    );
  }

  resourceContextMessage(index: number, language: 'ru' | 'en'): string | null {
    if (!this.resourceContextInvalid(index, language)) return null;
    return this.i18n.translate('validation.maxLength', {
      max: String(ADMIN_VALIDATION_LIMITS.matrixLongText),
    });
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

  publishStatusLabel(status: AdminMatrixPublishStatus): string {
    return this.i18n.translate(`enum.publishStatus.${status}`);
  }

  get preferredSheetKey(): string | null {
    return this.question === null ? (this.createInitialValue?.preferredSheetKey ?? null) : null;
  }

  currentLanguage(): 'ru' | 'en' {
    const language = this.i18n.language();
    if (language === null) {
      throw new Error('I18n language is not initialized');
    }
    return language;
  }

  private resetFromQuestion(): void {
    this.formSubmitted.set(false);
    this.publishError.set(null);
    this.localizedDisplayMode.set('ru');
    this.viewMode.set('edit');
    this.previewLanguage.set(this.currentLanguage());
    this.previewLanguageLoading.set(false);
    this.previewLanguageError.set(null);
    this.translationResetKey.set(
      this.question === null
        ? `create:${this.createInitialValue?.slug ?? 'blank'}`
        : `question:${this.question.id}`,
    );
    this.reviewedTranslationSignatures.set(new Map<string, string>());
    if (this.question === null) {
      const initialValue = this.createInitialValue;
      this.questionForm.reset({
        slug: initialValue?.slug ?? '',
        subsectionId: initialValue?.subsectionId ?? null,
        grade: initialValue?.grade ?? '',
        interviewFrequency: initialValue?.interviewFrequency ?? '',
        publishStatus: initialValue?.publishStatus ?? 'Draft',
        questionRu: initialValue?.translations.ru.question ?? '',
        questionEn: initialValue?.translations.en.question ?? '',
        answerRu: initialValue?.translations.ru.answer ?? '',
        answerEn: initialValue?.translations.en.answer ?? '',
        interviewAnswerExplanationRu:
          initialValue?.translations.ru.interviewAnswerExplanation ?? '',
        interviewAnswerExplanationEn:
          initialValue?.translations.en.interviewAnswerExplanation ?? '',
      });
      this.resetResourceDrafts();
      return;
    }
    this.questionForm.reset({
      slug: this.question.slug,
      subsectionId: this.question.subsectionId,
      grade: this.question.grade ?? '',
      interviewFrequency: this.question.interviewFrequency ?? '',
      publishStatus: this.question.publishStatus,
      questionRu: this.question.translations.ru.question,
      questionEn: this.question.translations.en.question,
      answerRu: this.question.translations.ru.answer,
      answerEn: this.question.translations.en.answer,
      interviewAnswerExplanationRu: this.question.translations.ru.interviewAnswerExplanation,
      interviewAnswerExplanationEn: this.question.translations.en.interviewAnswerExplanation,
    });
    this.resourceDrafts.set(this.question.resources.map(toResourceDraft));
    this.resourceSearchResults.set([]);
  }

  private buildQuestionPayload(): AdminMatrixQuestionPayload {
    const raw = this.questionForm.getRawValue();
    if (raw.subsectionId === null) {
      throw new Error('Matrix question subsection is required');
    }
    return {
      slug: raw.slug.trim(),
      subsectionId: raw.subsectionId,
      grade: raw.grade === '' ? null : raw.grade,
      interviewFrequency: raw.interviewFrequency === '' ? null : raw.interviewFrequency,
      publishStatus: raw.publishStatus,
      translations: {
        ru: {
          question: raw.questionRu.trim(),
          answer: raw.answerRu,
          interviewAnswerExplanation: raw.interviewAnswerExplanationRu,
        },
        en: {
          question: raw.questionEn.trim(),
          answer: raw.answerEn,
          interviewAnswerExplanation: raw.interviewAnswerExplanationEn,
        },
      },
      resources: this.resourceDrafts().map(toResourceAttachmentPayload),
    };
  }

  private resetResourceDrafts(): void {
    this.resourceDrafts.set([]);
    this.resourceSearchResults.set([]);
    this.newResourceNameRu.set('');
    this.newResourceNameEn.set('');
    this.newResourceUrl.set('');
    this.newResourceSubmitted.set(false);
    this.nextNewResourceId = -1;
  }

  private updateMarkdownContent(control: FormControl<string>, value: string): void {
    this.updateFormControl(control, value);
  }

  private updateFormControl(control: FormControl<string>, value: string): void {
    control.setValue(value);
    control.markAsDirty();
    control.markAsTouched();
  }

  private newResourceValue(field: NewResourceField): string {
    if (field === 'nameRu') return this.newResourceNameRu();
    if (field === 'nameEn') return this.newResourceNameEn();
    return this.newResourceUrl();
  }

  private newResourceUrlValid(): boolean {
    const url = this.newResourceUrl().trim();
    return url.length <= ADMIN_VALIDATION_LIMITS.url && httpUrlValidatorValue(url);
  }

  private reconcileReviewedTranslations(
    resetKey: string,
    fieldSignatures: ReadonlyMap<string, string>,
  ): void {
    if (this.previousTranslationResetKey !== resetKey) {
      this.reviewedTranslationSignatures.set(new Map<string, string>());
    } else {
      const reviewed = new Map(this.reviewedTranslationSignatures());
      let changed = false;
      for (const [key, reviewedSignature] of reviewed) {
        if (
          fieldSignatures.get(key) !== this.previousTranslationFieldSignatures.get(key) ||
          fieldSignatures.get(key) !== reviewedSignature
        ) {
          reviewed.delete(key);
          changed = true;
        }
      }
      if (changed) this.reviewedTranslationSignatures.set(reviewed);
    }
    this.previousTranslationResetKey = resetKey;
    this.previousTranslationFieldSignatures = new Map(fieldSignatures);
  }

  private afterNextRender(callback: () => void): void {
    if (!this.isBrowser) return;
    afterNextRender({ write: callback }, { injector: this.injector });
  }

  private focusReadinessField(
    fieldId: Extract<MatrixQuestionReadinessItem['target'], { kind: 'field' }>['fieldId'],
  ): void {
    if (fieldId === 'subsectionId') {
      this.structurePicker()?.focusSubsection();
      return;
    }
    const markdownEditor = this.markdownEditorForField(fieldId);
    if (markdownEditor !== null) {
      this.host.nativeElement
        .querySelector<HTMLElement>(`#matrix-form-${readinessFieldDomSuffix(fieldId)}`)
        ?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      markdownEditor.focus();
      return;
    }
    this.scrollAndFocus(
      this.host.nativeElement.querySelector<HTMLElement>(
        `#matrix-form-${readinessFieldDomSuffix(fieldId)}`,
      ),
    );
  }

  private markdownEditorForField(
    fieldId: Extract<MatrixQuestionReadinessItem['target'], { kind: 'field' }>['fieldId'],
  ): MarkdownEditorComponent | null {
    if (fieldId === 'answerRu') return this.answerRuEditor() ?? null;
    if (fieldId === 'answerEn') return this.answerEnEditor() ?? null;
    if (fieldId === 'interviewAnswerExplanationRu') return this.explanationRuEditor() ?? null;
    if (fieldId === 'interviewAnswerExplanationEn') return this.explanationEnEditor() ?? null;
    return null;
  }

  private focusResourceContext(resourceId: string, language: 'ru' | 'en'): void {
    const index = this.resourceDrafts().findIndex((resource) => resource.id === resourceId);
    if (index < 0) return;
    const suffix = language === 'ru' ? 'Ru' : 'En';
    this.scrollAndFocus(
      this.host.nativeElement.querySelector<HTMLElement>(`#matrixResourceContext${suffix}${index}`),
    );
  }

  private scrollAndFocus(target: HTMLElement | null): void {
    if (target === null) return;
    target.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    target.focus({ preventScroll: true });
  }
}

function httpUrlValidatorValue(value: string): boolean {
  return value !== '' && isHttpUrl(value);
}

function displayModeForReadinessField(
  fieldId: Extract<MatrixQuestionReadinessItem['target'], { kind: 'field' }>['fieldId'],
): MatrixQuestionDisplayMode | null {
  if (fieldId.endsWith('Ru')) return 'ru';
  if (fieldId.endsWith('En')) return 'en';
  return null;
}

function readinessFieldDomSuffix(
  fieldId: Extract<MatrixQuestionReadinessItem['target'], { kind: 'field' }>['fieldId'],
): string {
  const suffixByField = {
    slug: 'slug',
    subsectionId: 'subsection',
    grade: 'grade',
    interviewFrequency: 'interview-frequency',
    questionRu: 'question-ru',
    questionEn: 'question-en',
    answerRu: 'answer-ru',
    answerEn: 'answer-en',
    interviewAnswerExplanationRu: 'interview-answer-explanation-ru',
    interviewAnswerExplanationEn: 'interview-answer-explanation-en',
  } satisfies Record<
    Extract<MatrixQuestionReadinessItem['target'], { kind: 'field' }>['fieldId'],
    string
  >;
  return suffixByField[fieldId];
}

function toResourceDraft(
  resource: AdminMatrixQuestionDetailDto['resources'][number],
): AdminMatrixResourceDraft {
  return {
    ...resource,
    translations: resource.translations,
    isNew: false,
  };
}

function toResourceAttachmentPayload(
  resource: AdminMatrixResourceDraft,
): AdminMatrixResourceAttachmentPayload {
  if (resource.isNew) {
    return {
      resource: {
        url: resource.url,
        translations: {
          ru: { name: resource.translations.ru.name },
          en: { name: resource.translations.en.name },
        },
      },
      translations: {
        ru: { context: resource.translations.ru.context },
        en: { context: resource.translations.en.context },
      },
    };
  }
  return {
    resourceId: resource.id,
    translations: {
      ru: { context: resource.translations.ru.context },
      en: { context: resource.translations.en.context },
    },
  };
}
