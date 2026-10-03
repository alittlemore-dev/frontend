import { NotificationService } from '@alittlemore.dev/design-system';
import { chooseSiteSelectOption } from '@alittlemore.dev/design-system/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, Subject, throwError } from 'rxjs';
import { AccountSettingsService } from '../../../../core/auth/account-settings.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { KnowledgeDatesService } from '../../knowledge/dates/services/dates.service';
import { PeopleService } from '../../knowledge/people/services/people.service';
import { EventsService } from '../../services/events.service';
import { CalendarKnowledgeCreateComponent } from '../calendar-knowledge-create/calendar-knowledge-create.component';
import { EventEditorComponent } from '../event-editor/event-editor.component';
import { CalendarEntryCreateComponent } from './calendar-entry-create.component';

describe('CalendarEntryCreateComponent', () => {
  const people = { createPerson: jest.fn() };
  const dates = { createDate: jest.fn() };
  const events = { create: jest.fn(), update: jest.fn() };
  beforeEach(() => {
    jest.clearAllMocks();
    people.createPerson.mockReturnValue(of({ id: 'person' }));
    dates.createDate.mockReturnValue(of({ id: 'date' }));
    events.create.mockImplementation((payload) => of({ id: 'event', ...payload }));
    jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(1);
    TestBed.configureTestingModule({
      providers: [
        provideI18nTesting(),
        { provide: PeopleService, useValue: people },
        { provide: KnowledgeDatesService, useValue: dates },
        { provide: EventsService, useValue: events },
        { provide: AccountSettingsService, useValue: { timeZone: signal('UTC') } },
        { provide: NotificationService, useValue: { success: jest.fn(), error: jest.fn() } },
      ],
    });
  });
  afterEach(() => jest.restoreAllMocks());

  function create() {
    const fixture = TestBed.createComponent(CalendarEntryCreateComponent);
    fixture.componentRef.setInput('initial', {
      allDay: true,
      start: '2028-02-29',
      end: '2028-02-29',
    });
    fixture.detectChanges();
    return fixture;
  }

  it('switches one dialog from an event to birthday and date with the relevant fields', () => {
    const fixture = create();
    function select(value: string) {
      chooseSiteSelectOption(fixture, '#calendar-entry-type', value);
    }
    expect(fixture.nativeElement.querySelectorAll('.modal[role="dialog"]').length).toBe(1);
    expect(fixture.nativeElement.querySelector('#event-description')).not.toBeNull();
    select('birthday');
    expect(fixture.nativeElement.querySelectorAll('.modal[role="dialog"]').length).toBe(1);
    expect(fixture.nativeElement.querySelector('#event-description')).toBeNull();
    expect(fixture.nativeElement.querySelector('#person-create-firstName')).not.toBeNull();
    const birthday = fixture.debugElement.query(By.directive(CalendarKnowledgeCreateComponent))
      .componentInstance as CalendarKnowledgeCreateComponent;
    expect(birthday.birthdayForm.getRawValue().date).toEqual({ day: '29', month: '2', year: null });
    select('date');
    expect(fixture.nativeElement.querySelector('#person-create-firstName')).toBeNull();
    expect(fixture.nativeElement.querySelector('#date-create-name')).not.toBeNull();
    const date = fixture.debugElement.query(By.directive(CalendarKnowledgeCreateComponent))
      .componentInstance as CalendarKnowledgeCreateComponent;
    expect(date.dateForm.getRawValue().date).toEqual({ day: '29', month: '2', year: null });
    date.dateForm.patchValue({ displayName: 'Anniversary' });
    const saved = jest.fn();
    fixture.componentInstance.knowledgeSaved.subscribe(saved);
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(dates.createDate).toHaveBeenCalledWith({
      displayName: 'Anniversary',
      date: { day: 29, month: 2, year: null },
    });
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('keeps focus on the type selector when changing fields and restores it on close', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    const fixture = create();
    document.body.appendChild(fixture.nativeElement);
    await fixture.whenStable();
    const control: HTMLButtonElement = fixture.nativeElement.querySelector('#calendar-entry-type');
    for (const kind of ['birthday', 'date', 'event']) {
      chooseSiteSelectOption(fixture, '#calendar-entry-type', kind);
      expect(document.activeElement).toBe(control);
    }
    fixture.destroy();
    expect(document.activeElement).toBe(trigger);
    fixture.nativeElement.remove();
    trigger.remove();
  });

  it('retains the current type and draft when discarding is rejected', () => {
    const fixture = create();
    const event = fixture.debugElement.query(By.directive(EventEditorComponent))
      .componentInstance as EventEditorComponent;
    event.form.controls.title.setValue('Draft');
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    chooseSiteSelectOption(fixture, '#calendar-entry-type', 'birthday');
    expect(confirm).toHaveBeenCalled();
    expect(fixture.componentInstance.kind()).toBe('event');
    expect(fixture.nativeElement.querySelector('#calendar-entry-type').value).toBe('event');
    expect(event.form.controls.title.value).toBe('Draft');
    confirm.mockReturnValue(true);
    chooseSiteSelectOption(fixture, '#calendar-entry-type', 'birthday');
    expect(fixture.nativeElement.querySelector('#event-title')).toBeNull();
    expect(fixture.nativeElement.querySelector('#person-create-firstName')).not.toBeNull();
  });

  it('closes the type list on Escape before closing the creation dialog', () => {
    const fixture = create();
    const closed = jest.fn();
    fixture.componentInstance.closed.subscribe(closed);
    const control: HTMLButtonElement = fixture.nativeElement.querySelector('#calendar-entry-type');
    control.click();
    fixture.detectChanges();
    expect(control.getAttribute('aria-expanded')).toBe('true');
    control.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(control.getAttribute('aria-expanded')).toBe('false');
    expect(closed).not.toHaveBeenCalled();
    control.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('preserves event creation and forwards its successful save', () => {
    const fixture = create();
    const editor = fixture.debugElement.query(By.directive(EventEditorComponent))
      .componentInstance as EventEditorComponent;
    const saved = jest.fn();
    fixture.componentInstance.eventSaved.subscribe(saved);
    editor.form.controls.title.setValue('Meeting');
    fixture.nativeElement
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(events.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Meeting',
        allDay: true,
        start: '2028-02-29',
        end: '2028-03-01',
      }),
    );
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ id: 'event', title: 'Meeting' }));
    expect(people.createPerson).not.toHaveBeenCalled();
    expect(dates.createDate).not.toHaveBeenCalled();
  });

  it('prevents type changes while a birthday is being saved', () => {
    const response = new Subject<{ id: string }>();
    people.createPerson.mockReturnValue(response);
    const fixture = create();
    fixture.componentInstance.typeControl.setValue('birthday');
    fixture.detectChanges();
    const birthday = fixture.debugElement.query(By.directive(CalendarKnowledgeCreateComponent))
      .componentInstance as CalendarKnowledgeCreateComponent;
    birthday.birthdayForm.patchValue({ firstName: 'Ivan', lastName: 'Ivanov' });
    birthday.save();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#calendar-entry-type').disabled).toBe(true);
    fixture.componentInstance.typeControl.setValue('event');
    expect(fixture.componentInstance.kind()).toBe('birthday');
    const saved = jest.fn();
    fixture.componentInstance.knowledgeSaved.subscribe(saved);
    response.next({ id: 'person' });
    expect(people.createPerson).toHaveBeenCalledTimes(1);
    expect(saved).toHaveBeenCalledTimes(1);
  });

  it('clears failed submission feedback when switching to another annual type', () => {
    people.createPerson.mockReturnValue(throwError(() => ({ message: 'birthday failed' })));
    const fixture = create();
    fixture.componentInstance.typeControl.setValue('birthday');
    fixture.detectChanges();
    const editor = fixture.debugElement.query(By.directive(CalendarKnowledgeCreateComponent))
      .componentInstance as CalendarKnowledgeCreateComponent;
    editor.birthdayForm.patchValue({ firstName: 'Ivan', lastName: 'Ivanov' });
    editor.save();
    expect(editor.error()).toEqual({ message: 'birthday failed' });
    expect(editor.submitted()).toBe(true);
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    fixture.componentInstance.typeControl.setValue('date');
    fixture.detectChanges();
    expect(editor.error()).toBeNull();
    expect(editor.submitted()).toBe(false);
    expect(fixture.nativeElement.querySelector('ds-error-message')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('#date-create-name').classList.contains('is-invalid'),
    ).toBe(false);
  });
});
