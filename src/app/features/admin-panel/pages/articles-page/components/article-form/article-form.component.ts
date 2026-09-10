import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, EMPTY, finalize, map, of, switchMap, tap, timer } from 'rxjs';
import { MarkdownEditorComponent } from '../../../../../../core/editor/markdown-editor.component';
import { I18nService } from '../../../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../../../core/i18n/translate.pipe';
import { LanguageCode } from '../../../../../../core/i18n/i18n.model';
import { MediaUploadService } from '../../../../../../core/uploads/media-upload.service';
import {
  WikiLinkTargetLookup,
  findMissingWikiLinkTargets,
} from '../../../../../../core/wiki-links/wiki-links';
import { WikiLinkTargetsService } from '../../../../../../core/wiki-links/wiki-link-targets.service';
import {
  ARTICLE_SEO_ANALYSIS_RULES,
  analyzeArticleSeo,
} from '../../../../models/article-seo-analysis';
import {
  ArticleDetail,
  ArticleFolder,
  ArticleMetadata,
  ArticlePayload,
  ArticleTag,
} from '../../../../models/article-workspace.model';
import { ArticleWorkspaceService } from '../../../../services/article-workspace.service';
import {
  AdminUnsavedChangesScope,
  AdminUnsavedChangesSource,
} from '../../../../services/admin-unsaved-changes.service';
import { slugify } from '../../../../../../shared/utils/slugify';
import { ArticleAuthoringPreviewComponent } from '../article-authoring-preview/article-authoring-preview.component';
import { ArticleFolderPickerComponent } from '../article-folder-picker/article-folder-picker.component';
import { ArticleSeoPanelComponent } from '../article-seo-panel/article-seo-panel.component';
import { AdminControlValidationStateDirective } from '../../../../directives/admin-control-validation-state.directive';
import { AdminRemoveButtonComponent } from '../../../../components/admin-remove-button/admin-remove-button.component';
import {
  ADMIN_VALIDATION_LIMITS,
  controlInvalid,
  slugValidator,
  trimRequired,
  validationMessage,
} from '../../../../utils/admin-validation';

const TAG_SEARCH_MIN_LENGTH = 2;
const TAG_SEARCH_DEBOUNCE_MS = 200;
const TAG_SEARCH_LIMIT = 10;

interface ArticleFormControls {
  titleRu: FormControl<string>;
  titleEn: FormControl<string>;
  contentRu: FormControl<string>;
  contentEn: FormControl<string>;
  slug: FormControl<string>;
  folderId: FormControl<string>;
  seoTitleRu: FormControl<string>;
  seoTitleEn: FormControl<string>;
  seoDescriptionRu: FormControl<string>;
  seoDescriptionEn: FormControl<string>;
  coverImageFileId: FormControl<string>;
  coverImageAltRu: FormControl<string>;
  coverImageAltEn: FormControl<string>;
  publishStatus: FormControl<'Draft' | 'Published'>;
}

interface ArticleMetadataFormValue {
  seoTitleRu: string;
  seoTitleEn: string;
  seoDescriptionRu: string;
  seoDescriptionEn: string;
  coverImageFileId: string;
  coverImageAltRu: string;
  coverImageAltEn: string;
}

interface ArticlePreviewState {
  title: string;
  content: string;
  tags: readonly ArticleTag[];
  coverImageUrl: string | null;
  coverImageAlt: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  language: LanguageCode;
}

interface TagSearchResult {
  tags: ArticleTag[];
  failed: boolean;
}

type ArticleField = keyof ArticleFormControls;
type ArticleFormViewMode = 'edit' | 'preview';

@Component({
  selector: 'app-admin-article-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MarkdownEditorComponent,
    TranslatePipe,
    ArticleAuthoringPreviewComponent,
    ArticleFolderPickerComponent,
    ArticleSeoPanelComponent,
    AdminControlValidationStateDirective,
    AdminRemoveButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './article-form.component.html',
  styleUrl: './article-form.component.scss',
})
export class ArticleFormComponent implements OnInit {
  private readonly articlesService = inject(ArticleWorkspaceService);
  private readonly mediaUpload = inject(MediaUploadService);
  private readonly wikiLinkTargetsService = inject(WikiLinkTargetsService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private slugEdited = false;

  readonly article = input<ArticleDetail | null>(null);
  readonly unsavedChangesScope = input.required<AdminUnsavedChangesScope>();
  readonly articleSave = output<ArticlePayload>();
  readonly formCancel = output<void>();

  readonly selectedTags = signal<readonly ArticleTag[]>([]);
  readonly tagSuggestions = signal<readonly ArticleTag[]>([]);
  readonly tagSearchLoading = signal(false);
  readonly tagSearchError = signal<string | null>(null);
  readonly tagSuggestionsOpen = signal(false);
  readonly activeTagSuggestionIndex = signal(-1);
  readonly availableWikiLinkTargets = signal<WikiLinkTargetLookup | null>(null);
  readonly selectedFolder = signal<ArticleFolder | null>(null);
  readonly activeLanguageTab = signal<LanguageCode>('ru');
  readonly viewMode = signal<ArticleFormViewMode>('edit');
  readonly previewLanguage = signal<LanguageCode>(this.currentLanguage());
  readonly previewLanguageLoading = signal(false);
  readonly previewLanguageError = signal<string | null>(null);
  readonly previewBundleVersion = signal(0);
  readonly formSubmitted = signal(false);
  readonly coverImagePreviewUrl = signal<string | null>(null);
  readonly coverImageFileName = signal('');
  readonly coverImageUploading = signal(false);
  readonly coverImageUploadError = signal<string | null>(null);
  readonly validationLimits = ADMIN_VALIDATION_LIMITS;

  readonly form = new FormGroup<ArticleFormControls>({
    titleRu: new FormControl('', {
      nonNullable: true,
      validators: [trimRequired, Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText)],
    }),
    titleEn: new FormControl('', {
      nonNullable: true,
      validators: [trimRequired, Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText)],
    }),
    contentRu: new FormControl('', {
      nonNullable: true,
      validators: [trimRequired, Validators.maxLength(ADMIN_VALIDATION_LIMITS.articleContent)],
    }),
    contentEn: new FormControl('', {
      nonNullable: true,
      validators: [trimRequired, Validators.maxLength(ADMIN_VALIDATION_LIMITS.articleContent)],
    }),
    slug: new FormControl('', {
      nonNullable: true,
      validators: [
        trimRequired,
        Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText),
        slugValidator,
      ],
    }),
    folderId: new FormControl('', {
      nonNullable: true,
      validators: [trimRequired],
    }),
    seoTitleRu: new FormControl('', {
      nonNullable: true,
      validators: Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText),
    }),
    seoTitleEn: new FormControl('', {
      nonNullable: true,
      validators: Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText),
    }),
    seoDescriptionRu: new FormControl('', {
      nonNullable: true,
      validators: Validators.maxLength(ADMIN_VALIDATION_LIMITS.seoDescription),
    }),
    seoDescriptionEn: new FormControl('', {
      nonNullable: true,
      validators: Validators.maxLength(ADMIN_VALIDATION_LIMITS.seoDescription),
    }),
    coverImageFileId: new FormControl('', {
      nonNullable: true,
    }),
    coverImageAltRu: new FormControl('', {
      nonNullable: true,
      validators: Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText),
    }),
    coverImageAltEn: new FormControl('', {
      nonNullable: true,
      validators: Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText),
    }),
    publishStatus: new FormControl<'Draft' | 'Published'>('Draft', { nonNullable: true }),
  });

  readonly tagSearchControl = new FormControl('', { nonNullable: true });
  readonly formSnapshot = signal(this.form.getRawValue());
  readonly hasCoverImage = computed(() => this.formSnapshot().coverImageFileId.trim().length > 0);
  readonly coverImageDescriptionIds = computed(() => {
    const ids = ['articleCoverImageFileStatus'];
    if (this.hasCoverImage()) ids.push('articleCoverImageReplaceHint');
    if (this.coverImageUploadError() !== null) ids.push('articleCoverImageUploadError');
    return ids.join(' ');
  });
  readonly displayedSelectedTags = computed(() =>
    this.selectedTags()
      .map((tag) => localizeTag(tag, this.activeLanguageTab()))
      .sort(compareLocalizedTags),
  );
  private mainUnsavedSource: AdminUnsavedChangesSource | null = null;
  private readonly unsavedSourceActive = signal(true);
  private readonly folderPicker = viewChild(ArticleFolderPickerComponent);
  private readonly tagSearchInput = viewChild<ElementRef<HTMLInputElement>>('tagSearchInput');
  private readonly coverImageInput = viewChild<ElementRef<HTMLInputElement>>('coverImageInput');
  private readonly coverImageButton = viewChild<ElementRef<HTMLButtonElement>>('coverImageButton');

  private readonly authoringState = computed(() => ({
    form: this.formSnapshot(),
    selectedTagIds: new Set(this.selectedTags().map((tag) => tag.id)),
  }));

  readonly seoAnalysis = computed(() => {
    const value = this.formSnapshot();
    const language = this.activeLanguageTab();
    const metadata = toMetadata(value, this.coverImagePreviewUrl());
    const folder = this.selectedFolder();
    return analyzeArticleSeo({
      input: {
        slug: value.slug,
        title: language === 'ru' ? value.titleRu : value.titleEn,
        content: language === 'ru' ? value.contentRu : value.contentEn,
        seoTitle: language === 'ru' ? metadata.seoTitleRu : metadata.seoTitleEn,
        seoDescription: language === 'ru' ? metadata.seoDescriptionRu : metadata.seoDescriptionEn,
        coverImageUrl: this.coverImagePreviewUrl(),
        coverImageAlt: language === 'ru' ? metadata.coverImageAltRu : metadata.coverImageAltEn,
        missingWikiLinkTargets: missingWikiLinkTargets({
          markdown: language === 'ru' ? value.contentRu : value.contentEn,
          availableTargets: this.availableWikiLinkTargets(),
        }),
        folder:
          folder === null
            ? ''
            : language === 'ru'
              ? folder.translations.ru.name
              : folder.translations.en.name,
        language,
        tags: this.localizedTags(language),
      },
      rules: ARTICLE_SEO_ANALYSIS_RULES,
    });
  });
  readonly activePreview = computed<ArticlePreviewState>(() => {
    const value = this.formSnapshot();
    const language = this.previewLanguage();
    const metadata = toMetadata(value, this.coverImagePreviewUrl());
    return {
      title: language === 'ru' ? value.titleRu : value.titleEn,
      content: language === 'ru' ? value.contentRu : value.contentEn,
      tags: this.localizedTags(language),
      coverImageUrl: metadata.coverImageUrl,
      coverImageAlt: language === 'ru' ? metadata.coverImageAltRu : metadata.coverImageAltEn,
      seoTitle: language === 'ru' ? metadata.seoTitleRu : metadata.seoTitleEn,
      seoDescription: language === 'ru' ? metadata.seoDescriptionRu : metadata.seoDescriptionEn,
      language,
    };
  });

  constructor() {
    effect(() => {
      this.applyArticle(this.article());
    });
  }

  ngOnInit(): void {
    this.mainUnsavedSource = this.unsavedChangesScope().registerSource(
      this.authoringState,
      this.unsavedSourceActive,
    );
    this.destroyRef.onDestroy(() => this.mainUnsavedSource?.unregister());
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.formSnapshot.set(this.form.getRawValue());
    });
    this.initializeTagSearch();
    this.loadWikiLinkTargets();
  }

  onTitleEnInput(): void {
    if (this.slugEdited) return;
    this.form.controls.slug.setValue(slugify(this.form.controls.titleEn.value));
  }

  onSlugInput(): void {
    this.slugEdited = true;
  }

  setActiveLanguageTab(language: LanguageCode): void {
    this.activeLanguageTab.set(language);
  }

  showPreview(): void {
    this.previewLanguageError.set(null);
    this.previewBundleVersion.update((version) => version + 1);
    this.viewMode.set('preview');
  }

  showEdit(): void {
    this.viewMode.set('edit');
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
          this.previewLanguageError.set(this.i18n.translate('articles.preview.languageError'));
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

  setContentRu(value: string): void {
    this.updateMarkdownContent(this.form.controls.contentRu, value);
  }

  setContentEn(value: string): void {
    this.updateMarkdownContent(this.form.controls.contentEn, value);
  }

  setPublishStatusFromEvent(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.form.controls.publishStatus.setValue(checked ? 'Draft' : 'Published');
  }

  setFolderId(folderId: string): void {
    this.form.controls.folderId.setValue(folderId);
    this.form.controls.folderId.markAsDirty();
    this.form.controls.folderId.markAsTouched();
  }

  setSelectedFolder(folder: ArticleFolder | null): void {
    this.selectedFolder.set(folder);
  }

  uploadCoverImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    const file = files?.item?.(0) ?? files?.[0];
    if (!file) return;
    this.coverImageFileName.set(file.name);
    this.coverImageUploading.set(true);
    this.coverImageUploadError.set(null);
    this.mediaUpload
      .uploadMediaFile({
        file,
        purpose: 'articleCoverImage',
        name: file.name,
        fileName: file.name,
      })
      .pipe(
        finalize(() => this.coverImageUploading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (uploadedFile) => {
          this.form.controls.coverImageFileId.setValue(uploadedFile.id);
          this.form.controls.coverImageFileId.markAsDirty();
          this.form.controls.coverImageFileId.markAsTouched();
          this.coverImagePreviewUrl.set(uploadedFile.accessUrl);
          this.formSnapshot.set(this.form.getRawValue());
        },
        error: () => {
          this.coverImageUploadError.set(
            this.i18n.translate('articles.form.coverImageUploadError'),
          );
          this.clearCoverImageSelection();
        },
      });
  }

  removeCoverImage(): void {
    if (this.coverImageUploading()) return;

    const controls = [
      this.form.controls.coverImageFileId,
      this.form.controls.coverImageAltRu,
      this.form.controls.coverImageAltEn,
    ];
    for (const control of controls) {
      control.setValue('');
      control.markAsDirty();
    }
    this.form.markAsDirty();
    this.coverImagePreviewUrl.set(null);
    this.coverImageUploadError.set(null);
    this.clearCoverImageSelection();
    this.coverImageButton()?.nativeElement.focus();
  }

  selectTag(tag: ArticleTag): void {
    if (this.selectedTags().some((selectedTag) => selectedTag.id === tag.id)) return;
    this.selectedTags.update((tags) => [...tags, tag]);
    this.clearTagSearch();
    this.tagSearchInput()?.nativeElement.focus();
  }

  removeTag(tagId: string): void {
    this.selectedTags.update((tags) => tags.filter((tag) => tag.id !== tagId));
  }

  tagName(tag: ArticleTag): string {
    return tag.translations[this.activeLanguageTab()].name;
  }

  secondaryTagName(tag: ArticleTag): string {
    const secondaryLanguage = this.activeLanguageTab() === 'ru' ? 'en' : 'ru';
    return tag.translations[secondaryLanguage].name;
  }

  onTagSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.tagSuggestionsOpen.set(false);
      this.activeTagSuggestionIndex.set(-1);
      return;
    }
    const suggestions = this.tagSuggestions();
    if (!this.tagSuggestionsOpen() || suggestions.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeTagSuggestionIndex.update((index) => (index + 1) % suggestions.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeTagSuggestionIndex.update((index) =>
        index <= 0 ? suggestions.length - 1 : index - 1,
      );
      return;
    }
    if (event.key === 'Enter') {
      const tag = suggestions[this.activeTagSuggestionIndex()];
      if (tag === undefined) return;
      event.preventDefault();
      this.selectTag(tag);
    }
  }

  activeTagSuggestionId(): string | null {
    const tag = this.tagSuggestions()[this.activeTagSuggestionIndex()];
    return tag === undefined ? null : `article-tag-suggestion-${tag.id}`;
  }

  submit(): void {
    this.formSubmitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.viewMode.set('edit');
      return;
    }
    if (
      this.article() === null &&
      this.mainUnsavedSource !== null &&
      !this.unsavedChangesScope().confirmDiscardExcept([this.mainUnsavedSource])
    ) {
      return;
    }
    const value = this.form.getRawValue();
    this.articleSave.emit({
      slug: value.slug,
      folderId: value.folderId,
      publishStatus: value.publishStatus,
      tagIds: this.selectedTags().map((tag) => tag.id),
      metadata: toPayloadMetadata(value),
      translations: {
        ru: {
          title: value.titleRu,
          content: value.contentRu,
        },
        en: {
          title: value.titleEn,
          content: value.contentEn,
        },
      },
    });
  }

  acceptSavedArticle(article: ArticleDetail): void {
    this.applyArticle(article);
    this.mainUnsavedSource?.commit();
  }

  discardAuxiliaryDrafts(): void {
    this.folderPicker()?.discardDraft();
  }

  articleFieldInvalid(field: ArticleField): boolean {
    return controlInvalid(this.form.controls[field], this.formSubmitted());
  }

  articleFieldMessage(field: ArticleField): string | null {
    return validationMessage(this.form.controls[field], this.i18n);
  }

  languageTabInvalid(language: LanguageCode): boolean {
    const fields =
      language === 'ru'
        ? ([
            'titleRu',
            'seoTitleRu',
            'seoDescriptionRu',
            'coverImageAltRu',
            'contentRu',
          ] satisfies ArticleField[])
        : ([
            'titleEn',
            'seoTitleEn',
            'seoDescriptionEn',
            'coverImageAltEn',
            'contentEn',
          ] satisfies ArticleField[]);
    return fields.some((field) => this.articleFieldInvalid(field));
  }

  private loadWikiLinkTargets(): void {
    this.wikiLinkTargetsService
      .getTargets(this.currentLanguage())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (registry) => this.availableWikiLinkTargets.set(registry.lookup),
        error: () => this.availableWikiLinkTargets.set(null),
      });
  }

  private applyArticle(article: ArticleDetail | null): void {
    untracked(() => this.clearCoverImageSelection());
    if (article === null) {
      this.slugEdited = false;
      this.form.reset({
        titleRu: '',
        titleEn: '',
        contentRu: '',
        contentEn: '',
        slug: '',
        folderId: '',
        seoTitleRu: '',
        seoTitleEn: '',
        seoDescriptionRu: '',
        seoDescriptionEn: '',
        coverImageFileId: '',
        coverImageAltRu: '',
        coverImageAltEn: '',
        publishStatus: 'Draft',
      });
      this.coverImagePreviewUrl.set(null);
      this.formSnapshot.set(this.form.getRawValue());
      this.selectedFolder.set(null);
      this.selectedTags.set([]);
      this.clearTagSearch();
      untracked(() => this.mainUnsavedSource?.commit());
      return;
    }
    this.slugEdited = true;
    this.form.setValue({
      titleRu: article.translations.ru.title,
      titleEn: article.translations.en.title,
      contentRu: article.translations.ru.content,
      contentEn: article.translations.en.content,
      slug: article.slug,
      folderId: article.folderId,
      seoTitleRu: article.metadata.seoTitleRu ?? '',
      seoTitleEn: article.metadata.seoTitleEn ?? '',
      seoDescriptionRu: article.metadata.seoDescriptionRu ?? '',
      seoDescriptionEn: article.metadata.seoDescriptionEn ?? '',
      coverImageFileId: article.metadata.coverImageFileId ?? '',
      coverImageAltRu: article.metadata.coverImageAltRu ?? '',
      coverImageAltEn: article.metadata.coverImageAltEn ?? '',
      publishStatus: article.publishStatus,
    });
    const coverImageFileId = article.metadata.coverImageFileId;
    this.coverImagePreviewUrl.set(article.metadata.coverImageUrl);
    if (article.metadata.coverImageUrl === null && coverImageFileId !== null) {
      this.mediaUpload
        .getMediaFile(coverImageFileId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (file) => {
            if (this.form.controls.coverImageFileId.value === coverImageFileId) {
              this.coverImagePreviewUrl.set(file.accessUrl);
            }
          },
          error: () => undefined,
        });
    }
    this.formSnapshot.set(this.form.getRawValue());
    this.selectedFolder.set(null);
    this.selectedTags.set(article.tags);
    this.clearTagSearch();
    untracked(() => this.mainUnsavedSource?.commit());
  }

  private clearCoverImageSelection(): void {
    this.coverImageFileName.set('');
    const input = this.coverImageInput()?.nativeElement;
    if (input !== undefined) input.value = '';
  }

  private localizedTags(language: LanguageCode): ArticleTag[] {
    return this.selectedTags()
      .map((tag) => localizeTag(tag, language))
      .sort(compareLocalizedTags);
  }

  private currentLanguage(): LanguageCode {
    const language = this.i18n.language();
    if (language === null) {
      throw new Error('I18n language is not initialized');
    }
    return language;
  }

  private updateMarkdownContent(control: FormControl<string>, value: string): void {
    control.setValue(value);
    control.markAsDirty();
    control.markAsTouched();
  }

  private initializeTagSearch(): void {
    this.tagSearchControl.valueChanges
      .pipe(
        map((query) => query.trim()),
        tap(() => this.resetTagSearchResults()),
        switchMap((query) => {
          if (query.length < TAG_SEARCH_MIN_LENGTH) return of<TagSearchResult | null>(null);
          return timer(TAG_SEARCH_DEBOUNCE_MS).pipe(
            tap(() => this.tagSearchLoading.set(true)),
            switchMap(() =>
              this.articlesService.searchTags(query, TAG_SEARCH_LIMIT, this.currentLanguage()).pipe(
                map((tags): TagSearchResult => ({ tags, failed: false })),
                catchError(() => of<TagSearchResult>({ tags: [], failed: true })),
              ),
            ),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((result) => {
        if (result === null) return;
        this.tagSearchLoading.set(false);
        if (result.failed) {
          this.tagSearchError.set(this.i18n.translate('articles.tags.searchError'));
          return;
        }
        const selectedTagIds = new Set(this.selectedTags().map((tag) => tag.id));
        const suggestions = result.tags.filter((tag) => !selectedTagIds.has(tag.id));
        this.tagSuggestions.set(suggestions);
        this.tagSuggestionsOpen.set(true);
        this.activeTagSuggestionIndex.set(suggestions.length > 0 ? 0 : -1);
      });
  }

  private clearTagSearch(): void {
    this.tagSearchControl.setValue('');
    this.resetTagSearchResults();
  }

  private resetTagSearchResults(): void {
    this.tagSearchLoading.set(false);
    this.tagSearchError.set(null);
    this.tagSuggestions.set([]);
    this.tagSuggestionsOpen.set(false);
    this.activeTagSuggestionIndex.set(-1);
  }
}

function toMetadata(
  value: ArticleMetadataFormValue,
  coverImageUrl: string | null,
): ArticleMetadata {
  return {
    seoTitleRu: optionalText(value.seoTitleRu),
    seoTitleEn: optionalText(value.seoTitleEn),
    seoDescriptionRu: optionalText(value.seoDescriptionRu),
    seoDescriptionEn: optionalText(value.seoDescriptionEn),
    coverImageFileId: optionalText(value.coverImageFileId),
    coverImageUrl,
    coverImageAltRu: optionalText(value.coverImageAltRu),
    coverImageAltEn: optionalText(value.coverImageAltEn),
  };
}

function toPayloadMetadata(value: ArticleMetadataFormValue): ArticlePayload['metadata'] {
  return {
    seoTitleRu: optionalText(value.seoTitleRu),
    seoTitleEn: optionalText(value.seoTitleEn),
    seoDescriptionRu: optionalText(value.seoDescriptionRu),
    seoDescriptionEn: optionalText(value.seoDescriptionEn),
    coverImageFileId: optionalText(value.coverImageFileId),
    coverImageAltRu: optionalText(value.coverImageAltRu),
    coverImageAltEn: optionalText(value.coverImageAltEn),
  };
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function localizeTag(tag: ArticleTag, language: LanguageCode): ArticleTag {
  return {
    ...tag,
    name: tag.translations[language].name,
  };
}

function missingWikiLinkTargets(params: {
  markdown: string;
  availableTargets: WikiLinkTargetLookup | null;
}): string[] {
  if (params.availableTargets === null) return [];
  return findMissingWikiLinkTargets({
    markdown: params.markdown,
    availableTargets: params.availableTargets,
  });
}

function compareLocalizedTags(a: ArticleTag, b: ArticleTag): number {
  return a.name.localeCompare(b.name, 'ru');
}
