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
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { Observable, Subject, debounceTime, finalize } from 'rxjs';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { LanguageCode } from '../../../../core/i18n/i18n.model';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ModalScrollDirective } from '../../../../core/layout/modal-scroll.directive';
import { ApiError } from '../../../../core/models/api-error.model';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorMessageComponent } from '../../../../shared/ui/error-message/error-message.component';
import { LoadingSpinnerComponent } from '../../../../shared/ui/loading-spinner/loading-spinner.component';
import { slugify } from '../../../../shared/utils/slugify';
import {
  AdminAction,
  AdminActionsDropdownComponent,
} from '../../components/admin-actions-dropdown/admin-actions-dropdown.component';
import { AdminControlValidationStateDirective } from '../../directives/admin-control-validation-state.directive';
import { ArticleTag } from '../../models/article-workspace.model';
import {
  AdminUnsavedChangesService,
  AdminUnsavedChangesSource,
} from '../../services/admin-unsaved-changes.service';
import { ArticleWorkspaceService } from '../../services/article-workspace.service';
import {
  ADMIN_VALIDATION_LIMITS,
  controlInvalid,
  slugValidator,
  trimRequired,
  validationMessage,
} from '../../utils/admin-validation';
import {
  canonicalQueryMatches,
  queryString,
  readOptionalStringQuery,
  replaceAdminQueryParams,
} from '../../utils/admin-query-state';

const ARTICLE_TAG_QUERY_KEYS = ['q'] as const;
const SEARCH_QUERY_DEBOUNCE_MS = 250;

type ArticleTagFormField = keyof ArticleTagFormControls;

interface ArticleTagFormControls {
  nameRu: FormControl<string>;
  nameEn: FormControl<string>;
  slug: FormControl<string>;
}

@Component({
  selector: 'app-article-tags-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    LoadingSpinnerComponent,
    ErrorMessageComponent,
    EmptyStateComponent,
    AdminActionsDropdownComponent,
    AdminControlValidationStateDirective,
    ModalScrollDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './article-tags-page.component.html',
  styleUrl: './article-tags-page.component.scss',
})
export class ArticleTagsPageComponent implements OnInit {
  private readonly articlesService = inject(ArticleWorkspaceService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly unsavedChanges = inject(AdminUnsavedChangesService);
  private readonly searchQueryChanges = new Subject<string>();
  private currentQueryParams: ParamMap | null = null;
  private slugEdited = false;

  readonly unsavedChangesScope = this.unsavedChanges.createScope(this.destroyRef);
  readonly tags = signal<readonly ArticleTag[]>([]);
  readonly searchQuery = signal('');
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly dialogOpen = signal(false);
  readonly editingTag = signal<ArticleTag | null>(null);
  readonly submitting = signal(false);
  readonly formSubmitted = signal(false);
  readonly formError = signal<ApiError | null>(null);
  readonly duplicateSlug = signal(false);
  readonly validationLimits = ADMIN_VALIDATION_LIMITS;

  readonly filteredTags = computed(() => {
    const query = this.searchQuery().trim().toLocaleLowerCase();
    return this.tags().filter((tag) => {
      if (query === '') return true;
      return [tag.translations.ru.name, tag.translations.en.name, tag.slug].some((value) =>
        value.toLocaleLowerCase().includes(query),
      );
    });
  });

  readonly form = new FormGroup<ArticleTagFormControls>({
    nameRu: new FormControl('', {
      nonNullable: true,
      validators: [trimRequired, Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText)],
    }),
    nameEn: new FormControl('', {
      nonNullable: true,
      validators: [trimRequired, Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText)],
    }),
    slug: new FormControl('', {
      nonNullable: true,
      validators: [
        trimRequired,
        Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText),
        slugValidator,
      ],
    }),
  });
  readonly formSnapshot = signal(this.form.getRawValue());
  private readonly formUnsavedSource: AdminUnsavedChangesSource;

  constructor() {
    this.formUnsavedSource = this.unsavedChangesScope.registerSource(
      this.formSnapshot,
      this.dialogOpen,
    );
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.formSnapshot.set(this.form.getRawValue());
      this.duplicateSlug.set(false);
      this.formError.set(null);
    });
  }

  ngOnInit(): void {
    this.setupQueryState();
    this.loadTags();
  }

  loadTags(): void {
    this.loading.set(true);
    this.error.set(null);
    this.articlesService
      .getTags(this.currentLanguage())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tags) => {
          this.tags.set(tags);
          this.loading.set(false);
        },
        error: (error: ApiError) => {
          this.error.set(error);
          this.loading.set(false);
          this.notifications.error(this.i18n.translate('articles.tags.loadError'));
        },
      });
  }

  setSearchQuery(value: string): void {
    this.searchQuery.set(value);
    this.searchQueryChanges.next(value);
  }

  private setupQueryState(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.currentQueryParams = params;
      const searchQuery = readOptionalStringQuery(params, 'q').value ?? '';
      this.searchQuery.set(searchQuery);
      const canonical = { q: queryString(searchQuery) };
      if (!canonicalQueryMatches(params, ARTICLE_TAG_QUERY_KEYS, canonical)) {
        void replaceAdminQueryParams(this.router, this.route, canonical);
      }
    });
    this.searchQueryChanges
      .pipe(debounceTime(SEARCH_QUERY_DEBOUNCE_MS), takeUntilDestroyed(this.destroyRef))
      .subscribe((searchQuery) => {
        const canonical = { q: queryString(searchQuery) };
        if (
          this.currentQueryParams === null ||
          !canonicalQueryMatches(this.currentQueryParams, ARTICLE_TAG_QUERY_KEYS, canonical)
        ) {
          void replaceAdminQueryParams(this.router, this.route, canonical);
        }
      });
  }

  openCreate(): void {
    this.editingTag.set(null);
    this.slugEdited = false;
    this.resetForm({ nameRu: '', nameEn: '', slug: '' });
    this.formUnsavedSource.commit();
    this.dialogOpen.set(true);
  }

  openEdit(tag: ArticleTag): void {
    this.editingTag.set(tag);
    this.slugEdited = true;
    this.resetForm({
      nameRu: tag.translations.ru.name,
      nameEn: tag.translations.en.name,
      slug: tag.slug,
    });
    this.formUnsavedSource.commit();
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    if (this.submitting()) return;
    if (!this.unsavedChangesScope.confirmDiscard()) return;
    this.dialogOpen.set(false);
    this.formError.set(null);
    this.formSubmitted.set(false);
  }

  onNameEnInput(): void {
    if (this.editingTag() !== null || this.slugEdited) return;
    this.form.controls.slug.setValue(slugify(this.form.controls.nameEn.value));
  }

  onSlugInput(): void {
    this.slugEdited = true;
  }

  saveTag(): void {
    this.formSubmitted.set(true);
    const value = this.form.getRawValue();
    this.duplicateSlug.set(this.slugExists(value.slug.trim()));
    if (this.form.invalid || this.duplicateSlug()) {
      this.form.markAllAsTouched();
      this.notifications.error(this.i18n.translate('articles.tags.validationError'));
      return;
    }
    const payload = {
      slug: value.slug.trim(),
      translations: {
        ru: { name: value.nameRu.trim() },
        en: { name: value.nameEn.trim() },
      },
    };
    const editingTag = this.editingTag();
    const request: Observable<ArticleTag> =
      editingTag === null
        ? this.articlesService.createTag(payload, this.currentLanguage())
        : this.articlesService.updateTag(editingTag.id, payload, this.currentLanguage());
    this.submitting.set(true);
    this.formError.set(null);
    request
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          const successKey = editingTag === null ? 'articles.tags.created' : 'articles.tags.saved';
          this.dialogOpen.set(false);
          this.resetForm({ nameRu: '', nameEn: '', slug: '' });
          this.formUnsavedSource.commit();
          this.notifications.success(this.i18n.translate(successKey));
          this.loadTags();
        },
        error: (error: ApiError) => {
          this.formError.set(error);
          const errorKey =
            editingTag === null ? 'articles.tags.createError' : 'articles.tags.saveError';
          this.notifications.error(this.i18n.translate(errorKey));
        },
      });
  }

  deleteTag(tag: ArticleTag): void {
    if (
      this.document.defaultView?.confirm(this.i18n.translate('articles.tags.confirmDelete')) !==
      true
    ) {
      return;
    }
    this.articlesService
      .deleteTag(tag.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notifications.success(this.i18n.translate('articles.tags.deleted'));
          this.loadTags();
        },
        error: () => this.notifications.error(this.i18n.translate('articles.tags.deleteError')),
      });
  }

  tagActions(): AdminAction[] {
    return [
      {
        id: 'edit',
        label: this.i18n.translate('shared.edit'),
        destructive: false,
        disabled: false,
      },
      {
        id: 'delete',
        label: this.i18n.translate('shared.delete'),
        destructive: true,
        disabled: false,
      },
    ];
  }

  handleTagAction(actionId: string, tag: ArticleTag): void {
    if (actionId === 'edit') {
      this.openEdit(tag);
      return;
    }
    if (actionId === 'delete') {
      this.deleteTag(tag);
      return;
    }
    throw new Error(`Unsupported article tag action: ${actionId}`);
  }

  fieldInvalid(field: ArticleTagFormField): boolean {
    if (field === 'slug' && this.duplicateSlug()) return true;
    return controlInvalid(this.form.controls[field], this.formSubmitted());
  }

  fieldMessage(field: ArticleTagFormField): string | null {
    if (field === 'slug' && this.duplicateSlug()) {
      return this.i18n.translate('articles.tags.duplicateSlug');
    }
    return validationMessage(this.form.controls[field], this.i18n);
  }

  private slugExists(slug: string): boolean {
    const editingTagId = this.editingTag()?.id;
    return this.tags().some((tag) => tag.id !== editingTagId && tag.slug === slug);
  }

  private resetForm(value: { nameRu: string; nameEn: string; slug: string }): void {
    this.form.reset(value);
    this.formSnapshot.set(this.form.getRawValue());
    this.formSubmitted.set(false);
    this.formError.set(null);
    this.duplicateSlug.set(false);
  }

  private currentLanguage(): LanguageCode {
    const language = this.i18n.language();
    if (language === null) throw new Error('I18n language is not initialized');
    return language;
  }
}
