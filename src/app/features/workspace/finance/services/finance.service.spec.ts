import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiClient } from '../../../../core/http/api-client.service';
import { FinanceService } from './finance.service';

describe('FinanceService', () => {
  let service: FinanceService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ApiClient, FinanceService],
    });
    service = TestBed.inject(FinanceService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('passes the selected language when ensuring the current month', () => {
    service.ensure('ru').subscribe();
    const request = http.expectOne((entry) =>
      entry.url.endsWith('/api/personal-workspace/finance/current-month/ensure'),
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ language: 'ru' });
    request.flush({});
  });

  it('sends transaction versions and the deleted filter', () => {
    service.transactions(true).subscribe();
    const list = http.expectOne((entry) =>
      entry.url.endsWith('/api/personal-workspace/finance/current-month/transactions'),
    );
    expect(list.request.params.get('include_deleted')).toBe('true');
    list.flush({ transactions: [] });

    service.deleteTransaction('one', 3).subscribe();
    const removal = http.expectOne((entry) =>
      entry.url.endsWith('/api/personal-workspace/finance/current-month/transactions/one'),
    );
    expect(removal.request.method).toBe('DELETE');
    expect(removal.request.params.get('version')).toBe('3');
    removal.flush({});
  });

  it('requests historical months, their operations and revisions through the protected API', () => {
    service.historicalMonth('2025-12-01').subscribe();
    const month = http.expectOne((entry) =>
      entry.url.endsWith('/api/personal-workspace/finance/months/2025/12'),
    );
    expect(month.request.method).toBe('GET');
    month.flush({});
    service.historicalTransactions('2025-12-01', true).subscribe();
    const operations = http.expectOne((entry) =>
      entry.url.endsWith('/months/2025/12/transactions'),
    );
    expect(operations.request.params.get('include_deleted')).toBe('true');
    operations.flush({ transactions: [] });
    service.historicalRevisions('2025-12-01', 'operation/id').subscribe();
    const revisions = http.expectOne((entry) =>
      entry.url.endsWith('/months/2025/12/transactions/operation%2Fid/revisions'),
    );
    revisions.flush({ revisions: [] });
  });

  it('sends the independent analytics currency and selected period', () => {
    service.statistics('last30Days', 'AMD').subscribe();
    const request = http.expectOne((entry) =>
      entry.url.endsWith('/api/personal-workspace/finance/statistics'),
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('period')).toBe('last30Days');
    expect(request.request.params.get('currency')).toBe('AMD');
    request.flush({});
  });

  it('writes late transactions to their historical month rather than the current month', () => {
    service
      .createTransaction(
        {
          categoryId: 'food',
          amount: '10',
          currency: 'USD',
          occurredAt: '2025-12-31T12:00:00Z',
          description: 'Late',
        },
        '2025-12-01',
      )
      .subscribe();
    const create = http.expectOne((entry) => entry.url.endsWith('/months/2025/12/transactions'));
    expect(create.request.method).toBe('POST');
    create.flush({});
    service.deleteTransaction('late', 2, '2025-12-01').subscribe();
    const remove = http.expectOne((entry) =>
      entry.url.endsWith('/months/2025/12/transactions/late'),
    );
    expect(remove.request.params.get('version')).toBe('2');
    remove.flush({});
  });

  it('uses separate archive and permanent category deletion requests', () => {
    service.archiveCategory('food').subscribe();
    const archive = http.expectOne((entry) => entry.url.endsWith('/current-month/categories/food'));
    expect(archive.request.method).toBe('DELETE');
    archive.flush({});
    service.deleteCategoryPermanently('food').subscribe();
    const deletion = http.expectOne((entry) =>
      entry.url.endsWith('/current-month/categories/food/permanent'),
    );
    expect(deletion.request.method).toBe('DELETE');
    deletion.flush({});
  });
});
