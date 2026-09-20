import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { BehaviorSubject } from 'rxjs';
import { Component, WritableSignal, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AccountInfo } from '../../../../core/auth/account.model';
import { AuthService } from '../../../../core/auth/auth.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { AdminPanelPageComponent } from './admin-panel-page.component';

@Component({
  standalone: true,
  template: '',
})
class EmptyRouteComponent {}

describe('AdminPanelPageComponent', () => {
  let fixture: ComponentFixture<AdminPanelPageComponent>;
  let currentUser: WritableSignal<AccountInfo | null>;
  let isAdmin: WritableSignal<boolean>;
  let isOwner: WritableSignal<boolean>;
  let canManageContent: WritableSignal<boolean>;
  let canManageTeam: WritableSignal<boolean>;
  let isLoggedIn: WritableSignal<boolean>;
  let router: Router;
  let viewport: BehaviorSubject<BreakpointState>;

  beforeEach(async () => {
    viewport = new BehaviorSubject<BreakpointState>({ matches: false, breakpoints: {} });
    currentUser = signal({ username: 'admin', role: 'admin' });
    isAdmin = signal(true);
    isOwner = signal(false);
    canManageContent = signal(true);
    canManageTeam = signal(true);
    isLoggedIn = signal(true);
    await TestBed.configureTestingModule({
      imports: [AdminPanelPageComponent],
      providers: [
        provideRouter([{ path: '**', component: EmptyRouteComponent }]),
        provideI18nTesting(),
        { provide: BreakpointObserver, useValue: { observe: () => viewport } },
        {
          provide: AuthService,
          useValue: {
            currentUser,
            isAdmin,
            isOwner,
            canManageContent,
            canManageTeam,
            isLoggedIn,
          },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    await router.navigateByUrl('/admin-panel/dashboard');
    fixture = TestBed.createComponent(AdminPanelPageComponent);
    fixture.detectChanges();
  });

  it('renders only retained navigation sections and pages for administrators', () => {
    const sections = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="admin-panel-tree-section"]'),
    ) as HTMLButtonElement[];
    const items = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="admin-panel-tree-item"]'),
    ) as HTMLButtonElement[];

    expect(sections.map((section) => section.textContent?.trim().replace(/^[-+]\s*/, ''))).toEqual([
      'Рабочая область1',
      'Статьи4',
      'Матрица3',
    ]);
    expect(items.map((item) => item.textContent?.trim())).toEqual([
      'Дашборд',
      '+--Команда',
      '+--Статьи',
      '+--Папки',
      '+--Теги',
      '+--Статистика',
      '+--Вопросы',
      '+--Структура',
      '+--Очередь вопросов',
    ]);
  });

  it('hides team workspace navigation from non-team content managers', () => {
    isAdmin.set(false);
    canManageTeam.set(false);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Рабочая область');
    expect(fixture.nativeElement.textContent).not.toContain('Команда');
    expect(fixture.nativeElement.textContent).toContain('Вопросы');
    expect(fixture.nativeElement.textContent).toContain('Дашборд');
  });

  it('shows owner-only agent client navigation without retired pages', () => {
    currentUser.set({ username: 'owner', role: 'owner' });
    isAdmin.set(false);
    isOwner.set(true);
    canManageTeam.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Рабочая область');
    expect(fixture.nativeElement.textContent).toContain('Команда');
    expect(fixture.nativeElement.textContent).toContain('AI-агенты');
    expect(fixture.nativeElement.textContent).not.toContain('Резюме');
    expect(fixture.nativeElement.textContent).not.toContain('База знаний');
  });

  it('renders Dashboard as a root tree item with page semantics', () => {
    const dashboard = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="admin-panel-tree-item"]'),
    ).find((item) => item.textContent?.trim() === 'Дашборд') as HTMLButtonElement;

    expect(dashboard.classList).toContain('foldable-tree-item-success');
    expect(dashboard.getAttribute('aria-current')).toBe('page');
  });

  it('derives the selected retained page from a detail URL', async () => {
    await router.navigateByUrl('/admin-panel/articles/example');
    fixture.detectChanges();

    const articles = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="admin-panel-tree-item"]'),
    ).find((item) => item.textContent?.trim() === '+--Статьи') as HTMLButtonElement;

    expect(articles.getAttribute('aria-current')).toBe('page');
  });

  it('closes the DS mobile drawer after selecting an allowed admin page', async () => {
    const dialog = openDrawer();
    const item = Array.from(
      fixture.nativeElement.querySelectorAll('ds-drawer [data-testid="admin-panel-tree-item"]'),
    ).find((candidate) =>
      (candidate as HTMLElement).textContent?.includes('Команда'),
    ) as HTMLButtonElement;
    item.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toBe('/admin-panel/workspace/team');
    expect(dialog.open).toBe(false);
    expect(fixture.nativeElement.querySelector('aside')).not.toBeNull();
  });

  it('ends mobile modality when returning to desktop layout', () => {
    const dialog = openDrawer();
    viewport.next({ matches: true, breakpoints: {} });
    fixture.detectChanges();
    expect(dialog.open).toBe(false);
    expect(fixture.nativeElement.querySelector('aside')).not.toBeNull();
  });

  function openDrawer(): HTMLDialogElement {
    const dialog = fixture.nativeElement.querySelector('ds-drawer dialog') as HTMLDialogElement;
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => dialog.removeAttribute('open');
    (
      fixture.nativeElement.querySelector(
        '[data-testid="admin-panel-side-panel-toggle"]',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(dialog.open).toBe(true);
    return dialog;
  }
});
