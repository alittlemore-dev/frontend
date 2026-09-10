import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { NotificationAreaComponent } from './notification-area.component';
import { NotificationService } from '../../../../core/notifications/notification.service';

describe('NotificationAreaComponent', () => {
  let fixture: ComponentFixture<NotificationAreaComponent>;
  let dismiss: jest.Mock;

  beforeEach(async () => {
    dismiss = jest.fn();

    await TestBed.configureTestingModule({
      imports: [NotificationAreaComponent],
      providers: [
        {
          provide: NotificationService,
          useValue: {
            notifications: signal([
              { id: 1, type: 'success', message: 'Saved' },
              { id: 2, type: 'danger', message: 'Failed', dismissing: true },
            ]),
            dismiss,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationAreaComponent);
    fixture.detectChanges();
  });

  it('renders notifications with dismiss buttons', () => {
    const alerts = fixture.nativeElement.querySelectorAll('[role="alert"]');
    expect(alerts.length).toBe(2);
    expect(alerts[0].textContent).toContain('Saved');
    expect(alerts[1].textContent).toContain('Failed');
    expect(alerts[1].classList).toContain('notification-alert-dismissing');
  });

  it('dismisses a notification from the close button', () => {
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    button.click();

    expect(dismiss).toHaveBeenCalledWith(1);
  });
});
