import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { FINANCE_TEST_MONTH } from '../testing/finance-fixtures';
import { AssetGoalSettingsComponent } from './asset-goal-settings.component';

describe('AssetGoalSettingsComponent', () => {
  const goals = '/finance/assets/goals';
  let fixture: ComponentFixture<AssetGoalSettingsComponent>;
  let http: HttpTestingController;
  let view: HTMLElement;
  const rule = (month: string) =>
    http.expectOne((r) => r.url.endsWith(goals) && r.params.get('month') === month);

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AssetGoalSettingsComponent],
      providers: [provideI18nTesting(), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(AssetGoalSettingsComponent);
    fixture.componentRef.setInput('month', FINANCE_TEST_MONTH);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    view = fixture.nativeElement as HTMLElement;
    view.querySelector('button')!.click();
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  it('lets the user remove an unavailable income category and choose an active one', () => {
    rule('2026-09').flush({
      goal: { month: '2026-06-01', percent: '12', allIncome: false, categoryIds: ['retired'] },
    });
    fixture.detectChanges();
    const checkbox = (name: string): HTMLInputElement => {
      const label = [...view.querySelectorAll('label')].find((item) =>
        item.textContent?.includes(name),
      );
      return label!.querySelector('input')!;
    };
    const keep = checkbox('finance.assets.keepUnavailableGoalCategories');
    expect(keep.checked).toBe(true);
    keep.click();
    checkbox('Зарплата').click();
    fixture.detectChanges();
    view.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    const save = http.expectOne((r) => r.method === 'PUT' && r.url.endsWith(goals + '/2026-09'));
    expect(save.request.body).toEqual({
      percent: '12',
      allIncome: false,
      categoryIds: ['stable-salary'],
    });
    save.flush({});
  });

  it('keeps the draft while the start year is invalid and lets the user correct it', () => {
    rule('2026-09').flush({ goal: null });
    fixture.detectChanges();
    const percent = view.querySelector<HTMLInputElement>('#asset-goal-percent')!;
    percent.value = '18';
    percent.dispatchEvent(new Event('input'));
    const year = view.querySelector<HTMLInputElement>('#asset-goal-year')!;
    year.value = '20';
    year.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(year.getAttribute('aria-invalid')).toBe('true');
    expect(percent.matches(':disabled')).toBe(true);
    year.value = '2026';
    year.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(percent.matches(':disabled')).toBe(false);
    expect(percent.value).toBe('18');
    http.expectNone((r) => r.url.endsWith(goals));
  });
});
