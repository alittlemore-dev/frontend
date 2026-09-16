import {
  NotificationService,
  EmptyStateComponent,
  ErrorMessageComponent,
  LoadingSpinnerComponent,
  SiteSelectComponent,
  SiteSelectOption,
  formatLocalizedDate,
  ControlValidationStateDirective,
} from '@alittlemore.dev/design-system';
import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError } from '../../../../../../core/models/api-error.model';
import { I18nService } from '../../../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../../../core/i18n/translate.pipe';

import {
  DropdownAction,
  ActionsDropdownComponent,
} from '../../../../components/actions-dropdown/actions-dropdown.component';

import {
  UnsavedChangesService,
  UnsavedChangesSource,
} from '../../../../../../core/unsaved-changes/unsaved-changes.service';
import {
  VALIDATION_LIMITS,
  controlInvalid,
  trimRequired,
  validationMessage,
} from '../../../../utils/validation';
import { formatFileSize } from '../../../shared/file-size';
import {
  KnowledgeTag,
  PeopleListFilters,
  PeoplePage,
  PersonBirthday,
  PersonListSort,
  PersonSummary,
} from '../../models/people.model';
import { PeopleService } from '../../services/people.service';

const SORTS: readonly PersonListSort[] = ['updatedNewest', 'updatedOldest', 'nameAsc', 'nameDesc'];
const PAGE_SIZES = [20, 50, 100] as const;

@Component({
  selector: 'app-people-list',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TranslatePipe,
    EmptyStateComponent,
    ErrorMessageComponent,
    LoadingSpinnerComponent,
    SiteSelectComponent,
    ActionsDropdownComponent,
    ControlValidationStateDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './people-list.component.html',
  styleUrl: './people-list.component.scss',
})
export class PeopleListComponent implements OnInit, OnDestroy {
  private readonly peopleService = inject(PeopleService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly unsavedScope = inject(UnsavedChangesService).createScope(this.destroyRef);
  private readonly createUnsavedSource: UnsavedChangesSource;
  private readonly tagDraftUnsavedSource: UnsavedChangesSource;
  private peopleLoadGeneration = 0;
  private photoLoadGeneration = 0;

  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly page = signal<PeoplePage | null>(null);
  readonly currentPage = signal(1);
  readonly tags = signal<readonly KnowledgeTag[]>([]);
  readonly tagError = signal<ApiError | null>(null);
  readonly selectedTagIds = signal<readonly string[]>([]);
  readonly photoUrls = signal<Readonly<Record<string, string>>>({});
  readonly createDialogOpen = signal(false);
  readonly createSubmitting = signal(false);
  readonly createSubmitted = signal(false);
  readonly createError = signal<ApiError | null>(null);
  readonly tagDialogOpen = signal(false);
  readonly tagSubmitting = signal(false);
  readonly tagDraft = signal('');
  readonly tagEditingId = signal<string | null>(null);
  readonly deletePendingId = signal<string | null>(null);
  readonly createSnapshot = signal({ firstName: '', lastName: '' });

  readonly filtersForm = this.formBuilder.group({
    searchQuery: [''],
    sort: this.formBuilder.control<PersonListSort>('updatedNewest', {
      validators: Validators.required,
    }),
    pageSize: this.formBuilder.control<'20' | '50' | '100'>('20', {
      validators: Validators.required,
    }),
  });
  readonly createForm = this.formBuilder.group({
    firstName: ['', [trimRequired, Validators.maxLength(VALIDATION_LIMITS.shortText)]],
    lastName: ['', [trimRequired, Validators.maxLength(VALIDATION_LIMITS.shortText)]],
  });
  readonly sortOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return SORTS.map((sort) => ({
      value: sort,
      label: this.i18n.translate(`knowledgePeople.sort.${sort}`),
    }));
  });
  readonly pageSizeOptions: readonly SiteSelectOption[] = PAGE_SIZES.map((size) => ({
    value: String(size),
    label: String(size),
  }));
  readonly canPrevious = computed(() => this.currentPage() > 1);
  readonly canNext = computed(() => this.currentPage() < (this.page()?.totalPages ?? 1));
  readonly validationLimits = VALIDATION_LIMITS;

  constructor() {
    this.createUnsavedSource = this.unsavedScope.registerSource(
      this.createSnapshot,
      this.createDialogOpen,
    );
    this.tagDraftUnsavedSource = this.unsavedScope.registerSource(
      this.tagDraft,
      this.tagDialogOpen,
    );
    this.createForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.createSnapshot.set(this.createForm.getRawValue());
    });
  }

  ngOnInit(): void {
    this.loadTags();
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const page = positiveInteger(params.get('page'), 1);
      const pageSize = pageSizeValue(params.get('pageSize'));
      const sort = sortValue(params.get('sort'));
      const searchQuery = params.get('q')?.trim() ?? '';
      const tagIds = unique(params.getAll('tagIds').filter((value) => value.trim() !== ''));
      this.currentPage.set(page);
      this.selectedTagIds.set(tagIds);
      this.filtersForm.setValue(
        { searchQuery, sort, pageSize: String(pageSize) as '20' | '50' | '100' },
        { emitEvent: false },
      );
      this.loadPeople();
    });
  }

  ngOnDestroy(): void {
    this.revokePhotoUrls();
  }

  loadPeople(): void {
    const generation = ++this.peopleLoadGeneration;
    this.loading.set(true);
    this.error.set(null);
    const filters = this.appliedFilters();
    this.peopleService
      .listPeople(filters)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          if (generation !== this.peopleLoadGeneration) {
            return;
          }
          if (filters.page > Math.max(1, page.totalPages)) {
            this.goToPage(Math.max(1, page.totalPages));
            return;
          }
          this.page.set(page);
          this.loading.set(false);
          this.loadPhotoUrls(page);
        },
        error: (error: ApiError) => {
          if (generation !== this.peopleLoadGeneration) {
            return;
          }
          this.error.set(error);
          this.loading.set(false);
          this.notifications.error(this.i18n.translate('knowledgePeople.loadError'));
        },
      });
  }

  loadTags(): void {
    this.tagError.set(null);
    this.peopleService
      .listTags('')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tags) => this.tags.set(tags),
        error: (error: ApiError) => {
          this.tagError.set(error);
          this.notifications.error(this.i18n.translate('knowledgePeople.tags.loadError'));
        },
      });
  }

  applyFilters(): void {
    const raw = this.filtersForm.getRawValue();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: raw.searchQuery.trim() || null,
        sort: raw.sort === 'updatedNewest' ? null : raw.sort,
        pageSize: raw.pageSize === '20' ? null : raw.pageSize,
        tagIds: this.selectedTagIds().length > 0 ? this.selectedTagIds() : null,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  resetFilters(): void {
    this.selectedTagIds.set([]);
    this.filtersForm.setValue(
      { searchQuery: '', sort: 'updatedNewest', pageSize: '20' },
      { emitEvent: false },
    );
    this.applyFilters();
  }

  toggleTag(tagId: string): void {
    this.selectedTagIds.update((ids) =>
      ids.includes(tagId) ? ids.filter((id) => id !== tagId) : [...ids, tagId],
    );
  }

  goToPage(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page === 1 ? null : page },
      queryParamsHandling: 'merge',
    });
  }

  openCreateDialog(): void {
    this.createForm.reset({ firstName: '', lastName: '' });
    this.createSnapshot.set(this.createForm.getRawValue());
    this.createUnsavedSource.commit();
    this.createSubmitted.set(false);
    this.createError.set(null);
    this.createDialogOpen.set(true);
  }

  closeCreateDialog(): void {
    if (this.createSubmitting() || !this.unsavedScope.confirmDiscard()) {
      return;
    }
    this.createDialogOpen.set(false);
  }

  createPerson(): void {
    this.createSubmitted.set(true);
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      this.notifications.error(this.i18n.translate('knowledgePeople.validationError'));
      return;
    }
    this.createSubmitting.set(true);
    const value = this.createForm.getRawValue();
    this.peopleService
      .createPerson({ firstName: value.firstName.trim(), lastName: value.lastName.trim() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (person) => {
          this.createSubmitting.set(false);
          this.createUnsavedSource.commit();
          this.createDialogOpen.set(false);
          this.notifications.success(this.i18n.translate('knowledgePeople.createSuccess'));
          void this.router.navigate(['/personal-workspace/knowledge/people', person.id], {
            queryParamsHandling: 'preserve',
          });
        },
        error: (error: ApiError) => {
          this.createError.set(error);
          this.createSubmitting.set(false);
          this.notifications.error(this.i18n.translate('knowledgePeople.createError'));
        },
      });
  }

  deletePerson(personId: string, displayName: string): void {
    const browserWindow = this.document.defaultView;
    if (
      browserWindow === null ||
      !browserWindow.confirm(
        this.i18n.translate('knowledgePeople.deleteConfirm', { name: displayName }),
      )
    ) {
      return;
    }
    this.deletePendingId.set(personId);
    this.peopleService
      .deletePerson(personId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deletePendingId.set(null);
          this.notifications.success(this.i18n.translate('knowledgePeople.deleteSuccess'));
          this.loadPeople();
        },
        error: () => {
          this.deletePendingId.set(null);
          this.notifications.error(this.i18n.translate('knowledgePeople.deleteError'));
        },
      });
  }

  personActions(person: PersonSummary): DropdownAction[] {
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
        disabled: this.deletePendingId() === person.id,
      },
    ];
  }

  handlePersonAction(actionId: string, person: PersonSummary): void {
    switch (actionId) {
      case 'edit':
        void this.router.navigate(['/personal-workspace/knowledge/people', person.id], {
          queryParamsHandling: 'preserve',
        });
        return;
      case 'delete':
        this.deletePerson(person.id, person.displayName);
        return;
      default:
        throw new Error(`Unsupported People list action: ${actionId}`);
    }
  }

  openTagDialog(): void {
    this.tagEditingId.set(null);
    this.tagDraft.set('');
    this.tagDraftUnsavedSource.commit();
    this.tagDialogOpen.set(true);
  }

  closeTagDialog(): void {
    if (this.tagSubmitting() || !this.unsavedScope.confirmDiscard()) {
      return;
    }
    this.tagDialogOpen.set(false);
  }

  editTag(tag: KnowledgeTag): void {
    this.tagEditingId.set(tag.id);
    this.tagDraft.set(tag.name);
    this.tagDraftUnsavedSource.commit();
  }

  saveTag(): void {
    const name = this.tagDraft().trim();
    if (name === '') {
      this.notifications.error(this.i18n.translate('knowledgePeople.tags.nameRequired'));
      return;
    }
    this.tagSubmitting.set(true);
    const request =
      this.tagEditingId() === null
        ? this.peopleService.createTag(name)
        : this.peopleService.updateTag(this.tagEditingId()!, name);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.tagSubmitting.set(false);
        this.tagDraft.set('');
        this.tagEditingId.set(null);
        this.tagDraftUnsavedSource.commit();
        this.notifications.success(this.i18n.translate('knowledgePeople.tags.saveSuccess'));
        this.loadTags();
      },
      error: () => {
        this.tagSubmitting.set(false);
        this.notifications.error(this.i18n.translate('knowledgePeople.tags.saveError'));
      },
    });
  }

  deleteTag(tag: KnowledgeTag): void {
    const browserWindow = this.document.defaultView;
    if (
      browserWindow === null ||
      !browserWindow.confirm(
        this.i18n.translate('knowledgePeople.tags.deleteConfirm', { name: tag.name }),
      )
    ) {
      return;
    }
    this.peopleService
      .deleteTag(tag.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.selectedTagIds.update((ids) => ids.filter((id) => id !== tag.id));
          this.notifications.success(this.i18n.translate('knowledgePeople.tags.deleteSuccess'));
          this.loadTags();
        },
        error: () =>
          this.notifications.error(this.i18n.translate('knowledgePeople.tags.deleteConflict')),
      });
  }

  createFieldInvalid(field: 'firstName' | 'lastName'): boolean {
    return controlInvalid(this.createForm.controls[field], this.createSubmitted());
  }

  createFieldMessage(field: 'firstName' | 'lastName'): string | null {
    return validationMessage(this.createForm.controls[field], this.i18n);
  }

  formatDate(value: string): string {
    return formatLocalizedDate(value, this.i18n.dateLocale(), 'dateTime');
  }

  birthdayLabel(birthday: PersonBirthday | null): string {
    if (birthday === null) {
      return this.i18n.translate('shared.notSet');
    }
    const year = birthday.year === null ? '' : `.${birthday.year}`;
    return `${String(birthday.day).padStart(2, '0')}.${String(birthday.month).padStart(2, '0')}${year}`;
  }

  fileSize(sizeBytes: number): string {
    return formatFileSize(sizeBytes, this.i18n.dateLocale());
  }

  onTagDraftInput(event: Event): void {
    const target = event.currentTarget;
    if (target instanceof HTMLInputElement) {
      this.tagDraft.set(target.value);
    }
  }

  private appliedFilters(): PeopleListFilters {
    const raw = this.filtersForm.getRawValue();
    return {
      page: this.currentPage(),
      pageSize: Number(raw.pageSize) as 20 | 50 | 100,
      sort: raw.sort,
      searchQuery: raw.searchQuery,
      tagIds: this.selectedTagIds(),
    };
  }

  private loadPhotoUrls(page: PeoplePage): void {
    const browserUrl = this.document.defaultView?.URL;
    this.revokePhotoUrls();
    const generation = ++this.photoLoadGeneration;
    if (browserUrl === undefined) {
      return;
    }
    for (const person of page.people) {
      if (person.photo === null) {
        continue;
      }
      this.peopleService
        .getFileContent(person.photo.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (blob) => {
            if (generation !== this.photoLoadGeneration) {
              return;
            }
            const url = browserUrl.createObjectURL(blob);
            this.photoUrls.update((urls) => ({ ...urls, [person.id]: url }));
          },
        });
    }
  }

  private revokePhotoUrls(): void {
    this.photoLoadGeneration += 1;
    const browserUrl = this.document.defaultView?.URL;
    if (browserUrl !== undefined) {
      for (const url of Object.values(this.photoUrls())) {
        browserUrl.revokeObjectURL(url);
      }
    }
    this.photoUrls.set({});
  }
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function positiveInteger(value: string | null, fallback: number): number {
  if (value === null || !/^\d+$/.test(value)) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function pageSizeValue(value: string | null): 20 | 50 | 100 {
  return value === '50' || value === '100' ? (Number(value) as 50 | 100) : 20;
}

function sortValue(value: string | null): PersonListSort {
  return SORTS.includes(value as PersonListSort) ? (value as PersonListSort) : 'updatedNewest';
}
