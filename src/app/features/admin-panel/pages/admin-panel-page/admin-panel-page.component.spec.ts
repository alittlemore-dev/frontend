import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { BehaviorSubject } from 'rxjs';
import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { AdminPanelPageComponent } from './admin-panel-page.component';
@Component({ template: '' })
class EmptyRouteComponent {}
describe('AdminPanelPageComponent', () => {
  let fixture: ComponentFixture<AdminPanelPageComponent>;
  let viewport: BehaviorSubject<BreakpointState>;
  const canManageTeam = signal(true);
  const isOwner = signal(false);
  let router: Router;
  beforeEach(async () => {
    localStorage.clear();
    canManageTeam.set(true);
    isOwner.set(false);
    viewport = new BehaviorSubject<BreakpointState>({ matches: true, breakpoints: {} });
    await TestBed.configureTestingModule({
      imports: [AdminPanelPageComponent],
      providers: [
        provideI18nTesting(),
        { provide: BreakpointObserver, useValue: { observe: () => viewport } },
        { provide: AuthService, useValue: { canManageTeam, isOwner } },
        provideRouter([
          {
            path: 'admin-panel/articles/:slug',
            component: EmptyRouteComponent,
            data: { adminDetail: true },
          },
          { path: '**', component: EmptyRouteComponent },
        ]),
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    await router.navigateByUrl('/admin-panel/dashboard');
    fixture = TestBed.createComponent(AdminPanelPageComponent);
    fixture.detectChanges();
  });
  afterEach(() => {
    fixture.destroy();
    localStorage.clear();
  });
  function toggle(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('ds-sidebar button');
  }
  function link(path: string): HTMLAnchorElement | null {
    return fixture.nativeElement.querySelector(`nav a[href="${path}"]`);
  }
  it('keeps role-scoped team navigation', () => {
    expect(link('/admin-panel/workspace/team')).not.toBeNull();
    canManageTeam.set(false);
    fixture.detectChanges();
    expect(link('/admin-panel/workspace/team')).toBeNull();
    expect(link('/admin-panel/articles')).not.toBeNull();
    isOwner.set(true);
    canManageTeam.set(true);
    fixture.detectChanges();
    expect(link('/admin-panel/workspace/team')).not.toBeNull();
  });
  it('marks dashboard and follows a section link on the first click', async () => {
    expect(link('/admin-panel/dashboard')?.getAttribute('aria-current')).toBe('page');
    link('/admin-panel/articles')?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toBe('/admin-panel/articles');
    expect(link('/admin-panel/articles')?.getAttribute('aria-current')).toBe('page');
  });
  it('uses the same inline panel after collapse and reopen', () => {
    const panel = fixture.nativeElement.querySelector('#admin-panel-sections');
    const control = toggle();
    control.focus();
    control.click();
    fixture.detectChanges();
    expect(panel.hidden).toBe(true);
    expect(document.activeElement).toBe(control);
    expect(localStorage.getItem('adminNavigationCollapsed')).toBe('true');
    control.click();
    fixture.detectChanges();
    expect(panel.hidden).toBe(false);
    expect(fixture.nativeElement.querySelector('#admin-panel-sections')).toBe(panel);
  });
  it('starts authoring compact and restores the collection preference on return', async () => {
    await router.navigateByUrl('/admin-panel/articles/example');
    fixture.detectChanges();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    toggle().click();
    fixture.detectChanges();
    expect(link('/admin-panel/articles')?.getAttribute('aria-current')).toBe('page');
    await router.navigateByUrl('/admin-panel/dashboard');
    fixture.detectChanges();
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
  });
  it('closes mobile sections after an allowed transition and restores desktop', async () => {
    viewport.next({ matches: false, breakpoints: {} });
    fixture.detectChanges();
    toggle().click();
    fixture.detectChanges();
    link('/admin-panel/workspace/team')?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toBe('/admin-panel/workspace/team');
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    viewport.next({ matches: true, breakpoints: {} });
    fixture.detectChanges();
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
  });
});
