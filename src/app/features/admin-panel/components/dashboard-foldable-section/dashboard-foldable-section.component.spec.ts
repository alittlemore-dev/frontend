import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DashboardFoldableSectionComponent } from './dashboard-foldable-section.component';

describe('DashboardFoldableSectionComponent', () => {
  let fixture: ComponentFixture<DashboardFoldableSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardFoldableSectionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardFoldableSectionComponent);
    fixture.componentRef.setInput('sectionKey', 'dates');
    fixture.componentRef.setInput('title', 'Памятные даты');
    fixture.componentRef.setInput('summary', '2 даты · 3 дня рождения');
    fixture.componentRef.setInput('expanded', true);
    fixture.detectChanges();
  });

  it('renders an accessible toggle, summary, chevron, and controlled body', () => {
    const toggle = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    const body = fixture.nativeElement.querySelector(
      '[data-testid="dashboard-section-body-dates"]',
    ) as HTMLElement;

    expect(toggle.textContent).toContain('Памятные даты');
    expect(toggle.textContent).toContain('2 даты · 3 дня рождения');
    expect(toggle.querySelector('[data-testid="dashboard-section-chevron"]')).not.toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-controls')).toBe(body.id);
    expect(body.hidden).toBe(false);
  });

  it('emits the next expanded state and hides collapsed content', () => {
    const expandedChanges: boolean[] = [];
    fixture.componentInstance.expandedChange.subscribe((value) => expandedChanges.push(value));

    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    fixture.componentRef.setInput('expanded', false);
    fixture.detectChanges();

    expect(expandedChanges).toEqual([false]);
    expect(
      (
        fixture.nativeElement.querySelector(
          '[data-testid="dashboard-section-body-dates"]',
        ) as HTMLElement
      ).hidden,
    ).toBe(true);
  });
});
