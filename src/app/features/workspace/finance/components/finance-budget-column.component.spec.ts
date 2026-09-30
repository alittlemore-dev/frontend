import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { FINANCE_TEST_MONTH } from '../testing/finance-fixtures';
import { FinanceBudgetColumnComponent } from './finance-budget-column.component';

describe('FinanceBudgetColumnComponent', () => {
  let fixture: ComponentFixture<FinanceBudgetColumnComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FinanceBudgetColumnComponent],
      providers: [provideI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(FinanceBudgetColumnComponent);
    fixture.componentRef.setInput('kind', 'expense');
    fixture.componentRef.setInput('month', FINANCE_TEST_MONTH);
    fixture.componentRef.setInput('categories', [FINANCE_TEST_MONTH.categories[0]]);
    fixture.componentRef.setInput('drafts', { food: { name: 'Food', plan: '' } });
    fixture.componentRef.setInput('newCategoryDraft', { name: '', plan: '' });
    fixture.componentRef.setInput('saving', false);
    fixture.detectChanges();
  });

  it('emits inline changes and save on blur without a separate edit button', () => {
    const changed = jest.fn();
    const saved = jest.fn();
    fixture.componentInstance.draftChanged.subscribe(changed);
    fixture.componentInstance.saved.subscribe(saved);
    const input = fixture.nativeElement.querySelector('.finance-name-input') as HTMLInputElement;
    input.value = 'Groceries';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('blur'));
    expect(changed).toHaveBeenCalledWith({
      category: FINANCE_TEST_MONTH.categories[0],
      field: 'name',
      value: 'Groceries',
    });
    expect(saved).toHaveBeenCalledWith(FINANCE_TEST_MONTH.categories[0]);
  });
});
