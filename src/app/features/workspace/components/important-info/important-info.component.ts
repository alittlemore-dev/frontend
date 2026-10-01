import {
  CdkDrag,
  CdkDragDrop,
  CdkDragPlaceholder,
  CdkDropList,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import {
  NotificationService,
  ErrorMessageComponent,
  LoadingSpinnerComponent,
} from '@alittlemore.dev/design-system';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, Validators } from '@angular/forms';
import { CdkTextareaAutosize } from '@angular/cdk/text-field';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { ApiError } from '../../../../core/models/api-error.model';
import {
  UnsavedChangesService,
  UnsavedChangesSource,
} from '../../../../core/unsaved-changes/unsaved-changes.service';
import { ImportantInfoItem } from '../../models/important-info.model';
import { ImportantInfoService } from '../../services/important-info.service';

@Component({
  selector: 'app-important-info',
  standalone: true,
  imports: [
    CdkDrag,
    CdkTextareaAutosize,
    CdkDragPlaceholder,
    CdkDropList,
    ErrorMessageComponent,
    LoadingSpinnerComponent,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './important-info.component.html',
  styleUrl: './important-info.component.scss',
})
export class ImportantInfoComponent implements OnInit {
  private readonly service = inject(ImportantInfoService);
  private readonly notifications = inject(NotificationService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly unsavedScope = inject(UnsavedChangesService).createScope(this.destroyRef);
  private readonly editUnsavedSource: UnsavedChangesSource;
  private draggedId: string | null = null;
  private nextEditId: string | null = null;
  private afterSaveAction: (() => void) | null = null;

  readonly items = signal<readonly ImportantInfoItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal<ApiError | null>(null);
  readonly busy = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly editText = new FormControl('', {
    nonNullable: true,
    validators: [Validators.maxLength(255)],
  });
  readonly editError = signal(false);
  readonly editSnapshot = signal('');
  readonly editActive = computed(() => this.editingId() !== null);

  constructor() {
    this.editUnsavedSource = this.unsavedScope.registerSource(this.editSnapshot, this.editActive);
    this.editText.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.editSnapshot.set(value));
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.items.set(items);
          this.loading.set(false);
        },
        error: (error: ApiError) => {
          this.error.set(error);
          this.loading.set(false);
        },
      });
  }

  add(): void {
    if (this.busy()) return;
    if (this.editingId()) {
      this.afterSaveAction = () => this.add();
      this.save();
      return;
    }
    this.busy.set(true);
    this.service
      .create('')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (item) => {
          this.items.update((items) => [...items, item].sort((a, b) => a.position - b.position));
          this.busy.set(false);
          this.edit(item);
          this.notifications.success(this.i18n.translate('workspaceDashboard.importantInfo.added'));
        },
        error: () => {
          this.busy.set(false);
          this.notifications.error(
            this.i18n.translate('workspaceDashboard.importantInfo.saveError'),
          );
        },
      });
  }

  onAddPointerDown(event: PointerEvent): void {
    if (this.editingId()) event.preventDefault();
  }

  onItemPointerDown(): void {
    this.draggedId = null;
  }

  onDragStarted(id: string): void {
    this.draggedId = id;
  }

  onDisplayClick(item: ImportantInfoItem, event: MouseEvent): void {
    if (event.detail !== 0 && this.draggedId === item.id) return;
    this.edit(item);
  }

  edit(item: ImportantInfoItem): void {
    if (this.editingId() === item.id) return;
    if (this.busy()) {
      this.nextEditId = item.id;
      return;
    }
    if (this.editingId()) {
      this.nextEditId = item.id;
      this.save();
      return;
    }
    this.editText.setValue(item.text);
    this.editUnsavedSource.commit();
    this.editingId.set(item.id);
    this.editError.set(false);
    afterNextRender(
      () => {
        if (this.editingId() === item.id) {
          this.host.nativeElement
            .querySelector<HTMLTextAreaElement>(`#important-info-edit-${item.id}`)
            ?.focus();
        }
      },
      { injector: this.injector },
    );
  }

  cancel(input?: HTMLTextAreaElement): void {
    const id = this.editingId();
    const current = this.items().find((item) => item.id === id);
    this.editText.setValue(current?.text ?? '');
    if (input) input.value = current?.text ?? '';
    this.editUnsavedSource.commit();
    this.editingId.set(null);
    this.editError.set(false);
    this.nextEditId = null;
    this.afterSaveAction = null;
    if (input && id) this.restoreDisplayFocus(id);
  }

  onEditInput(id: string, event: Event): void {
    if (this.editingId() !== id) return;
    this.editText.setValue((event.target as HTMLTextAreaElement).value);
    this.editError.set(false);
  }

  onEditBlur(id: string, event: FocusEvent): void {
    if ((event.relatedTarget as HTMLElement | null)?.closest('.important-info-grid')) return;
    if (this.editingId() === id) this.save();
  }

  onGridFocusOut(event: FocusEvent): void {
    // Replacing the focused display button emits focusout before the editor receives focus.
    if ((event.target as HTMLElement).closest('.important-info-display')) return;
    const grid = event.currentTarget as HTMLElement;
    if (event.relatedTarget && grid.contains(event.relatedTarget as Node)) return;
    if (this.editingId()) this.save();
  }

  onActionPointerDown(event: PointerEvent): void {
    event.stopPropagation();
    if (this.editingId()) event.preventDefault();
  }

  onActionDragStart(event: Event): void {
    event.stopPropagation();
  }

  onEditKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.cancel(event.target as HTMLTextAreaElement);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.save(true);
    }
  }

  save(restoreFocus = false): void {
    const id = this.editingId();
    const text = this.editText.value.trim();
    if (this.busy()) return;
    if (!id) {
      this.afterSaveAction = null;
      return;
    }
    if (this.editText.invalid) {
      this.editError.set(true);
      this.nextEditId = null;
      this.afterSaveAction = null;
      return;
    }
    if (text === this.items().find((item) => item.id === id)?.text) {
      this.editUnsavedSource.commit();
      this.editingId.set(null);
      this.finishEdit();
      if (restoreFocus) this.restoreDisplayFocus(id);
      return;
    }
    this.editError.set(false);
    this.busy.set(true);
    this.service
      .update(id, text)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (item) => {
          this.items.update((items) => items.map((value) => (value.id === id ? item : value)));
          this.editText.setValue(item.text);
          this.editUnsavedSource.commit();
          this.editingId.set(null);
          this.busy.set(false);
          this.notifications.success(
            this.i18n.translate('workspaceDashboard.importantInfo.updated'),
          );
          this.finishEdit();
          if (restoreFocus) this.restoreDisplayFocus(id);
        },
        error: () => {
          this.busy.set(false);
          this.nextEditId = null;
          this.afterSaveAction = null;
          this.notifications.error(
            this.i18n.translate('workspaceDashboard.importantInfo.saveError'),
          );
        },
      });
  }

  private activatePendingEdit(): void {
    const id = this.nextEditId;
    this.nextEditId = null;
    const item = this.items().find((candidate) => candidate.id === id);
    if (item) this.edit(item);
  }

  private finishEdit(): void {
    const action = this.afterSaveAction;
    this.afterSaveAction = null;
    action?.();
    this.activatePendingEdit();
  }

  private restoreDisplayFocus(id: string): void {
    afterNextRender(
      () => {
        if (this.editingId() === null) {
          this.host.nativeElement
            .querySelector<HTMLButtonElement>(`[data-info-id="${id}"] .important-info-display`)
            ?.focus();
        }
      },
      { injector: this.injector },
    );
  }

  private restoreFocusAfterDelete(adjacentId: string | null): void {
    afterNextRender(
      () => {
        const selector = adjacentId
          ? `[data-info-id="${adjacentId}"] .important-info-display`
          : '.important-info-add';
        this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus();
      },
      { injector: this.injector },
    );
  }

  remove(id: string): void {
    if (this.busy()) return;
    if (this.editingId() === id) this.cancel();
    else if (this.editingId()) {
      this.afterSaveAction = () => this.remove(id);
      this.save();
      return;
    }
    const index = this.items().findIndex((item) => item.id === id);
    const adjacentId = this.items()[index + 1]?.id ?? this.items()[index - 1]?.id ?? null;
    this.busy.set(true);
    this.service
      .delete(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.items.update((items) => items.filter((item) => item.id !== id));
          this.busy.set(false);
          this.notifications.success(
            this.i18n.translate('workspaceDashboard.importantInfo.deleted'),
          );
          this.restoreFocusAfterDelete(adjacentId);
        },
        error: () => {
          this.busy.set(false);
          this.notifications.error(
            this.i18n.translate('workspaceDashboard.importantInfo.deleteError'),
          );
        },
      });
  }

  drop(event: CdkDragDrop<readonly ImportantInfoItem[]>): void {
    this.reorder(event.previousIndex, event.currentIndex);
  }

  private reorder(from: number, to: number): void {
    const items = [...this.items()];
    if (this.busy() || from < 0 || to < 0 || to >= items.length || from === to) return;
    moveItemInArray(items, from, to);
    this.busy.set(true);
    this.service
      .reorder(items.map((item) => item.id))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (ordered) => {
          this.items.set(ordered);
          this.busy.set(false);
          this.notifications.success(
            this.i18n.translate('workspaceDashboard.importantInfo.reordered'),
          );
        },
        error: () => {
          this.busy.set(false);
          this.notifications.error(
            this.i18n.translate('workspaceDashboard.importantInfo.orderError'),
          );
        },
      });
  }
}
