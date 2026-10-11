import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { AdminActiveFiltersComponent } from './admin-active-filters.component';

it('names each applied constraint and emits only the selected filter key', () => {
  TestBed.configureTestingModule({
    imports: [AdminActiveFiltersComponent],
    providers: [provideI18nTesting()],
  });
  const fixture = TestBed.createComponent(AdminActiveFiltersComponent);
  fixture.componentRef.setInput('filters', [{ key: 'grade', label: 'Grade', value: 'Senior' }]);
  const removed = jest.fn();
  fixture.componentInstance.filterRemoved.subscribe(removed);
  fixture.detectChanges();
  const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
  expect(button.textContent).toContain('Grade: Senior');
  button.click();
  expect(removed).toHaveBeenCalledWith('grade');
});
