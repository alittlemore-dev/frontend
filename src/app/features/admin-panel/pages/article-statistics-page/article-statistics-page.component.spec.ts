import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { ApiError } from '../../../../core/models/api-error.model';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { AdminArticleStats } from '../../models/article-workspace.model';
import { ArticleWorkspaceService } from '../../services/article-workspace.service';
import { AdminArticleStatisticsPageComponent } from './article-statistics-page.component';

describe('AdminArticleStatisticsPageComponent', () => {
  let fixture: ComponentFixture<AdminArticleStatisticsPageComponent>;
  let service: {
    getAdminStats: jest.Mock;
  };
  let routeQueryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-06T12:00:00.000Z'));
    service = {
      getAdminStats: jest.fn().mockReturnValue(of(articleStats())),
    };
    routeQueryParams = new BehaviorSubject(convertToParamMap({}));
    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn().mockReturnValue('blob:article-statistics'),
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      value: jest.fn(),
    });
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    await TestBed.configureTestingModule({
      imports: [AdminArticleStatisticsPageComponent],
      providers: [
        provideRouter([]),
        provideI18nTesting(),
        { provide: ArticleWorkspaceService, useValue: service },
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: routeQueryParams.asObservable() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminArticleStatisticsPageComponent);
    jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    fixture.destroy();
  });

  it('loads the last 30 days of article statistics on open', () => {
    fixture.detectChanges();

    expect(service.getAdminStats).toHaveBeenCalledWith({
      dateFrom: '2026-06-06',
      dateTo: '2026-07-06',
      language: 'ru',
    });
    expect(fixture.nativeElement.textContent).toContain('Статистика');
    expect(fixture.nativeElement.textContent).toContain('Typed articles');
    expect(fixture.nativeElement.textContent).toContain('Просмотры: 7');
  });

  it('restores an explicit statistics range from the URL before loading', () => {
    routeQueryParams.next(convertToParamMap({ dateFrom: '2026-05-01', dateTo: '2026-05-31' }));

    fixture.detectChanges();

    expect(service.getAdminStats).toHaveBeenCalledTimes(1);
    expect(service.getAdminStats).toHaveBeenCalledWith({
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
      language: 'ru',
    });
  });

  it('updates the date range and refreshes statistics', () => {
    fixture.detectChanges();
    service.getAdminStats.mockClear();

    const fromInput = fixture.debugElement.query(By.css('#adminArticleStatsDateFrom'))
      .nativeElement as HTMLInputElement;
    fromInput.value = '01/07/2026';
    fromInput.dispatchEvent(new Event('input'));
    fixture.debugElement
      .query(By.css('[data-testid="admin-article-statistics-refresh"]'))
      .nativeElement.click();

    expect(service.getAdminStats).toHaveBeenCalledWith({
      dateFrom: '2026-07-01',
      dateTo: '2026-07-06',
      language: 'ru',
    });
  });

  it('marks required dates invalid instead of refreshing with empty values', () => {
    fixture.detectChanges();
    service.getAdminStats.mockClear();

    fixture.componentInstance.setDateFrom('');
    fixture.debugElement
      .query(By.css('[data-testid="admin-article-statistics-refresh"]'))
      .nativeElement.click();
    fixture.detectChanges();

    const fromInput = fixture.debugElement.query(By.css('#adminArticleStatsDateFrom'))
      .nativeElement as HTMLInputElement;
    expect(service.getAdminStats).not.toHaveBeenCalled();
    expect(fromInput.getAttribute('aria-invalid')).toBe('true');
    expect(fromInput.classList).toContain('is-invalid');
  });

  it('renders load errors and retries from the error state', () => {
    service.getAdminStats.mockReturnValueOnce(throwError(() => apiError()));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Failed to load statistics');
    service.getAdminStats.mockReturnValueOnce(of(articleStats()));
    fixture.debugElement.query(By.css('.alert button')).nativeElement.click();

    expect(service.getAdminStats).toHaveBeenCalledTimes(2);
  });

  it('renders an empty state when the selected period has no statistics', () => {
    service.getAdminStats.mockReturnValue(of({ ...articleStats(), articles: [] }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('За выбранный период статистики нет.');
  });

  it('exports the loaded statistics to CSV', () => {
    fixture.detectChanges();

    fixture.debugElement
      .query(By.css('[data-testid="admin-article-statistics-export"]'))
      .nativeElement.click();

    expect(window.URL.createObjectURL).toHaveBeenCalled();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    expect(window.URL.revokeObjectURL).toHaveBeenCalledWith('blob:article-statistics');
  });
});

function articleStats(): AdminArticleStats {
  return {
    dateFrom: '2026-06-06',
    dateTo: '2026-07-06',
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
  };
}

function apiError(): ApiError {
  return {
    code: 'stats_error',
    type: 'server_error',
    message: 'Failed to load statistics',
    location: null,
    attr: null,
  };
}
