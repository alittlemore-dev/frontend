import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';
import { LanguageCode } from '../../../../../../core/i18n/i18n.model';
import { I18nService } from '../../../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../../../core/i18n/translate.pipe';
import { AdminControlValidationStateDirective } from '../../../../directives/admin-control-validation-state.directive';
import { ArticleFolder } from '../../../../models/article-workspace.model';
import { ArticleWorkspaceService } from '../../../../services/article-workspace.service';
import {
  AdminUnsavedChangesScope,
  AdminUnsavedChangesSource,
} from '../../../../services/admin-unsaved-changes.service';
import {
  ADMIN_VALIDATION_LIMITS,
  slugValidator,
  trimRequired,
  validationMessage,
} from '../../../../utils/admin-validation';
import {
  SiteSelectComponent,
  SiteSelectOption,
} from '../../../../../../shared/ui/site-select/site-select.component';

@Component({
  selector: 'app-article-folder-picker',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    AdminControlValidationStateDirective,
    SiteSelectComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './article-folder-picker.component.html',
})
export class ArticleFolderPickerComponent implements OnInit, OnChanges {
  private readonly articlesService = inject(ArticleWorkspaceService);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) language!: LanguageCode;
  @Input({ required: true }) selectedFolderId!: string;
  @Input({ required: true }) unsavedChangesScope!: AdminUnsavedChangesScope;
  @Input() disabled = false;
  @Input() invalid = false;

  @Output() readonly selectedFolderIdChange = new EventEmitter<string>();
  @Output() readonly selectedFolderChange = new EventEmitter<ArticleFolder | null>();

  readonly folders = signal<ArticleFolder[]>([]);
  readonly loading = signal(false);
  readonly creating = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly validationLimits = ADMIN_VALIDATION_LIMITS;
  readonly folderSelectOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return [
      { value: '', label: this.i18n.translate('shared.notSet') },
      ...this.folders().map((folder) => ({ value: folder.id, label: folder.name })),
    ];
  });

  readonly createForm = this.formBuilder.group({
    key: [
      '',
      [trimRequired, Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText), slugValidator],
    ],
    nameRu: ['', [trimRequired, Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText)]],
    nameEn: ['', [trimRequired, Validators.maxLength(ADMIN_VALIDATION_LIMITS.shortText)]],
  });
  readonly createFormSnapshot = signal(this.createForm.getRawValue());
  private createFormUnsavedSource: AdminUnsavedChangesSource | null = null;
  private readonly unsavedSourceActive = signal(true);

  ngOnInit(): void {
    this.createFormUnsavedSource = this.unsavedChangesScope.registerSource(
      this.createFormSnapshot,
      this.unsavedSourceActive,
    );
    this.destroyRef.onDestroy(() => this.createFormUnsavedSource?.unregister());
    this.createForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.createFormSnapshot.set(this.createForm.getRawValue());
    });
    this.loadFolders();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['language'] && !changes['language'].firstChange) {
      this.loadFolders();
      return;
    }
    if (changes['selectedFolderId'] && !changes['selectedFolderId'].firstChange) {
      this.emitSelectedFolder();
    }
  }

  onFolderChange(value: string): void {
    this.selectedFolderIdChange.emit(value);
    this.selectedFolderChange.emit(this.folderById(value));
  }

  controlInvalid(control: AbstractControl<unknown>): boolean {
    return control.invalid && control.touched;
  }

  controlMessage(control: AbstractControl<unknown>): string | null {
    return validationMessage(control, this.i18n);
  }

  createFolder(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    const value = this.createForm.getRawValue();
    this.creating.set(true);
    this.errorKey.set(null);
    this.articlesService
      .createFolder(
        {
          key: value.key.trim(),
          translations: {
            ru: { name: value.nameRu.trim() },
            en: { name: value.nameEn.trim() },
          },
        },
        this.language,
      )
      .pipe(
        finalize(() => this.creating.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (folder) => {
          this.folders.update((folders) => [...folders, folder].sort(compareFolders));
          this.selectedFolderIdChange.emit(folder.id);
          this.selectedFolderChange.emit(folder);
          this.createForm.reset();
          this.createFormUnsavedSource?.commit();
        },
        error: () => this.errorKey.set('articles.folders.createError'),
      });
  }

  discardDraft(): void {
    this.createForm.reset();
    this.createFormUnsavedSource?.commit();
  }

  private loadFolders(): void {
    this.loading.set(true);
    this.errorKey.set(null);
    this.articlesService
      .getFolders(this.language)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (folders) => {
          this.folders.set(folders);
          this.emitSelectedFolder();
        },
        error: () => this.errorKey.set('articles.folders.loadError'),
      });
  }

  private emitSelectedFolder(): void {
    this.selectedFolderChange.emit(this.folderById(this.selectedFolderId));
  }

  private folderById(folderId: string): ArticleFolder | null {
    return this.folders().find((folder) => folder.id === folderId) ?? null;
  }
}

function compareFolders(first: ArticleFolder, second: ArticleFolder): number {
  return first.priority - second.priority || first.name.localeCompare(second.name, 'ru');
}
