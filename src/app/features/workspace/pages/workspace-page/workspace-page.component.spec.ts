import { AuthModalService } from '../../../../core/auth/auth-modal.service';
import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { WorkspacePageComponent } from './workspace-page.component';

@Component({ standalone: true, template: '' })
class EmptyRouteComponent {}

describe('WorkspacePageComponent', () => {
  let fixture: ComponentFixture<WorkspacePageComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkspacePageComponent],
      providers: [
        provideRouter([{ path: '**', component: EmptyRouteComponent }]),
        provideI18nTesting(),
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    await router.navigateByUrl('/personal-workspace');
    fixture = TestBed.createComponent(WorkspacePageComponent);
    fixture.detectChanges();
  });

  it('renders the retained dashboard, workspace, and knowledge navigation', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Дашборд');
    expect(text).toContain('Рабочая область');
    expect(text).toContain('Резюме');
    expect(text).toContain('База знаний');
    expect(text).toContain('Люди');
    expect(text).toContain('Даты');
  });

  it('marks the most specific navigation item for a detail URL', async () => {
    await router.navigateByUrl('/personal-workspace/knowledge/people/person-1');
    fixture.detectChanges();

    const peopleItem = navigationItem('Люди');
    const dashboardItem = navigationItem('Дашборд');

    expect(peopleItem.getAttribute('aria-current')).toBe('page');
    expect(dashboardItem.getAttribute('aria-current')).toBeNull();
  });

  it('closes the DS mobile drawer after navigating to a selected workspace page', async () => {
    const host = fixture.nativeElement as HTMLElement;
    const dialog = host.querySelector('ds-drawer dialog') as HTMLDialogElement;
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => dialog.removeAttribute('open');
    (
      host.querySelector('[data-testid="workspace-side-panel-toggle"]') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(dialog.open).toBe(true);
    navigationItem('Даты', 'ds-drawer').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(router.url).toBe('/personal-workspace/knowledge/dates');
    expect(dialog.open).toBe(false);
  });

  it('closes the mobile drawer when shared login opens', () => {
    const dialog = fixture.nativeElement.querySelector('ds-drawer dialog') as HTMLDialogElement;
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => dialog.removeAttribute('open');
    fixture.componentInstance.toggleSidePanel();
    fixture.detectChanges();
    expect(dialog.open).toBe(true);
    TestBed.inject(AuthModalService).openLogin({
      required: true,
      account: { username: 'owner', role: 'owner' },
    });
    fixture.detectChanges();
    expect(dialog.open).toBe(false);
  });

  function navigationItem(label: string, parent = 'aside'): HTMLButtonElement {
    const item = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        `${parent} [data-testid="workspace-tree-item"]`,
      ),
    ).find((candidate) => candidate.textContent?.includes(label));
    if (item === undefined) {
      throw new Error(`Missing navigation item: ${label}`);
    }
    return item;
  }
});
