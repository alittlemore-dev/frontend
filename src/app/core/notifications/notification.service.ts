import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

const NOTIFICATION_AUTO_DISMISS_MS = 5000;
const NOTIFICATION_DISMISS_ANIMATION_MS = 200;

export interface AppNotification {
  id: number;
  type: 'success' | 'danger';
  message: string;
  dismissing?: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly document = inject(DOCUMENT);
  private nextId = 1;
  private readonly autoDismissTimeoutIds = new Map<number, number>();
  readonly notifications = signal<AppNotification[]>([]);

  success(message: string): void {
    const id = this.add('success', message);
    this.scheduleAutoDismiss(id);
  }

  error(message: string): void {
    const id = this.add('danger', message);
    this.scheduleAutoDismiss(id);
  }

  dismiss(id: number): void {
    const notification = this.notifications().find((item) => item.id === id);
    if (notification === undefined || notification.dismissing === true) return;
    this.clearAutoDismiss(id);

    const timerWindow = this.document.defaultView;
    if (timerWindow === null) {
      this.remove(id);
      return;
    }

    this.notifications.update((items) =>
      items.map((item) => (item.id === id ? { ...item, dismissing: true } : item)),
    );
    timerWindow.setTimeout(() => this.remove(id), NOTIFICATION_DISMISS_ANIMATION_MS);
  }

  private add(type: AppNotification['type'], message: string): number {
    const notification: AppNotification = {
      id: this.nextId,
      type,
      message,
    };
    this.nextId += 1;
    this.notifications.update((items) => [...items, notification]);
    return notification.id;
  }

  private scheduleAutoDismiss(id: number): void {
    const timerWindow = this.document.defaultView;
    if (timerWindow === null) return;
    const timeoutId = timerWindow.setTimeout(() => this.dismiss(id), NOTIFICATION_AUTO_DISMISS_MS);
    this.autoDismissTimeoutIds.set(id, timeoutId);
  }

  private clearAutoDismiss(id: number): void {
    const timeoutId = this.autoDismissTimeoutIds.get(id);
    if (timeoutId === undefined) return;
    this.document.defaultView?.clearTimeout(timeoutId);
    this.autoDismissTimeoutIds.delete(id);
  }

  private remove(id: number): void {
    this.clearAutoDismiss(id);
    this.notifications.update((items) => items.filter((item) => item.id !== id));
  }
}
