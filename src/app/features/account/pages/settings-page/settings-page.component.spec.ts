import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { AccountSettingsService } from '../../../../core/auth/account-settings.service';
import { AccountSettings } from '../../../../core/auth/account.model';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { SettingsPageComponent } from './settings-page.component';

describe('SettingsPageComponent', () => {
  let fixture: ComponentFixture<SettingsPageComponent>;
  const settings = signal<AccountSettings>({ language: 'en', theme: 'light' });
  const preferences = { settings, saving: signal(false), load: jest.fn(), update: jest.fn() };
  beforeEach(async () => {
    settings.set({ language: 'en', theme: 'light' });
    preferences.saving.set(false);
    preferences.load.mockReset().mockReturnValue(of({}));
    preferences.update.mockReset().mockReturnValue(of({}));
    await TestBed.configureTestingModule({
      imports: [SettingsPageComponent],
      providers: [provideI18nTesting(), { provide: AccountSettingsService, useValue: preferences }],
    }).compileComponents();
  });
  function create(): HTMLElement {
    fixture = TestBed.createComponent(SettingsPageComponent);
    fixture.detectChanges();
    return fixture.nativeElement;
  }
  function selectOption(el: HTMLElement, id: string, label: string): void {
    el.querySelector<HTMLButtonElement>(`#${id}`)!.click();
    fixture.detectChanges();
    const option = [...el.querySelectorAll<HTMLElement>('[role="option"]')].find(
      (item) => item.textContent?.trim() === label,
    );
    expect(option).toBeDefined();
    option!.click();
    fixture.detectChanges();
  }
  it('loads fresh preferences and saves the full object when language changes', () => {
    const el = create();
    selectOption(el, 'settings-language', 'Русский');
    expect(preferences.load).toHaveBeenCalledTimes(1);
    expect(preferences.update).toHaveBeenCalledWith({ language: 'ru', theme: 'light' });
  });
  it('switches tabs and saves a dark theme', () => {
    const el = create();
    el.querySelector<HTMLButtonElement>('#settings-tab-appearance')!.click();
    fixture.detectChanges();
    expect(el.querySelector('#settings-tab-appearance')!.getAttribute('aria-selected')).toBe(
      'true',
    );
    selectOption(el, 'settings-theme', 'Dark');
    expect(preferences.update).toHaveBeenCalledWith({ language: 'en', theme: 'dark' });
  });
  it('restores the confirmed selection and reports a failed save', () => {
    preferences.update.mockReturnValue(throwError(() => new Error('offline')));
    const el = create();
    selectOption(el, 'settings-language', 'Русский');
    fixture.detectChanges();
    expect(el.querySelector('#settings-language')?.textContent).toContain('English');
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
  });
  it('shows loading and offers retry after a failed load', () => {
    const response = new Subject<unknown>();
    preferences.load.mockReturnValueOnce(response);
    const el = create();
    expect(el.querySelector('[role="status"]')).not.toBeNull();
    response.error(new Error('offline'));
    fixture.detectChanges();
    expect(el.querySelector('[role="combobox"]')).toBeNull();
    el.querySelector<HTMLButtonElement>('[role="alert"] button')!.click();
    fixture.detectChanges();
    expect(preferences.load).toHaveBeenCalledTimes(2);
    expect(el.querySelector('[role="combobox"]')).not.toBeNull();
  });
});
