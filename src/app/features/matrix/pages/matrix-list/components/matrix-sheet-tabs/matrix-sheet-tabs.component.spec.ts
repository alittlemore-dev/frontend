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
      { key: 'javascript', name: 'JavaScript' },
      { key: 'python', name: 'Python' },
    ]);
    fixture.componentRef.setInput('selectedSheetKey', 'javascript');
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  it('should render sheet buttons', () => {
    const buttons = el.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent?.trim()).toBe('JavaScript');
    expect(buttons[1].textContent?.trim()).toBe('Python');
  });

  it('should emit sheetSelected when a sheet button is clicked', () => {
    const emitted: string[] = [];
    fixture.componentInstance.sheetSelected.subscribe((s: string) => emitted.push(s));
    const buttons = el.querySelectorAll<HTMLButtonElement>('button');
    buttons[1].click();
    expect(emitted).toEqual(['python']);
  });
});
