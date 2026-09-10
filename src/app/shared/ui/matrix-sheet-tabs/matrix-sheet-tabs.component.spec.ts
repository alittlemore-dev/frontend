import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatrixSheetTabsComponent } from './matrix-sheet-tabs.component';

describe('MatrixSheetTabsComponent', () => {
  let fixture: ComponentFixture<MatrixSheetTabsComponent>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatrixSheetTabsComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MatrixSheetTabsComponent);
    fixture.componentRef.setInput('sheets', [
      { key: 'python', name: 'Python' },
      { key: 'sql', name: 'SQL' },
    ]);
    fixture.componentRef.setInput('selectedSheetKey', 'python');
    fixture.componentRef.setInput('ariaLabel', 'Matrix sheets');
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  it('renders sheet tabs with an accessible tablist label', () => {
    const tablist = el.querySelector('[role="tablist"]');
    const tabs = el.querySelectorAll<HTMLButtonElement>('[role="tab"]');

    expect(tablist?.getAttribute('aria-label')).toBe('Matrix sheets');
    expect(tabs.length).toBe(2);
    expect(tabs[0].textContent?.trim()).toBe('Python');
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
  });

  it('emits selected sheet keys', () => {
    const emitted: string[] = [];
    fixture.componentInstance.sheetSelected.subscribe((key) => emitted.push(key));

    el.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].click();

    expect(emitted).toEqual(['sql']);
  });
});
