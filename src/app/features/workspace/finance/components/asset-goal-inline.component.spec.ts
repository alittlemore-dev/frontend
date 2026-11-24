import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UnsavedChangesService } from '../../../../core/unsaved-changes/unsaved-changes.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { FINANCE_TEST_MONTH } from '../testing/finance-fixtures';
import { AssetGoalInlineComponent } from './asset-goal-inline.component';

describe('AssetGoalInlineComponent', () => {
  const url = '/api/personal-workspace/finance/assets/goals/';
  let fixture: ComponentFixture<AssetGoalInlineComponent>;
  let http: HttpTestingController;
  const requestFor = (month: string) =>
    http.expectOne((r) => r.method === 'PUT' && r.url.endsWith(url + month));
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const percent = (): HTMLInputElement => root().querySelector('#asset-goal-percent')!;
  const type = (input: HTMLInputElement, value: string): void => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const enter = (): void => {
    percent().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AssetGoalInlineComponent],
      providers: [provideI18nTesting(), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(AssetGoalInlineComponent);
    fixture.componentRef.setInput('selectedMonth', '2026-09-01');
    fixture.componentRef.setInput('month', FINANCE_TEST_MONTH);
    fixture.componentRef.setInput('goal', {
      month: '2026-08-01',
      percent: '10.00',
      allIncome: false,
      categoryIds: ['stable-salary'],
    });
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  it('saves the percent once from the summary and keeps the income rule for the selected month', () => {
    expect(percent().value).toBe('10');
    type(percent(), '12,50');
    enter();
    percent().dispatchEvent(new FocusEvent('blur'));
    const request = requestFor('2026-09');
    expect(request.request.body).toEqual({
      percent: '12.5',
      allIncome: false,
      categoryIds: ['stable-salary'],
    });
    expect(root().querySelector('fieldset')?.disabled).toBe(true);
    request.flush({});
    fixture.detectChanges();
    expect(percent().value).toBe('12.5');
    expect(TestBed.inject(UnsavedChangesService).hasChanges()).toBe(false);
  });

  it('normalizes an equivalent value without writing a new goal version', () => {
    type(percent(), '10,00');
    enter();
    expect(percent().value).toBe('10');
    expect(TestBed.inject(UnsavedChangesService).hasChanges()).toBe(false);
    http.expectNone((r) => r.method === 'PUT');
  });

  it('preserves the draft after a failed blur save and accepts an explicit retry', () => {
    type(percent(), '15');
    percent().dispatchEvent(new FocusEvent('blur'));
    requestFor('2026-09').flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(root().querySelector('[role="alert"]')).not.toBeNull();
    expect(percent().value).toBe('15');
    enter();
    requestFor('2026-09').flush({});
    fixture.detectChanges();
    expect(root().querySelector('[role="alert"]')).toBeNull();
  });

  it('rejects an out-of-range value and restores the last saved percent with Escape', () => {
    type(percent(), '100.01');
    enter();
    expect(percent().getAttribute('aria-invalid')).toBe('true');
    expect(TestBed.inject(UnsavedChangesService).hasChanges()).toBe(true);
    percent().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    percent().dispatchEvent(new FocusEvent('blur'));
    expect(percent().value).toBe('10');
    expect(TestBed.inject(UnsavedChangesService).hasChanges()).toBe(false);
    http.expectNone((r) => r.url.endsWith(url + '2026-09'));
  });

  it('keeps an unavailable income category when only the overview percent changes', () => {
    fixture.componentRef.setInput('goal', {
      month: '2026-08-01',
      percent: '10',
      allIncome: false,
      categoryIds: ['removed-category'],
    });
    fixture.detectChanges();
    type(percent(), '14');
    enter();
    const request = requestFor('2026-09');
    expect(request.request.body).toEqual({
      percent: '14',
      allIncome: false,
      categoryIds: ['removed-category'],
    });
    request.flush({});
  });

  it('can set a zero goal on an empty portfolio and refresh to the next selected month', () => {
    fixture.componentRef.setInput('goal', null);
    fixture.detectChanges();
    expect(percent().value).toBe('');
    percent().dispatchEvent(new FocusEvent('blur'));
    http.expectNone((r) => r.url.endsWith(url + '2026-09'));
    type(percent(), '0');
    enter();
    const request = requestFor('2026-09');
    expect(request.request.body).toEqual({ percent: '0', allIncome: true, categoryIds: [] });
    request.flush({});
    fixture.componentRef.setInput('selectedMonth', '2026-10-01');
    fixture.detectChanges();
    expect(percent().value).toBe('');
  });
});
