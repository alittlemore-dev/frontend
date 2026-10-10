import { ActivatedRoute, Router } from '@angular/router';
import {
  ActionsDropdownComponent,
  DropdownAction,
} from '../../components/actions-dropdown/actions-dropdown.component';
import { DOCUMENT } from '@angular/common';
import {
  EmptyStateComponent,
  ErrorMessageComponent,
  LoadingSpinnerComponent,
  NotificationService,
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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { AccountSettingsService } from '../../../../core/auth/account-settings.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ApiError } from '../../../../core/models/api-error.model';
import { EventEditorComponent } from '../../components/event-editor/event-editor.component';
import { WorkspaceEvent } from '../../models/events.model';
import { EventsService } from '../../services/events.service';
import { Temporal } from 'temporal-polyfill';

@Component({
  selector: 'app-events-page',
  standalone: true,
  imports: [
    EmptyStateComponent,
    ErrorMessageComponent,
    LoadingSpinnerComponent,
    FormsModule,
    TranslatePipe,
    EventEditorComponent,
    ActionsDropdownComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './events-page.component.html',
  styleUrl: './events-page.component.scss',
})
export class EventsPageComponent implements OnInit {
  private readonly service = inject(EventsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  private readonly preferences = inject(AccountSettingsService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  readonly events = signal<readonly WorkspaceEvent[]>([]);
  get timeZone(): string {
    return this.preferences.timeZone();
  }
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly search = signal('');
  readonly editorOpen = signal(false);
  readonly selected = signal<WorkspaceEvent | null>(null);
  readonly deletingId = signal<string | null>(null);
  readonly filteredEvents = computed(() => {
    const query = this.search().trim().toLocaleLowerCase(this.i18n.dateLocale());
    if (!query) return this.events();
    return this.events().filter((event) =>
      `${event.title} ${event.description}`
        .toLocaleLowerCase(this.i18n.dateLocale())
        .includes(query),
    );
  });

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.search.set(params.get('q') ?? '');
      if (params.get('create') === 'true') {
        this.openCreate();
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { create: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      }
    });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (events) => {
          this.events.set(events);
          this.loading.set(false);
        },
        error: (error: ApiError) => {
          this.error.set(error);
          this.loading.set(false);
        },
      });
  }

  setSearch(query: string): void {
    this.search.set(query);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: query || null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
  eventActions(event: WorkspaceEvent): DropdownAction[] {
    return [
      {
        id: 'edit',
        label: this.i18n.translate('workspaceEvents.edit'),
        destructive: false,
        disabled: false,
      },
      {
        id: 'delete',
        label: this.i18n.translate('workspaceEvents.delete'),
        destructive: true,
        disabled: this.deletingId() === event.id,
      },
    ];
  }
  handleAction(action: string, event: WorkspaceEvent): void {
    if (action === 'edit') this.openEdit(event);
    if (action === 'delete') this.remove(event);
  }
  openCreate(): void {
    this.selected.set(null);
    this.editorOpen.set(true);
  }
  openEdit(event: WorkspaceEvent): void {
    this.selected.set(event);
    this.editorOpen.set(true);
  }
  closeEditor(): void {
    this.editorOpen.set(false);
  }
  onSaved(event: WorkspaceEvent): void {
    this.editorOpen.set(false);
    this.events.update((events) => {
      const index = events.findIndex((item) => item.id === event.id);
      return index < 0
        ? [...events, event]
        : events.map((item) => (item.id === event.id ? event : item));
    });
  }

  remove(event: WorkspaceEvent): void {
    const confirmed =
      this.document.defaultView?.confirm(this.i18n.translate('workspaceEvents.deleteConfirm')) ??
      false;
    if (!confirmed) return;
    this.deletingId.set(event.id);
    this.service
      .delete(event.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.events.update((events) => events.filter((item) => item.id !== event.id));
          this.deletingId.set(null);
          this.notifications.success(this.i18n.translate('workspaceEvents.deleted'));
        },
        error: () => {
          this.deletingId.set(null);
          this.notifications.error(this.i18n.translate('workspaceEvents.deleteError'));
        },
      });
  }

  eventDateLabel(event: WorkspaceEvent): string {
    if (event.allDay) {
      const formatter = new Intl.DateTimeFormat(this.i18n.dateLocale(), {
        dateStyle: 'medium',
        timeZone: 'UTC',
      });
      const endIncluded = Temporal.PlainDate.from(event.end).subtract({ days: 1 }).toString();
      const startLabel = formatter.format(new Date(`${event.start}T00:00:00Z`));
      return event.start === endIncluded
        ? startLabel
        : `${startLabel} – ${formatter.format(new Date(`${endIncluded}T00:00:00Z`))}`;
    }
    const formatter = new Intl.DateTimeFormat(this.i18n.dateLocale(), {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: this.timeZone,
    });
    return `${formatter.format(new Date(event.start))} – ${formatter.format(new Date(event.end))}`;
  }
}
