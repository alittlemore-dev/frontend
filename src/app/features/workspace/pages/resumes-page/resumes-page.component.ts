import {
  ModalScrollDirective,
  NotificationService,
  EmptyStateComponent,
  ErrorMessageComponent,
  LoadingSpinnerComponent,
  SiteSelectComponent,
  SiteSelectOption,
  formatLocalizedDate,
} from '@alittlemore.dev/design-system';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { ApiError } from '../../../../core/models/api-error.model';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { I18nService } from '../../../../core/i18n/i18n.service';

import {
  Resume,
  ResumeLanguage,
  ResumePayload,
  Resumes,
} from '../../models/resume-workspace.model';
import { ResumeWorkspaceService } from '../../services/resume-workspace.service';
import {
  UnsavedChangesService,
  UnsavedChangesSource,
} from '../../../../core/unsaved-changes/unsaved-changes.service';
import {
  VALIDATION_LIMITS,
  controlInvalid,
  trimRequired,
  validationMessage,
} from '../../utils/validation';
import {
  canonicalQueryMatches,
  queryNumber,
  readPositiveIntegerQuery,
  replaceQueryParams,
} from '../../utils/query-state';

const PAGE_SIZE = 20;
const RESUMES_QUERY_KEYS = ['page'] as const;
type RequiredCreateField = 'title' | 'language' | 'fullName' | 'role' | 'summary';

interface ResumeLanguageOption {
  value: ResumeLanguage;
  labelKey: string;
}

const RESUME_LANGUAGE_OPTIONS: readonly ResumeLanguageOption[] = [
  { value: 'ru', labelKey: 'resumeWorkspace.languageRu' },
  { value: 'en', labelKey: 'resumeWorkspace.languageEn' },
];

@Component({
  selector: 'app-resumes-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    LoadingSpinnerComponent,
    ErrorMessageComponent,
    EmptyStateComponent,
    ModalScrollDirective,
    SiteSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './resumes-page.component.html',
  styleUrl: './resumes-page.component.scss',
})
export class ResumesPageComponent implements OnInit {
  private readonly resumeWorkspace = inject(ResumeWorkspaceService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly unsavedChangesScope = inject(UnsavedChangesService).createScope(this.destroyRef);
  private readonly createFormUnsavedSource: UnsavedChangesSource;
  private currentQueryParams: ParamMap | null = null;
  private skipNextCanonicalLoad: Record<string, string | null> | null = null;

  readonly page = signal(1);
  readonly resumes = signal<Resumes | null>(null);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly createDialogOpen = signal(false);
  readonly createSubmitting = signal(false);
  readonly createFormSubmitted = signal(false);
  readonly createError = signal<ApiError | null>(null);
  readonly createFormSnapshot = signal({
    title: '',
    language: '',
    fullName: '',
    role: '',
    summary: '',
  });
  readonly languageOptions = RESUME_LANGUAGE_OPTIONS;
  readonly languageSelectOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return [
      { value: '', label: this.i18n.translate('shared.notSet') },
      ...RESUME_LANGUAGE_OPTIONS.map((option) => ({
        value: option.value,
        label: this.i18n.translate(option.labelKey),
      })),
    ];
  });
  readonly validationLimits = VALIDATION_LIMITS;

  readonly createForm = this.formBuilder.group({
    title: ['', [trimRequired, Validators.maxLength(VALIDATION_LIMITS.shortText)]],
    language: ['', trimRequired],
    fullName: ['', [trimRequired, Validators.maxLength(VALIDATION_LIMITS.shortText)]],
    role: ['', [trimRequired, Validators.maxLength(VALIDATION_LIMITS.shortText)]],
    summary: ['', [trimRequired, Validators.maxLength(VALIDATION_LIMITS.resumeLongText)]],
  });

  constructor() {
    this.createFormSnapshot.set(this.createForm.getRawValue());
    this.createFormUnsavedSource = this.unsavedChangesScope.registerSource(
      this.createFormSnapshot,
      this.createDialogOpen,
    );
    this.createForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.createFormSnapshot.set(this.createForm.getRawValue());
    });
  }

  ngOnInit(): void {
    this.setupQueryState();
  }

  loadResumes(): void {
    this.loading.set(true);
    this.error.set(null);
    this.resumeWorkspace
      .listResumes({ page: this.page(), pageSize: PAGE_SIZE })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resumes) => {
          const lastPage = Math.max(1, resumes.totalPages);
          if (this.page() > lastPage) {
            this.commitPage(lastPage);
            return;
          }
          this.resumes.set(resumes);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err);
          this.loading.set(false);
          this.notifications.error(this.i18n.translate('resumeWorkspace.loadError'));
        },
      });
  }

  previousPage(): void {
    if (this.page() <= 1) return;
    this.commitPage(this.page() - 1);
  }

  nextPage(): void {
    if (this.page() >= (this.resumes()?.totalPages ?? 1)) return;
    this.commitPage(this.page() + 1);
  }

  openCreateDialog(): void {
    this.createForm.reset({
      title: '',
      language: '',
      fullName: '',
      role: '',
      summary: '',
    });
    this.createError.set(null);
    this.createSubmitting.set(false);
    this.createFormSubmitted.set(false);
    this.createFormUnsavedSource.commit();
    this.createDialogOpen.set(true);
  }

  closeCreateDialog(): void {
    if (this.createSubmitting()) return;
    if (!this.unsavedChangesScope.confirmDiscard()) return;
    this.createDialogOpen.set(false);
    this.createError.set(null);
    this.createFormSubmitted.set(false);
  }

  createResume(): void {
    this.createFormSubmitted.set(true);
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    this.createSubmitting.set(true);
    this.createError.set(null);
    this.resumeWorkspace
      .createResume(this.buildCreatePayload())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resume) => {
          this.createSubmitting.set(false);
          this.createFormUnsavedSource.commit();
          this.createDialogOpen.set(false);
          this.notifications.success(this.i18n.translate('resumeWorkspace.saved'));
          void this.router.navigate(['/personal-workspace/resumes', resume.id], {
            queryParamsHandling: 'preserve',
          });
        },
        error: (err: ApiError) => {
          this.createError.set(err);
          this.createSubmitting.set(false);
          this.notifications.error(this.i18n.translate('resumeWorkspace.saveError'));
        },
      });
  }

  private setupQueryState(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.currentQueryParams = params;
      const page = readPositiveIntegerQuery(params, 'page', 1).value;
      const canonical = { page: queryNumber(page, 1) };
      if (
        this.skipNextCanonicalLoad !== null &&
        canonicalQueryMatches(params, RESUMES_QUERY_KEYS, this.skipNextCanonicalLoad)
      ) {
        this.skipNextCanonicalLoad = null;
        return;
      }
      this.page.set(page);
      if (!canonicalQueryMatches(params, RESUMES_QUERY_KEYS, canonical)) {
        this.replacePageAndLoad(page, canonical);
        return;
      }
      this.loadResumes();
    });
  }

  private commitPage(page: number): void {
    const canonical = { page: queryNumber(page, 1) };
    if (
      this.currentQueryParams !== null &&
      canonicalQueryMatches(this.currentQueryParams, RESUMES_QUERY_KEYS, canonical)
    ) {
      this.loadResumes();
      return;
    }
    this.replacePageAndLoad(page, canonical);
  }

  private replacePageAndLoad(page: number, canonical: Record<string, string | null>): void {
    this.page.set(page);
    this.skipNextCanonicalLoad = canonical;
    void replaceQueryParams(this.router, this.route, canonical);
    this.loadResumes();
  }

  completedSections(resume: Resume): number {
    return [
      resume.title.trim(),
      resume.content.profile.fullName.trim() || resume.content.profile.role.trim(),
      resume.content.summary.text.trim(),
      resume.content.skills.length > 0,
      resume.content.experience.length > 0,
    ].filter(Boolean).length;
  }

  languageLabelKey(language: ResumeLanguage): string {
    return language === 'ru' ? 'resumeWorkspace.languageRu' : 'resumeWorkspace.languageEn';
  }

  formatDate(value: string): string {
    return formatLocalizedDate(value, this.i18n.dateLocale(), 'date');
  }

  createFieldInvalid(field: RequiredCreateField): boolean {
    return controlInvalid(this.createForm.controls[field], this.createFormSubmitted());
  }

  createFieldMessage(field: RequiredCreateField): string | null {
    return validationMessage(this.createForm.controls[field], this.i18n);
  }

  private buildCreatePayload(): ResumePayload {
    const value = this.createForm.getRawValue();
    return {
      title: value.title.trim(),
      language: toResumeLanguage(value.language),
      content: {
        profile: {
          fullName: value.fullName.trim(),
          role: value.role.trim(),
          location: '',
          email: '',
          phone: '',
          websiteUrl: '',
          linkedinUrl: '',
          githubUrl: '',
          telegram: '',
        },
        summary: {
          text: value.summary.trim(),
        },
        skills: [],
        experience: [],
        education: [],
        languages: [],
        certifications: [],
        additionalSections: [],
      },
    };
  }
}

function toResumeLanguage(value: string): ResumeLanguage {
  if (value === 'ru' || value === 'en') return value;
  throw new Error(`Unsupported resume language: ${value}`);
}
