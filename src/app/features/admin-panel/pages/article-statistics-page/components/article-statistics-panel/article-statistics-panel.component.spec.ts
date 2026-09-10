import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LocalizedDatePickerLabels } from '../../../../../../shared/ui/localized-date-picker/localized-date-picker.component';
import { provideI18nTesting } from '../../../../../../testing/i18n-testing';
import { AdminArticleStatisticsPanelComponent } from './article-statistics-panel.component';

const DATE_PICKER_LABELS: LocalizedDatePickerLabels = {
  placeholder: 'дд.мм.гггг',
  openCalendar: 'Открыть календарь',
  changeCalendar: 'Изменить дату',
  dialog: 'Выбор даты',
  previousMonth: 'Предыдущий месяц',
  nextMonth: 'Следующий месяц',
  openMonthYearPicker: 'Выбрать месяц и год',
  previousYear: 'Предыдущий год',
  nextYear: 'Следующий год',
  clear: 'Очистить',
  close: 'Закрыть',
  formatHint: 'Формат даты: ДД.ММ.ГГГГ',
  invalidDate: 'Введите корректную дату в формате ДД.ММ.ГГГГ.',
  requiredDate: 'Укажите дату.',
  keyboardHelp: 'Используйте стрелки для выбора даты.',
};

describe('AdminArticleStatisticsPanelComponent', () => {
  let fixture: ComponentFixture<AdminArticleStatisticsPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminArticleStatisticsPanelComponent],
      providers: [provideI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminArticleStatisticsPanelComponent);
    fixture.componentRef.setInput('dateFrom', '2026-01-01');
    fixture.componentRef.setInput('dateTo', '2026-01-31');
    fixture.componentRef.setInput('dateLocale', 'ru-RU');
    fixture.componentRef.setInput('datePickerLabels', DATE_PICKER_LABELS);
  });

  it('renders totals and article rows', () => {
    fixture.componentRef.setInput('stats', {
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
      totals: { viewCount: 7, engagedViewCount: 3, reactionCount: 2 },
      articles: [
        {
          articleId: '00000000000000000000000000000001',
          title: 'Typed articles',
          slug: 'typed-articles',
          viewCount: 7,
          engagedViewCount: 3,
          reactionCounts: { heart: 1, fire: 0, thinking: 1, neutral: 0, poop: 0 },
        },
      ],
      daily: [],
    });
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Просмотры: 7');
    expect(text).toContain('Typed articles');
  });

  it('emits date changes and refresh command', () => {
    const dateFromChange = jest.fn();
    const refresh = jest.fn();
    fixture.componentInstance.dateFromChange.subscribe(dateFromChange);
    fixture.componentInstance.refresh.subscribe(refresh);
    fixture.detectChanges();

    const dateInput = fixture.debugElement.query(By.css('input[type="text"]'))
      .nativeElement as HTMLInputElement;
    dateInput.value = '02/01/2026';
    dateInput.dispatchEvent(new Event('input'));
    fixture.debugElement
      .query(By.css('[data-testid="admin-article-statistics-refresh"]'))
      .nativeElement.click();

    expect(dateFromChange).toHaveBeenCalledWith('2026-01-02');
    expect(refresh).toHaveBeenCalled();
  });

  it('marks empty required dates invalid and does not refresh statistics', () => {
    fixture.componentRef.setInput('dateFrom', '');
    const refresh = jest.fn();
    fixture.componentInstance.refresh.subscribe(refresh);
    fixture.detectChanges();

    fixture.debugElement
      .query(By.css('[data-testid="admin-article-statistics-refresh"]'))
      .nativeElement.click();
    fixture.detectChanges();

    const dateFromInput = fixture.debugElement.query(By.css('#adminArticleStatsDateFrom'))
      .nativeElement as HTMLInputElement;

    expect(refresh).not.toHaveBeenCalled();
    expect(dateFromInput.required).toBe(true);
    expect(dateFromInput.getAttribute('aria-invalid')).toBe('true');
    expect(dateFromInput.classList).toContain('is-invalid');
  });

  it('does not refresh statistics while a date picker contains invalid manual input', () => {
    const refresh = jest.fn();
    fixture.componentInstance.refresh.subscribe(refresh);
    fixture.detectChanges();
    const dateFromInput = fixture.debugElement.query(By.css('#adminArticleStatsDateFrom'))
      .nativeElement as HTMLInputElement;
    dateFromInput.value = '31.02.2026';
    dateFromInput.dispatchEvent(new Event('input'));
    dateFromInput.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    fixture.debugElement
      .query(By.css('[data-testid="admin-article-statistics-refresh"]'))
      .nativeElement.click();
    fixture.detectChanges();

    expect(refresh).not.toHaveBeenCalled();
    expect(dateFromInput.getAttribute('aria-invalid')).toBe('true');
  });

  it('renders localized date pickers with calendar buttons', () => {
    fixture.detectChanges();

    const inputs = fixture.debugElement
      .queryAll(By.css('input[type="text"]'))
      .map((input) => input.nativeElement as HTMLInputElement);

    expect(inputs).toHaveLength(2);
    expect(inputs[0].value).toBe('01.01.2026');
    expect(inputs[1].value).toBe('31.01.2026');
    expect(inputs[0].classList).toContain('form-control-sm');
    expect(
      fixture.debugElement.queryAll(By.css('[data-testid="date-picker-toggle"]')),
    ).toHaveLength(2);

    fixture.debugElement.query(By.css('[data-testid="date-picker-toggle"]')).nativeElement.click();
    fixture.detectChanges();

    const monthYearToggle = fixture.debugElement.query(
      By.css('[data-testid="date-picker-month-year-toggle"]'),
    ).nativeElement as HTMLButtonElement;
    expect(monthYearToggle.getAttribute('aria-label')).toBe('Выбрать месяц и год');
  });
});
