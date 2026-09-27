import { DatePipe, DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, finalize } from 'rxjs';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import {
  IssuedTelegramInvitation,
  TelegramConnectionAction,
  TelegramSettings,
  TelegramSettingsService,
  TelegramConnection,
} from '../../services/telegram-settings.service';

@Component({
  selector: 'app-telegram-settings',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './telegram-settings.component.html',
})
export class TelegramSettingsComponent {
  private readonly service = inject(TelegramSettingsService);
  private readonly i18n = inject(I18nService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  readonly settings = signal<TelegramSettings | null>(null);
  readonly issued = signal<IssuedTelegramInvitation | null>(null);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly editingId = signal('');
  readonly timeZones = [
    'UTC',
    ...Intl.supportedValuesOf('timeZone').filter((zone) => zone !== 'UTC'),
  ];
  readonly notificationDraft = signal<TelegramConnection | null>(null);
  readonly inviteLabel = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(100)],
  });
  readonly editLabel = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(100)],
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.service
      .load()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (settings) => this.settings.set(settings),
        error: () => this.error.set('account.telegram.loadFailed'),
      });
  }

  setEnabled(enabled: boolean): void {
    if (this.busy() || !this.settings()?.available) return;
    this.run(this.service.setEnabled(enabled));
  }

  setNotify(notify: boolean): void {
    if (this.busy() || !this.settings()?.available) return;
    this.run(this.service.setNotify(notify));
  }

  beginEditNotifications(connection: TelegramConnection): void {
    this.notificationDraft.set({ ...connection });
  }

  updateNotificationDraft(patch: Partial<TelegramConnection>): void {
    this.notificationDraft.update((current) => (current ? { ...current, ...patch } : null));
  }

  setNotificationLanguage(value: string): void {
    if (value === 'ru' || value === 'en') this.updateNotificationDraft({ language: value });
  }

  saveNotifications(): void {
    const connection = this.notificationDraft();
    if (!connection) return;
    this.run(
      this.service.updateConnectionSettings(connection.id, {
        notifyBirthday: connection.notifyBirthday,
        notifyMemorableDate: connection.notifyMemorableDate,
        language: connection.language,
        timeZone: connection.timeZone,
      }),
      () => this.notificationDraft.set(null),
    );
  }

  createInvitation(): void {
    const label = this.inviteLabel.value.trim();
    if (this.busy() || !label || this.inviteLabel.invalid) {
      this.error.set('account.telegram.labelRequired');
      return;
    }
    this.issued.set(null);
    this.busy.set(true);
    this.error.set('');
    this.service
      .createInvitation(label)
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (issued) => {
          this.issued.set(issued);
          this.load();
        },
        error: () => this.error.set('account.telegram.actionFailed'),
      });
  }

  cancelInvitation(id: string): void {
    if (!this.confirm('account.telegram.confirmCancel')) return;
    this.run(this.service.cancelInvitation(id));
  }

  changeState(id: string, action: TelegramConnectionAction): void {
    if (action !== 'approve' && !this.confirm(`account.telegram.confirm.${action}`)) return;
    this.run(this.service.changeState(id, action));
  }

  beginRename(id: string, label: string): void {
    this.editingId.set(id);
    this.editLabel.setValue(label);
  }

  rename(id: string): void {
    const label = this.editLabel.value.trim();
    if (!label || this.editLabel.invalid) {
      this.error.set('account.telegram.labelRequired');
      return;
    }
    this.run(this.service.rename(id, label), () => this.editingId.set(''));
  }

  private run(operation: Observable<unknown>, onSuccess?: () => void): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    operation
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          onSuccess?.();
          this.load();
        },
        error: () => this.error.set('account.telegram.actionFailed'),
      });
  }

  private confirm(key: string): boolean {
    return this.document.defaultView?.confirm(this.i18n.translate(key)) ?? false;
  }
}
