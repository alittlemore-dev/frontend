import {
  NotificationService,
  EmptyStateComponent,
  ErrorMessageComponent,
  LoadingSpinnerComponent,
  SiteSelectComponent,
  SiteSelectOption,
  formatLocalizedDate,
} from '@alittlemore.dev/design-system';
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
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { I18nService } from '../../../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../../../core/i18n/translate.pipe';
import { ApiError } from '../../../../../../core/models/api-error.model';

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
import { KnowledgeTag, PersonSummary } from '../../../people/models/people.model';
import { PeopleService } from '../../../people/services/people.service';
import { annualDateValidator, formatAnnualDate } from '../../../shared/annual-date';
import {
  KnowledgeDateListFilters,
  KnowledgeDateListSort,
  KnowledgeDatesPage,
  KnowledgeDateSummary,
} from '../../models/dates.model';
import { KnowledgeDatesService } from '../../services/dates.service';

const SORTS: readonly KnowledgeDateListSort[] = [
  'dateAsc',
  'dateDesc',
  'updatedNewest',
  'updatedOldest',
  'nameAsc',
  'nameDesc',
];
const PAGE_SIZES = [20, 50, 100] as const;
const RELATED_PEOPLE_PREVIEW_LIMIT = 10;

@Component({
  selector: 'app-dates-list',
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dates-list.component.html',
  styleUrl: './dates-list.component.scss',
})
export class DatesListComponent implements OnInit {
  private readonly datesService = inject(KnowledgeDatesService);
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
  private datesLoadGeneration = 0;
  private peopleLoadGeneration = 0;

  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly page = signal<KnowledgeDatesPage | null>(null);
  readonly currentPage = signal(1);
  readonly tags = signal<readonly KnowledgeTag[]>([]);
  readonly selectedTagIds = signal<readonly string[]>([]);
  readonly personCandidates = signal<readonly PersonSummary[]>([]);
  readonly createDialogOpen = signal(false);
  readonly createSubmitting = signal(false);
  readonly createSubmitted = signal(false);
  readonly createError = signal<ApiError | null>(null);
  readonly deletePendingId = signal<string | null>(null);
  readonly expandedRelatedPeopleDateIds = signal<ReadonlySet<string>>(new Set());
  readonly createSnapshot = signal({
    displayName: '',
    date: { day: '', month: '', year: '' },
  });

  readonly filtersForm = this.formBuilder.group({
    searchQuery: [''],
    sort: this.formBuilder.control<KnowledgeDateListSort>('dateAsc', {
      validators: Validators.required,
    }),
    pageSize: this.formBuilder.control<'20' | '50' | '100'>('20', {
      validators: Validators.required,
    }),
    relatedPersonId: [''],
  });
  readonly createForm = this.formBuilder.group({
    displayName: ['', [trimRequired, Validators.maxLength(VALIDATION_LIMITS.shortText)]],
    date: this.formBuilder.group(
      {
        day: [''],
        month: [''],
        year: [''],
      },
      { validators: annualDateValidator },
    ),
  });
  readonly sortOptions = computed<readonly SiteSelectOption[]>(() => {
    this.i18n.language();
    return SORTS.map((sort) => ({
      value: sort,
      label: this.i18n.translate(`knowledgeDates.sort.${sort}`),
    }));
  });
  readonly pageSizeOptions: readonly SiteSelectOption[] = PAGE_SIZES.map((size) => ({
    value: String(size),
    label: String(size),
  }));
  readonly dayOptions: readonly SiteSelectOption[] = Array.from({ length: 31 }, (_, index) => ({
    value: String(index + 1),
    label: String(index + 1),
  }));
  readonly monthOptions = computed<readonly SiteSelectOption[]>(() => {
    const locale = this.i18n.dateLocale();
    return Array.from({ length: 12 }, (_, index) => ({
      value: String(index + 1),
      label: new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(
        new Date(Date.UTC(2000, index, 1)),
      ),
    }));
  });
  readonly personOptions = computed<readonly SiteSelectOption[]>(() => [
    { value: '', label: this.i18n.translate('shared.notSet') },
    ...this.personCandidates().map((person) => ({
      value: person.id,
      label: person.displayName,
    })),
  ]);
  readonly canPrevious = computed(() => this.currentPage() > 1);
  readonly canNext = computed(() => this.currentPage() < (this.page()?.totalPages ?? 1));
  readonly validationLimits = VALIDATION_LIMITS;

  constructor() {
    this.createUnsavedSource = this.unsavedScope.registerSource(
      this.createSnapshot,
      this.createDialogOpen,
    );
    this.createForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.createSnapshot.set(this.createForm.getRawValue());
    });
  }

  ngOnInit(): void {
    this.loadTags();
    this.searchPeople('');
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const page = positiveInteger(params.get('page'), 1);
      const pageSize = pageSizeValue(params.get('pageSize'));
      const sort = sortValue(params.get('sort'));
      const searchQuery = params.get('q')?.trim() ?? '';
      const tagIds = unique(params.getAll('tagIds').filter((value) => value.trim() !== ''));
      const relatedPersonId = params.get('relatedPersonId')?.trim() ?? '';
      this.currentPage.set(page);
      this.selectedTagIds.set(tagIds);
      this.filtersForm.setValue(
        {
          searchQuery,
          sort,
          pageSize: String(pageSize) as '20' | '50' | '100',
          relatedPersonId,
        },
        { emitEvent: false },
      );
      this.loadDates();
    });
  }

  loadDates(): void {
    const generation = ++this.datesLoadGeneration;
    const filters = this.appliedFilters();
    this.loading.set(true);
    this.error.set(null);
    this.datesService
      .listDates(filters)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          if (generation !== this.datesLoadGeneration) {
            return;
          }
          if (filters.page > Math.max(1, page.totalPages)) {
            this.goToPage(Math.max(1, page.totalPages));
            return;
          }
          this.expandedRelatedPeopleDateIds.set(new Set());
          this.page.set(page);
          this.loading.set(false);
        },
        error: (error: ApiError) => {
          if (generation !== this.datesLoadGeneration) {
            return;
          }
          this.error.set(error);
          this.loading.set(false);
          this.notifications.error(this.i18n.translate('knowledgeDates.loadError'));
        },
      });
  }

  loadTags(): void {
    this.peopleService
      .listTags('')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tags) => this.tags.set(tags),
        error: () => this.notifications.error(this.i18n.translate('knowledgeDates.tagsLoadError')),
      });
  }

  searchPeople(query: string): void {
    const generation = ++this.peopleLoadGeneration;
    this.peopleService
      .listPeople({
        page: 1,
        pageSize: 100,
        sort: 'nameAsc',
        searchQuery: query,
        tagIds: [],
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          if (generation === this.peopleLoadGeneration) {
            this.personCandidates.set(page.people);
          }
        },
        error: () => {
          if (generation === this.peopleLoadGeneration) {
            this.notifications.error(this.i18n.translate('knowledgeDates.peopleSearchError'));
          }
        },
      });
  }

  applyFilters(): void {
    const raw = this.filtersForm.getRawValue();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: raw.searchQuery.trim() || null,
        sort: raw.sort === 'dateAsc' ? null : raw.sort,
        pageSize: raw.pageSize === '20' ? null : raw.pageSize,
        tagIds: this.selectedTagIds().length > 0 ? this.selectedTagIds() : null,
        relatedPersonId: raw.relatedPersonId || null,
        page: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  resetFilters(): void {
    this.selectedTagIds.set([]);
    this.filtersForm.setValue(
      { searchQuery: '', sort: 'dateAsc', pageSize: '20', relatedPersonId: '' },
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
    this.createForm.reset({
      displayName: '',
      date: { day: '', month: '', year: '' },
    });
    this.createSnapshot.set(this.createForm.getRawValue());
    this.createUnsavedSource.commit();
    this.createSubmitted.set(false);
    this.createError.set(null);
    this.createDialogOpen.set(true);
  }

  closeCreateDialog(): void {
    if (!this.createSubmitting() && this.unsavedScope.confirmDiscard()) {
      this.createDialogOpen.set(false);
    }
  }

  createDate(): void {
    this.createSubmitted.set(true);
    this.createForm.markAllAsTouched();
    if (this.createForm.invalid) {
      this.notifications.error(this.i18n.translate('knowledgeDates.validationError'));
      return;
    }
    const value = this.createForm.getRawValue();
    this.createSubmitting.set(true);
    this.datesService
      .createDate({
        displayName: value.displayName.trim(),
        date: {
          day: Number(value.date.day),
          month: Number(value.date.month),
          year: value.date.year === '' ? null : Number(value.date.year),
        },
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (date) => {
          this.createSubmitting.set(false);
          this.createDialogOpen.set(false);
          this.createUnsavedSource.commit();
          this.notifications.success(this.i18n.translate('knowledgeDates.createSuccess'));
          void this.router.navigate(['/personal-workspace/knowledge/dates', date.id], {
            queryParamsHandling: 'preserve',
          });
        },
        error: (error: ApiError) => {
          this.createSubmitting.set(false);
          this.createError.set(error);
          this.notifications.error(this.i18n.translate('knowledgeDates.createError'));
        },
      });
  }

  deleteDate(dateId: string, displayName: string): void {
    const browserWindow = this.document.defaultView;
    if (
      browserWindow === null ||
      !browserWindow.confirm(
        this.i18n.translate('knowledgeDates.deleteConfirm', { name: displayName }),
      )
    ) {
      return;
    }
    this.deletePendingId.set(dateId);
    this.datesService
      .deleteDate(dateId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deletePendingId.set(null);
          this.notifications.success(this.i18n.translate('knowledgeDates.deleteSuccess'));
          this.loadDates();
        },
        error: () => {
          this.deletePendingId.set(null);
          this.notifications.error(this.i18n.translate('knowledgeDates.deleteError'));
        },
      });
  }

  dateActions(value: KnowledgeDateSummary): DropdownAction[] {
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
        disabled: this.deletePendingId() === value.id,
      },
    ];
  }

  handleDateAction(actionId: string, value: KnowledgeDateSummary): void {
    if (actionId === 'edit') {
      void this.router.navigate(['/personal-workspace/knowledge/dates', value.id], {
        queryParamsHandling: 'preserve',
      });
      return;
    }
    if (actionId === 'delete') {
      this.deleteDate(value.id, value.displayName);
      return;
    }
    throw new Error(`Unsupported Dates list action: ${actionId}`);
  }

  relatedPeopleForRow(value: KnowledgeDateSummary): KnowledgeDateSummary['relatedPeople'] {
    return this.relatedPeopleExpanded(value.id)
      ? value.relatedPeople
      : value.relatedPeople.slice(0, RELATED_PEOPLE_PREVIEW_LIMIT);
  }

  relatedPeopleCollapsible(value: KnowledgeDateSummary): boolean {
    return value.relatedPeople.length > RELATED_PEOPLE_PREVIEW_LIMIT;
  }

  relatedPeopleExpanded(dateId: string): boolean {
    return this.expandedRelatedPeopleDateIds().has(dateId);
  }

  toggleRelatedPeople(dateId: string): void {
    this.expandedRelatedPeopleDateIds.update((expandedDateIds) => {
      const nextExpandedDateIds = new Set(expandedDateIds);
      if (nextExpandedDateIds.has(dateId)) {
        nextExpandedDateIds.delete(dateId);
      } else {
        nextExpandedDateIds.add(dateId);
      }
      return nextExpandedDateIds;
    });
  }

  createNameInvalid(): boolean {
    return controlInvalid(this.createForm.controls.displayName, this.createSubmitted());
  }

  createNameMessage(): string | null {
    return validationMessage(this.createForm.controls.displayName, this.i18n);
  }

  createDateInvalid(): boolean {
    return this.createForm.controls.date.invalid && this.createSubmitted();
  }

  annualDateLabel(value: KnowledgeDateSummary['date']): string {
    return formatAnnualDate(value, this.i18n.dateLocale());
  }

  updatedAtLabel(value: string): string {
    return formatLocalizedDate(value, this.i18n.dateLocale(), 'dateTime');
  }

  private appliedFilters(): KnowledgeDateListFilters {
    const raw = this.filtersForm.getRawValue();
    return {
      page: this.currentPage(),
      pageSize: Number(raw.pageSize) as 20 | 50 | 100,
      sort: raw.sort,
      searchQuery: raw.searchQuery,
      tagIds: this.selectedTagIds(),
      relatedPersonId: raw.relatedPersonId,
    };
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

function sortValue(value: string | null): KnowledgeDateListSort {
  return SORTS.includes(value as KnowledgeDateListSort)
    ? (value as KnowledgeDateListSort)
    : 'dateAsc';
}
