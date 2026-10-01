import { DOCUMENT } from '@angular/common';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import {
  TelegramSettings,
  TelegramSettingsService,
} from '../../services/telegram-settings.service';
import { TelegramSettingsComponent } from './telegram-settings.component';

const SETTINGS: TelegramSettings = {
  available: true,
  status: 'ready',
  enabled: true,
  notify: false,
  invitations: [],
  connections: [
    {
      id: 'abc',
      label: 'Boris',
      telegramUserId: 42,
      username: 'boris',
      firstName: 'Boris',
      state: 'pending',
      requestedAt: '2026-09-26T12:00:00Z',
      connectedAt: null,
      lastContactAt: '2026-09-26T12:00:00Z',
      notifyBirthday: false,
      notifyMemorableDate: false,
      notifyFinanceTransaction: false,
      notifyFinanceLimit: false,
      language: 'en',
    },
  ],
};

describe('TelegramSettingsComponent', () => {
  let fixture: ComponentFixture<TelegramSettingsComponent>;
  const service = {
    load: jest.fn(),
    setEnabled: jest.fn(),
    setNotify: jest.fn(),
    updateConnectionSettings: jest.fn(),
    createInvitation: jest.fn(),
    cancelInvitation: jest.fn(),
    changeState: jest.fn(),
    rename: jest.fn(),
  };

  beforeEach(async () => {
    service.load.mockReset().mockReturnValue(of(SETTINGS));
    service.setEnabled.mockReset().mockReturnValue(of({ enabled: true }));
    service.setNotify.mockReset().mockReturnValue(of({ notify: false }));
    service.updateConnectionSettings.mockReset().mockReturnValue(of(SETTINGS.connections[0]));
    service.createInvitation.mockReset().mockReturnValue(
      of({
        url: 'https://t.me/shared_bot?start=secret',
        expiresAt: '2026-09-26T12:15:00Z',
      }),
    );
    service.cancelInvitation.mockReset().mockReturnValue(of(undefined));
    service.changeState
      .mockReset()
      .mockReturnValue(of({ ...SETTINGS.connections[0], state: 'active' }));
    service.rename.mockReset().mockReturnValue(of(SETTINGS.connections[0]));
    await TestBed.configureTestingModule({
      imports: [TelegramSettingsComponent],
      providers: [
        provideI18nTesting({
          'account.telegram.connecting': 'Connecting to Telegram',
          'account.telegram.failed': 'Telegram connection failed',
          'account.telegram.unavailable': 'Telegram is not configured',
          'account.telegram.loadFailed': 'Could not load Telegram settings',
        }),
        { provide: TelegramSettingsService, useValue: service },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TelegramSettingsComponent);
    fixture.detectChanges();
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['connecting', 'Connecting to Telegram'],
    ['failed', 'Telegram connection failed'],
    ['disabled', 'Telegram is not configured'],
  ] as const)('shows the %s state without hiding saved data or drafts', (status, message) => {
    const component = fixture.componentInstance;
    component.beginRename('abc', 'Boris');
    component.editLabel.setValue('Draft name');
    component.beginEditNotifications(SETTINGS.connections[0]);
    component.updateNotificationDraft({ notifyFinanceTransaction: true });
    component.inviteLabel.setValue('Draft invitation');
    service.load.mockReturnValue(of({ ...SETTINGS, status, available: status !== 'disabled' }));

    component.load();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[role="status"]')?.textContent).toContain(message);
    expect(root.textContent).toContain('Boris');
    expect(root.querySelector<HTMLInputElement>('#telegram-enabled')!.checked).toBe(true);
    expect(root.querySelector<HTMLInputElement>('#telegram-rename-abc')!.value).toBe('Draft name');
    expect(root.querySelector<HTMLInputElement>('#telegram-invite-label')!.value).toBe(
      'Draft invitation',
    );
    expect(root.querySelector<HTMLInputElement>('#telegram-finance-transaction')!.checked).toBe(
      true,
    );
    const controls = [...root.querySelectorAll('fieldset input, fieldset select, fieldset button')];
    expect(controls.length).toBeGreaterThan(10);
    expect(controls.every((control) => control.matches(':disabled'))).toBe(true);
  });

  it.each(['connecting', 'failed', 'disabled'] as const)(
    'blocks every editing handler while %s, including direct calls',
    (status) => {
      const component = fixture.componentInstance;
      component.beginRename('abc', 'Boris');
      component.editLabel.setValue('Draft name');
      component.beginEditNotifications(SETTINGS.connections[0]);
      component.inviteLabel.setValue('Draft invitation');
      service.load.mockReturnValue(of({ ...SETTINGS, status }));
      component.load();
      const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);

      component.setEnabled(false);
      component.setNotify(true);
      component.createInvitation();
      component.cancelInvitation('invite');
      for (const action of ['approve', 'revoke', 'block', 'unblock'] as const) {
        component.changeState('abc', action);
      }
      component.beginRename('other', 'Other');
      component.rename('abc');
      component.beginEditNotifications({ ...SETTINGS.connections[0], id: 'other' });
      component.updateNotificationDraft({ notifyBirthday: true });
      component.setNotificationLanguage('ru');
      component.saveNotifications();

      for (const method of [
        service.setEnabled,
        service.setNotify,
        service.createInvitation,
        service.cancelInvitation,
        service.changeState,
        service.rename,
        service.updateConnectionSettings,
      ]) {
        expect(method).not.toHaveBeenCalled();
      }
      expect(confirm).not.toHaveBeenCalled();
      expect(component.editingId()).toBe('abc');
      expect(component.editLabel.value).toBe('Draft name');
      expect(component.notificationDraft()).toEqual(SETTINGS.connections[0]);
    },
  );

  it('fails closed on a refresh error, preserves drafts and supports retry recovery', () => {
    const component = fixture.componentInstance;
    component.beginRename('abc', 'Boris');
    component.editLabel.setValue('Unsaved name');
    component.beginEditNotifications(SETTINGS.connections[0]);
    component.updateNotificationDraft({ notifyFinanceLimit: true });
    service.load.mockReturnValue(throwError(() => new Error('offline')));
    component.load();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'Could not load Telegram settings',
    );
    expect(root.querySelector<HTMLInputElement>('#telegram-enabled')!.disabled).toBe(true);
    component.setNotify(true);
    component.saveNotifications();
    expect(service.setNotify).not.toHaveBeenCalled();
    expect(service.updateConnectionSettings).not.toHaveBeenCalled();
    expect(component.editLabel.value).toBe('Unsaved name');
    expect(component.notificationDraft()?.notifyFinanceLimit).toBe(true);

    service.load.mockReturnValue(of(SETTINGS));
    root.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    fixture.detectChanges();
    expect(root.querySelector('[role="alert"]')).toBeNull();
    expect(root.querySelector<HTMLInputElement>('#telegram-enabled')!.disabled).toBe(false);
    expect(component.editLabel.value).toBe('Unsaved name');
    expect(component.notificationDraft()?.notifyFinanceLimit).toBe(true);
    component.saveNotifications();
    expect(service.updateConnectionSettings).toHaveBeenCalled();
  });

  it.each(['connecting', 'failed'] as const)(
    'polls %s readiness without overlapping requests and cancels polling and loading on teardown',
    (status) => {
      fixture.destroy();
      jest.useFakeTimers();
      try {
        const pending = new Subject<TelegramSettings>();
        service.load.mockClear().mockReturnValue(pending);
        fixture = TestBed.createComponent(TelegramSettingsComponent);
        fixture.detectChanges();
        jest.advanceTimersByTime(30_000);
        fixture.componentInstance.load();
        expect(service.load).toHaveBeenCalledTimes(1);
        pending.next({ ...SETTINGS, status });
        pending.complete();
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('#telegram-enabled').disabled).toBe(true);

        service.load.mockReturnValue(of(SETTINGS));
        jest.advanceTimersByTime(10_000);
        fixture.detectChanges();
        expect(service.load).toHaveBeenCalledTimes(2);
        expect(fixture.nativeElement.querySelector('#telegram-enabled').disabled).toBe(false);
        const last = new Subject<TelegramSettings>();
        service.load.mockReturnValue(last);
        jest.advanceTimersByTime(10_000);
        expect(last.observed).toBe(true);
        fixture.destroy();
        expect(last.observed).toBe(false);
        jest.advanceTimersByTime(30_000);
        expect(service.load).toHaveBeenCalledTimes(3);
      } finally {
        fixture.destroy();
        jest.useRealTimers();
      }
    },
  );

  it('automatically recovers from a failed refresh without replacing unsaved drafts', () => {
    fixture.destroy();
    jest.useFakeTimers();
    try {
      service.load.mockReturnValue(of(SETTINGS));
      fixture = TestBed.createComponent(TelegramSettingsComponent);
      const component = fixture.componentInstance;
      component.beginRename('abc', 'Boris');
      component.editLabel.setValue('Unsaved name');
      service.load.mockReturnValue(throwError(() => new Error('offline')));
      jest.advanceTimersByTime(10_000);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('#telegram-enabled').disabled).toBe(true);
      expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
      service.load.mockReturnValue(of(SETTINGS));
      jest.advanceTimersByTime(10_000);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('#telegram-enabled').disabled).toBe(false);
      expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
      expect(component.editLabel.value).toBe('Unsaved name');
    } finally {
      fixture.destroy();
      jest.useRealTimers();
    }
  });

  it('does not poll while a Telegram preference is being saved', () => {
    fixture.destroy();
    jest.useFakeTimers();
    try {
      service.load.mockClear().mockReturnValue(of(SETTINGS));
      fixture = TestBed.createComponent(TelegramSettingsComponent);
      const pending = new Subject<{ notify: boolean }>();
      service.setNotify.mockReturnValue(pending);
      fixture.componentInstance.setNotify(true);
      jest.advanceTimersByTime(30_000);
      expect(service.load).toHaveBeenCalledTimes(1);
      pending.next({ notify: true });
      pending.complete();
      expect(service.load).toHaveBeenCalledTimes(2);
      jest.advanceTimersByTime(10_000);
      expect(service.load).toHaveBeenCalledTimes(3);
    } finally {
      fixture.destroy();
      jest.useRealTimers();
    }
  });

  it.each(['#telegram-invite-label', '#telegram-rename-abc'])(
    'keeps %s focused and editable during a healthy background refresh',
    (selector) => {
      fixture.destroy();
      jest.useFakeTimers();
      try {
        fixture = TestBed.createComponent(TelegramSettingsComponent);
        const component = fixture.componentInstance;
        component.beginRename('abc', 'Boris');
        component.inviteLabel.setValue('Draft invitation');
        fixture.detectChanges();
        const root = fixture.nativeElement as HTMLElement;
        document.body.appendChild(root);
        const input = root.querySelector<HTMLInputElement>(selector)!;
        input.focus();
        const pending = new Subject<TelegramSettings>();
        service.load.mockClear().mockReturnValue(pending);

        jest.advanceTimersByTime(10_000);
        fixture.detectChanges();
        expect(input.matches(':disabled')).toBe(false);
        expect(root.querySelector<HTMLInputElement>('#telegram-enabled')!.disabled).toBe(false);
        expect(document.activeElement).toBe(input);
        input.value = 'Still typing';
        input.dispatchEvent(new Event('input'));
        jest.advanceTimersByTime(20_000);
        expect(service.load).toHaveBeenCalledTimes(1);
        pending.next({
          ...SETTINGS,
          connections: SETTINGS.connections.map((connection) => ({ ...connection })),
        });
        pending.complete();
        fixture.detectChanges();
        expect(root.querySelector(selector)).toBe(input);
        expect(document.activeElement).toBe(input);
        expect(input.value).toBe('Still typing');
      } finally {
        fixture.nativeElement.remove();
        fixture.destroy();
        jest.useRealTimers();
      }
    },
  );

  it.each(['preference', 'invitation'] as const)(
    'cancels a background refresh before saving a %s and ignores its late stale response',
    (operation) => {
      fixture.destroy();
      jest.useFakeTimers();
      try {
        service.load.mockClear().mockReturnValue(of(SETTINGS));
        fixture = TestBed.createComponent(TelegramSettingsComponent);
        fixture.detectChanges();
        const component = fixture.componentInstance;
        const background = new Subject<TelegramSettings>();
        service.load.mockReturnValue(background);
        jest.advanceTimersByTime(10_000);
        expect(background.observed).toBe(true);
        const mutation = new Subject<unknown>();
        const refresh = new Subject<TelegramSettings>();
        service.load.mockReturnValue(refresh);
        if (operation === 'preference') {
          service.setNotify.mockReturnValue(mutation);
          component.setNotify(true);
        } else {
          service.createInvitation.mockReturnValue(mutation);
          component.inviteLabel.setValue('Family');
          component.createInvitation();
        }
        expect(background.observed).toBe(false);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('#telegram-enabled').disabled).toBe(true);
        background.next({ ...SETTINGS, status: 'failed' });
        expect(component.settings()?.status).toBe('ready');
        // Both mutation APIs emit their response before completing, then trigger a foreground GET.
        mutation.next(
          operation === 'preference'
            ? { notify: true }
            : { url: 'https://t.me/shared_bot?start=secret', expiresAt: '2026-09-26T12:15:00Z' },
        );
        mutation.complete();
        expect(service.load).toHaveBeenCalledTimes(3);
        expect(refresh.observed).toBe(true);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('#telegram-enabled').disabled).toBe(true);
        refresh.next({ ...SETTINGS, notify: true });
        refresh.complete();
        background.next(SETTINGS);
        background.error(new Error('late failure'));
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('#telegram-notify').checked).toBe(true);
        expect(fixture.nativeElement.querySelector('#telegram-enabled').disabled).toBe(false);
        expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
      } finally {
        fixture.destroy();
        jest.useRealTimers();
      }
    },
  );

  it('does not start polling without a browser document', fakeAsync(() => {
    fixture.destroy();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [TelegramSettingsComponent],
      providers: [
        provideI18nTesting(),
        { provide: TelegramSettingsService, useValue: service },
        { provide: DOCUMENT, useValue: { defaultView: null } },
      ],
    });
    service.load.mockClear();
    const serverComponent = TestBed.runInInjectionContext(() => new TelegramSettingsComponent());
    tick(30_000);
    expect(service.load).toHaveBeenCalledTimes(1);
    expect(serverComponent.settings()?.status).toBe('ready');
  }));

  it('shows a newly generated one-time link only after creation', () => {
    const component = fixture.componentInstance;
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('#telegram-invite-link')).toBeNull();
    component.inviteLabel.setValue('Family');
    element.querySelector<HTMLButtonElement>('#telegram-create-invite')!.click();
    fixture.detectChanges();
    expect(service.createInvitation).toHaveBeenCalledWith('Family');
    expect(element.querySelector<HTMLAnchorElement>('#telegram-invite-link')?.href).toBe(
      'https://t.me/shared_bot?start=secret',
    );
  });

  it('approves a pending request and refreshes the list', () => {
    const element: HTMLElement = fixture.nativeElement;
    element.querySelector<HTMLButtonElement>('#telegram-approve-abc')!.click();
    fixture.detectChanges();
    expect(service.changeState).toHaveBeenCalledWith('abc', 'approve');
    expect(service.load).toHaveBeenCalledTimes(2);
  });

  it('reports a failed invitation without exposing an old link', () => {
    service.createInvitation.mockReturnValue(throwError(() => new Error('offline')));
    const component = fixture.componentInstance;
    const element: HTMLElement = fixture.nativeElement;
    component.inviteLabel.setValue('Family');
    element.querySelector<HTMLButtonElement>('#telegram-create-invite')!.click();
    fixture.detectChanges();
    expect(element.querySelector('#telegram-invite-link')).toBeNull();
    expect(element.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('keeps the label editor open when renaming fails', () => {
    service.rename.mockReturnValue(throwError(() => new Error('offline')));
    const component = fixture.componentInstance;
    component.beginRename('abc', 'Boris');
    component.editLabel.setValue('Family');

    component.rename('abc');
    fixture.detectChanges();

    expect(component.editingId()).toBe('abc');
    expect(component.editLabel.value).toBe('Family');
    expect(fixture.nativeElement.querySelector('#telegram-rename-abc')).not.toBeNull();
  });

  it('keeps notification selections available after a failed save', () => {
    service.updateConnectionSettings.mockReturnValue(throwError(() => new Error('offline')));
    const component = fixture.componentInstance;
    component.beginEditNotifications(SETTINGS.connections[0]);
    component.updateNotificationDraft({ notifyBirthday: true, language: 'ru' });
    component.saveNotifications();
    fixture.detectChanges();
    expect(component.notificationDraft()?.notifyBirthday).toBe(true);
    expect(component.notificationDraft()?.language).toBe('ru');
    expect(fixture.nativeElement.querySelector('#telegram-notify-birthday')).not.toBeNull();
  });

  it('keeps finance subscriptions independent and disables them while saving', () => {
    const response = new Subject();
    service.updateConnectionSettings.mockReturnValue(response);
    const component = fixture.componentInstance;
    component.beginEditNotifications(SETTINGS.connections[0]);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const transaction = root.querySelector<HTMLInputElement>('#telegram-finance-transaction')!;
    const limit = root.querySelector<HTMLInputElement>('#telegram-finance-limit')!;
    transaction.click();
    component.saveNotifications();
    fixture.detectChanges();
    expect(service.updateConnectionSettings).toHaveBeenCalledWith(
      'abc',
      expect.objectContaining({
        notifyFinanceTransaction: true,
        notifyFinanceLimit: false,
      }),
    );
    expect(transaction.disabled).toBe(true);
    expect(limit.disabled).toBe(true);
    response.error(new Error('offline'));
    fixture.detectChanges();
    expect(component.notificationDraft()?.notifyFinanceTransaction).toBe(true);
    expect(component.notificationDraft()?.notifyFinanceLimit).toBe(false);
    expect(transaction.disabled).toBe(false);
    expect(root.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('saves all notification settings together and closes the editor', () => {
    const component = fixture.componentInstance;
    component.beginEditNotifications(SETTINGS.connections[0]);
    component.updateNotificationDraft({
      notifyBirthday: true,
      notifyMemorableDate: true,
      notifyFinanceTransaction: true,
      notifyFinanceLimit: true,
      language: 'ru',
    });
    component.saveNotifications();
    fixture.detectChanges();

    expect(service.updateConnectionSettings).toHaveBeenCalledWith('abc', {
      notifyBirthday: true,
      notifyMemorableDate: true,
      notifyFinanceTransaction: true,
      notifyFinanceLimit: true,
      language: 'ru',
    });
    expect(component.notificationDraft()).toBeNull();
    expect(service.load).toHaveBeenCalledTimes(2);
  });
});
