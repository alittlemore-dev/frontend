import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
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
import { Observable } from 'rxjs';
import { ApiError } from '../../../../core/models/api-error.model';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ModalScrollDirective } from '../../../../core/layout/modal-scroll.directive';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ErrorMessageComponent } from '../../../../shared/ui/error-message/error-message.component';
import { LoadingSpinnerComponent } from '../../../../shared/ui/loading-spinner/loading-spinner.component';
import { AdminControlValidationStateDirective } from '../../directives/admin-control-validation-state.directive';
import { ArticleFolder } from '../../models/article-workspace.model';
import { ArticleWorkspaceService } from '../../services/article-workspace.service';
import {
  AdminUnsavedChangesService,
  AdminUnsavedChangesSource,
} from '../../services/admin-unsaved-changes.service';
import {
  ADMIN_VALIDATION_LIMITS,
  controlInvalid,
  slugValidator,
  trimRequired,
  validationMessage,
} from '../../utils/admin-validation';

type ArticleFolderCreateField = 'key' | 'nameRu' | 'nameEn';

@Component({
  selector: 'app-article-folders-page',
  standalone: true,
  imports: [
    CdkDrag,
    CdkDropList,
    ReactiveFormsModule,
    TranslatePipe,
    LoadingSpinnerComponent,
    ErrorMessageComponent,
    EmptyStateComponent,
    AdminControlValidationStateDirective,
    ModalScrollDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './article-folders-page.component.html',
  styleUrl: './article-folders-page.component.scss',
})
export class ArticleFoldersPageComponent implements OnInit {
  private readonly articlesService = inject(ArticleWorkspaceService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly unsavedChanges = inject(AdminUnsavedChangesService);

  readonly unsavedChangesScope = this.unsavedChanges.createScope(this.destroyRef);

  readonly folders = signal<ArticleFolder[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly createDialogOpen = signal(false);
  readonly createSubmitting = signal(false);
  readonly createFormSubmitted = signal(false);
  readonly createError = signal<ApiError | null>(null);
  readonly isEmpty = computed(() => !this.loading() && this.folders().length === 0);
  readonly validationLimits = ADMIN_VALIDATION_LIMITS;
  readonly createFormSnapshot = signal({ key: '', nameRu: '', nameEn: '' });
  readonly reorderPending = signal<readonly string[]>([]);
  private readonly createFormUnsavedSource: AdminUnsavedChangesSource;

  readonly createForm = this.formBuilder.group({
    key: [
      '',
      [trimRequired, Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText), slugValidator],
    ],
    nameRu: ['', [trimRequired, Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText)]],
    nameEn: ['', [trimRequired, Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText)]],
  });

  constructor() {
    this.createFormSnapshot.set(this.createForm.getRawValue());
    this.createFormUnsavedSource = this.unsavedChangesScope.registerSource(
      this.createFormSnapshot,
      this.createDialogOpen,
    );
    this.unsavedChangesScope.registerSource(this.reorderPending, signal(true));
    this.createForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.createFormSnapshot.set(this.createForm.getRawValue());
    });
  }

  ngOnInit(): void {
    this.loadFolders();
  }

  loadFolders(): void {
    this.loading.set(true);
    this.error.set(null);
    this.articlesService
      .getFolders(this.currentLanguage())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (folders) => {
          this.folders.set(folders);
          this.loading.set(false);
        },
        error: (err: ApiError) => {
          this.error.set(err);
          this.loading.set(false);
          this.notifications.error(this.i18n.translate('articles.folders.loadError'));
        },
      });
  }

  dropFolders(event: CdkDragDrop<ArticleFolder[]>): void {
    this.reorderFolders(event.previousIndex, event.currentIndex);
  }

  openCreateDialog(): void {
    this.createForm.reset({ key: '', nameRu: '', nameEn: '' });
    this.createError.set(null);
    this.createSubmitting.set(false);
    this.createFormSubmitted.set(false);
    this.createDialogOpen.set(true);
  }

  closeCreateDialog(): void {
    if (this.createSubmitting()) return;
    if (!this.unsavedChangesScope.confirmDiscard()) return;
    this.createDialogOpen.set(false);
    this.createError.set(null);
    this.createFormSubmitted.set(false);
  }

  createFolder(): void {
    this.createFormSubmitted.set(true);
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      this.notifications.error(this.i18n.translate('articles.folders.validationError'));
      return;
    }
    const language = this.currentLanguage();
    const value = this.createForm.getRawValue();
    this.createSubmitting.set(true);
    this.createError.set(null);
    this.articlesService
      .createFolder(
        {
          key: value.key.trim(),
          translations: {
            ru: { name: value.nameRu.trim() },
            en: { name: value.nameEn.trim() },
          },
        },
        language,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.createSubmitting.set(false);
          this.createDialogOpen.set(false);
          this.createFormSubmitted.set(false);
          this.createForm.reset({ key: '', nameRu: '', nameEn: '' });
          this.createFormUnsavedSource.commit();
          this.notifications.success(this.i18n.translate('articles.folders.created'));
          this.loadFolders();
        },
        error: (err: ApiError) => {
          this.createSubmitting.set(false);
          this.createError.set(err);
          this.notifications.error(this.i18n.translate('articles.folders.createError'));
        },
      });
  }

  retryCreateFolder(): void {
    this.createFolder();
  }

  createFieldInvalid(field: ArticleFolderCreateField): boolean {
    return controlInvalid(this.createForm.controls[field], this.createFormSubmitted());
  }

  createFieldMessage(field: ArticleFolderCreateField): string | null {
    return validationMessage(this.createForm.controls[field], this.i18n);
  }

  private reorderFolders(previousIndex: number, currentIndex: number): void {
    const current = this.folders();
    if (this.shouldSkipReorder(previousIndex, currentIndex, current.length)) return;
    const snapshot = current.map((folder) => ({ ...folder }));
    const next = current.map((folder) => ({ ...folder }));
    moveItemInArray(next, previousIndex, currentIndex);
    renumberPriorities(next);
    this.folders.set(next);
    this.reorderPending.set(next.map((folder) => folder.id));
    this.saveReorder(
      snapshot,
      this.articlesService.updateFolderPriorities(next.map((folder) => folder.id)),
    );
  }

  private saveReorder(snapshot: ArticleFolder[], request: Observable<void>): void {
    this.saving.set(true);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.reorderPending.set([]);
        this.saving.set(false);
        this.notifications.success(this.i18n.translate('articles.folders.saved'));
      },
      error: () => {
        this.folders.set(snapshot);
        this.reorderPending.set([]);
        this.saving.set(false);
        this.notifications.error(this.i18n.translate('articles.folders.saveError'));
        this.loadFolders();
      },
    });
  }

  private shouldSkipReorder(previousIndex: number, currentIndex: number, length: number): boolean {
    return (
      this.saving() ||
      previousIndex === currentIndex ||
      previousIndex < 0 ||
      currentIndex < 0 ||
      previousIndex >= length ||
      currentIndex >= length
    );
  }

  private currentLanguage(): 'ru' | 'en' {
    const language = this.i18n.language();
    if (language === null) {
      throw new Error('I18n language is not initialized');
    }
    return language;
  }
}

function renumberPriorities(folders: ArticleFolder[]): void {
  folders.forEach((folder, index) => {
    folder.priority = index + 1;
  });
}
