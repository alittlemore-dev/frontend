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
