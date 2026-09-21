import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { AccountPageComponent } from './account-page.component';

@Component({ standalone: true, template: '' })
class EmptyRouteComponent {}

describe('AccountPageComponent', () => {
  let fixture: ComponentFixture<AccountPageComponent>;
  let router: Router;
  let viewport: BehaviorSubject<BreakpointState>;

  beforeEach(async () => {
    viewport = new BehaviorSubject<BreakpointState>({ matches: false, breakpoints: {} });
    await TestBed.configureTestingModule({
      imports: [AccountPageComponent],
      providers: [
        provideRouter([{ path: '**', component: EmptyRouteComponent }]),
        provideI18nTesting({
          'account.title': 'Личный кабинет',
          'account.navigation': 'Разделы профиля',
          'account.profile.title': 'Профиль',
          'account.sidePanel.open': 'Открыть разделы',
          'account.sidePanel.close': 'Закрыть разделы',
        }),
        { provide: BreakpointObserver, useValue: { observe: () => viewport } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    await router.navigateByUrl('/account/me');
    fixture = TestBed.createComponent(AccountPageComponent);
    fixture.detectChanges();
  });

  it('renders a desktop side panel with Profile and Settings pages', () => {
    const aside = fixture.nativeElement.querySelector('[data-testid="account-side-panel"]');
    const links = aside.querySelectorAll('a');

    expect(aside).not.toBeNull();
    expect(links).toHaveLength(2);
    expect(links[0].textContent?.trim()).toBe('Профиль');
    expect(links[0].getAttribute('href')).toBe('/account/me');
    expect(links[1].getAttribute('href')).toBe('/account/settings');
    expect(links[0].getAttribute('aria-current')).toBe('page');
  });

  it('opens the same account navigation in a mobile drawer', () => {
    const dialog = fixture.nativeElement.querySelector('ds-drawer dialog') as HTMLDialogElement;
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => dialog.removeAttribute('open');

    (
      fixture.nativeElement.querySelector(
        '[data-testid="account-side-panel-toggle"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(dialog.open).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('ds-drawer a')).toHaveLength(2);
  });
});
