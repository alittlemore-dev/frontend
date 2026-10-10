import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { AuthModalService } from '../../../../core/auth/auth-modal.service';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { WorkspacePageComponent } from './workspace-page.component';
import { workspaceRoutes } from '../../workspace.routes';
@Component({ template: '' })
class EmptyRouteComponent {}

describe('WorkspacePageComponent', () => {
  let fixture: ComponentFixture<WorkspacePageComponent>;
  let router: Router;
  let viewport: BehaviorSubject<BreakpointState>;
  beforeEach(async () => {
    localStorage.clear();
    viewport = new BehaviorSubject<BreakpointState>({ matches: true, breakpoints: {} });
    await TestBed.configureTestingModule({
      imports: [WorkspacePageComponent],
      providers: [
        provideRouter([
          {
            path: 'personal-workspace',
            children: workspaceRoutes[0].children?.map((route) => ({
              ...route,
              component: EmptyRouteComponent,
              loadComponent: undefined,
              canDeactivate: undefined,
            })),
          },
        ]),
        provideI18nTesting(),
        { provide: BreakpointObserver, useValue: { observe: () => viewport } },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    await router.navigateByUrl('/personal-workspace');
    fixture = TestBed.createComponent(WorkspacePageComponent);
    fixture.detectChanges();
  });
  afterEach(() => {
    fixture.destroy();
    localStorage.clear();
  });
  function toggle(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('ds-sidebar button');
  }
  function link(path: string): HTMLAnchorElement {
    return fixture.nativeElement.querySelector(`nav a[href="${path}"]`);
  }

  it('collapses and reopens the same inline panel and persists desktop preference', () => {
    const panel = fixture.nativeElement.querySelector('#workspace-sections');
    const control = toggle();
    control.focus();
    control.click();
    fixture.detectChanges();
    expect(panel.hidden).toBe(true);
    expect(control.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(control);
    expect(localStorage.getItem('workspaceNavigationCollapsed')).toBe('true');
    control.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#workspace-sections')).toBe(panel);
    expect(panel.hidden).toBe(false);
    expect(localStorage.getItem('workspaceNavigationCollapsed')).toBe('false');
  });
  it('restores a collapsed preference when recreating the workspace', () => {
    toggle().click();
    fixture.detectChanges();
    fixture.destroy();
    fixture = TestBed.createComponent(WorkspacePageComponent);
    fixture.detectChanges();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
  });
  it.each([
    '/personal-workspace/resumes/resume-1',
    '/personal-workspace/knowledge/people/person-1',
    '/personal-workspace/knowledge/dates/date-1',
  ])('starts detail %s compact and reopens inline access', async (url) => {
    await router.navigateByUrl(url);
    fixture.detectChanges();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    toggle().click();
    fixture.detectChanges();
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('nav a[aria-current="page"]')).not.toBeNull();
    await router.navigateByUrl('/personal-workspace');
    fixture.detectChanges();
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
  });
  it('marks the most specific link and navigates on the first click', async () => {
    link('/personal-workspace/knowledge/people').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toBe('/personal-workspace/knowledge/people');
    expect(link('/personal-workspace/knowledge/people').getAttribute('aria-current')).toBe('page');
    expect(link('/personal-workspace').getAttribute('aria-current')).toBeNull();
  });
  it('closes mobile navigation on selection without changing desktop preference', async () => {
    viewport.next({ matches: false, breakpoints: {} });
    fixture.detectChanges();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    toggle().click();
    fixture.detectChanges();
    link('/personal-workspace/knowledge/dates').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(router.url).toBe('/personal-workspace/knowledge/dates');
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(localStorage.getItem('workspaceNavigationCollapsed')).toBeNull();
    viewport.next({ matches: true, breakpoints: {} });
    fixture.detectChanges();
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
  });
  it('closes mobile sections when shared login opens', () => {
    viewport.next({ matches: false, breakpoints: {} });
    fixture.detectChanges();
    toggle().click();
    fixture.detectChanges();
    TestBed.inject(AuthModalService).openLogin({
      required: true,
      account: { username: 'owner', role: 'owner' },
    });
    fixture.detectChanges();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
  });
});
