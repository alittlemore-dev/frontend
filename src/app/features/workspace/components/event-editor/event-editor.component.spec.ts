import { NotificationService } from '@alittlemore.dev/design-system';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { EventsService } from '../../services/events.service';
import { EventEditorComponent } from './event-editor.component';
import { AccountSettingsService } from '../../../../core/auth/account-settings.service';

describe('EventEditorComponent', () => {
  let fixture: ComponentFixture<EventEditorComponent>;
  const timeZone = signal('UTC');
  const service = { create: jest.fn(), update: jest.fn() };
  beforeEach(async () => {
    jest.clearAllMocks();
    timeZone.set('UTC');
    jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1);
    service.create.mockImplementation((payload) => of({ id: 'event-1', ...payload }));
    await TestBed.configureTestingModule({
      imports: [EventEditorComponent],
      providers: [
        provideI18nTesting(),
        { provide: EventsService, useValue: service },
        { provide: AccountSettingsService, useValue: { timeZone } },
        { provide: NotificationService, useValue: { success: jest.fn(), error: jest.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(EventEditorComponent);
    fixture.detectChanges();
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    jest.restoreAllMocks();
  });

  it('saves an all-day event with an exclusive API end date', () => {
    const component = fixture.componentInstance;
    component.form.setValue({
      title: 'Holiday',
      description: 'Break',
      allDay: true,
      dateRange: { start: '2026-12-31', end: '2026-12-31' },
      dateTimeRange: { start: null, end: null },
      frequency: 'yearly',
      untilDate: null,
    });
    fixture.detectChanges();
    expect(component.form.getRawValue()).toEqual({
      title: 'Holiday',
      description: 'Break',
      allDay: true,
      dateRange: { start: '2026-12-31', end: '2026-12-31' },
      dateTimeRange: { start: null, end: null },
      frequency: 'yearly',
      untilDate: null,
    });
    expect(
      Object.fromEntries(
        Object.entries(component.form.controls).map(([key, control]) => [key, control.errors]),
      ),
    ).toEqual({
      title: null,
      description: null,
      allDay: null,
      dateRange: null,
      dateTimeRange: null,
      frequency: null,
      untilDate: null,
    });
    component.submit();
    expect(component.validationError()).toBeNull();
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('ds-localized-date-range-picker'),
    ).not.toBeNull();
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        allDay: true,
        start: '2026-12-31',
        end: '2027-01-01',
        recurrence: { frequency: 'yearly', untilDate: null },
      }),
    );
  });

  it('uses the account zone for a new event and for viewing an existing series', () => {
    timeZone.set('Pacific/Honolulu');
    fixture.destroy();
    fixture = TestBed.createComponent(EventEditorComponent);
    fixture.detectChanges();
    fixture.componentRef.setInput('event', {
      id: 'existing',
      title: 'Meeting',
      description: '',
      allDay: false,
      start: '2026-10-01T08:00:00Z',
      end: '2026-10-01T09:00:00Z',
      recurrence: { frequency: 'weekly', untilDate: null },
    });
    fixture.detectChanges();
    expect(fixture.componentInstance.form.controls.dateTimeRange.value.start).toBe(
      '2026-09-30T22:00',
    );
    expect((fixture.nativeElement as HTMLElement).querySelector('#event-time-zone')).toBeNull();
  });

  it('shows a validation message for a reversed timed range', () => {
    fixture.componentInstance.form.setValue({
      title: 'Meeting',
      description: '',
      allDay: false,
      dateRange: { start: null, end: null },
      dateTimeRange: { start: '2026-10-01T12:00', end: '2026-10-01T11:00' },
      frequency: 'none',
      untilDate: null,
    });
    fixture.componentInstance.submit();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).not.toBeNull();
    expect(service.create).not.toHaveBeenCalled();
  });

  it('uses localized date pickers and reports length errors', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('ds-localized-datetime-range-picker')).toHaveLength(1);
    fixture.componentInstance.form.controls.title.setValue('x'.repeat(256));
    fixture.componentInstance.submit();
    fixture.detectChanges();
    expect(fixture.componentInstance.validationError()).toBe('workspaceEvents.titleTooLong');
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
    expect(service.create).not.toHaveBeenCalled();
  });

  it('preserves calendar dates when switching from timed to all-day range', () => {
    const component = fixture.componentInstance;
    component.form.controls.dateTimeRange.setValue({
      start: '2026-10-01T09:30',
      end: '2026-10-02T10:30',
    });
    component.form.controls.allDay.setValue(true);
    fixture.detectChanges();
    expect(component.form.controls.dateRange.value).toEqual({
      start: '2026-10-01',
      end: '2026-10-02',
    });
    expect(component.form.controls.dateRange.enabled).toBe(true);
    expect(component.form.controls.dateTimeRange.disabled).toBe(true);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('ds-localized-date-range-picker'),
    ).not.toBeNull();
  });

  it('saves a calendar slot in the first fall-back fold for exactly one hour', () => {
    timeZone.set('America/New_York');
    fixture.componentRef.setInput('initial', {
      allDay: false,
      start: '2026-11-01T01:30',
      end: '2026-11-01T01:30',
      startInstant: '2026-11-01T05:30:00Z',
      endInstant: '2026-11-01T06:30:00Z',
    });
    fixture.detectChanges();
    fixture.componentInstance.form.controls.title.setValue('Night shift');
    fixture.componentInstance.submit();
    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({
        start: '2026-11-01T05:30:00Z',
        end: '2026-11-01T06:30:00Z',
      }),
    );
  });

  it('keeps the second fall-back fold unchanged during a title-only edit', () => {
    timeZone.set('America/New_York');
    const event = {
      id: 'event-1',
      title: 'Night shift',
      description: '',
      allDay: false,
      start: '2026-11-01T06:30:00Z',
      end: '2026-11-01T07:30:00Z',
      recurrence: { frequency: 'none' as const, untilDate: null },
    };
    service.update.mockImplementation((_id, payload) => of({ id: 'event-1', ...payload }));
    fixture.componentRef.setInput('event', event);
    fixture.detectChanges();
    fixture.componentInstance.form.controls.title.setValue('Updated shift');
    fixture.componentInstance.submit();
    expect(service.update).toHaveBeenCalledWith(
      'event-1',
      expect.objectContaining({
        title: 'Updated shift',
        start: event.start,
        end: event.end,
      }),
    );
  });

  it('keeps an unchanged second-fold start when editing only the end', () => {
    timeZone.set('America/New_York');
    const event = {
      id: 'event-1',
      title: 'Night shift',
      description: '',
      allDay: false,
      start: '2026-11-01T06:30:00Z',
      end: '2026-11-01T07:30:00Z',
      recurrence: { frequency: 'none' as const, untilDate: null },
    };
    service.update.mockImplementation((_id, payload) => of({ id: 'event-1', ...payload }));
    fixture.componentRef.setInput('event', event);
    fixture.detectChanges();
    fixture.componentInstance.form.controls.dateTimeRange.setValue({
      start: '2026-11-01T01:30',
      end: '2026-11-01T02:45',
    });
    fixture.componentInstance.submit();
    expect(service.update).toHaveBeenCalledWith(
      'event-1',
      expect.objectContaining({
        start: event.start,
        end: '2026-11-01T07:45:00Z',
      }),
    );
  });

  it('moves focus into the dialog, closes on Escape, and restores focus', async () => {
    fixture.destroy();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const dialog = TestBed.createComponent(EventEditorComponent);
    document.body.appendChild(dialog.nativeElement);
    const closed = jest.fn();
    dialog.componentInstance.closed.subscribe(closed);
    dialog.detectChanges();
    await dialog.whenStable();
    expect(document.activeElement).toBe(
      (dialog.nativeElement as HTMLElement).querySelector('#event-title'),
    );
    (document.activeElement as HTMLElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    dialog.detectChanges();
    expect(closed).toHaveBeenCalledTimes(1);
    dialog.destroy();
    expect(document.activeElement).toBe(trigger);
    (dialog.nativeElement as HTMLElement).remove();
    trigger.remove();
  });
});
