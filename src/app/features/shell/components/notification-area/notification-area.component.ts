import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-notification-area',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (notificationService.notifications().length > 0) {
      <section class="alerts-section position-fixed end-0" aria-live="polite">
        @for (notification of notificationService.notifications(); track notification.id) {
          <div
            class="alert alert-dismissible shadow-sm notification-alert"
            [class.alert-success]="notification.type === 'success'"
            [class.alert-danger]="notification.type === 'danger'"
            [class.notification-alert-dismissing]="notification.dismissing === true"
            role="alert"
          >
            {{ notification.message }}
            <button
              type="button"
              class="btn-close"
              [attr.aria-label]="'shared.close' | t"
              (click)="notificationService.dismiss(notification.id)"
            ></button>
          </div>
        }
      </section>
    }
  `,
  styles: [
    `
      .alerts-section {
        z-index: 1080;
        inline-size: min(24rem, calc(100vw - 2rem));
        inset-block-start: 4rem;
        margin: 1rem;
      }

      .notification-alert {
        animation: notification-alert-enter 160ms ease-out;
        transition:
          opacity 200ms ease,
          transform 200ms ease;
      }

      .notification-alert-dismissing {
        opacity: 0;
        pointer-events: none;
        transform: translateY(-0.5rem);
      }

      @keyframes notification-alert-enter {
        from {
          opacity: 0;
          transform: translateY(-0.5rem);
        }

        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `,
  ],
})
export class NotificationAreaComponent {
  readonly notificationService = inject(NotificationService);
}
