import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { chooseSiteSelectOption, siteSelectValue } from '@alittlemore.dev/design-system/testing';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { AssetPosition } from '../models/finance-assets.model';
import { FINANCE_TEST_MONTH } from '../testing/finance-fixtures';
import { FinanceAssetOverviewColumnComponent } from './finance-asset-overview-column.component';

const bank: AssetPosition = {
  id: 'bank',
  name: 'Savings',
  kind: 'deposit',
  locationId: 'place',
  currency: 'USD',
  instrument: '',
  venue: '',
  annualRate: '3.5',
  maturesOn: '2028-09-01',
  quantity: '500',
  originalValue: '500',
  value: '39000',
  priceDate: null,
  priceSource: null,
  rateDate: '2026-09-15',
  rateSource: 'CBR',
  missingPrice: false,
  missingRate: false,
  stale: false,
};
describe('FinanceAssetOverviewColumnComponent', () => {
  let fixture: ComponentFixture<FinanceAssetOverviewColumnComponent>;
  let http: HttpTestingController;
  const root = (): HTMLElement => fixture.nativeElement;
  const one = (method: string, path: string) =>
    http.expectOne((r) => r.method === method && r.url.endsWith('/finance/assets/' + path));

  function load(positions: AssetPosition[] = [], asOf = '2026-09-15', currency = 'RUB') {
    const report = one('GET', 'report');
    expect(report.request.params.get('end')).toBe(asOf);
    expect(report.request.params.get('currency')).toBe(currency);
    report.flush({
      trackingStart: null,
      currency,
      closing: {
        currency,
        knownValue: '39000',
        asOf,
        complete: true,
        positions,
      },
    });
    one('GET', 'locations').flush({
      items: positions.length ? [{ id: 'place', name: 'Local bank' }] : [],
    });
    one('GET', 'movements').flush({ items: [] });
    one('GET', 'goals').flush({ goal: null });
    fixture.detectChanges();
  }

  function type(selector: string, value: string) {
    const input = root().querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    return input;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FinanceAssetOverviewColumnComponent],
      providers: [provideI18nTesting(), provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(FinanceAssetOverviewColumnComponent);
    fixture.componentRef.setInput('month', { ...FINANCE_TEST_MONTH, currency: 'RUB' });
    fixture.componentRef.setInput('today', '2026-09-15');
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  it('creates the first account and its observed balance from the add row and retries a lost response safely', () => {
    load();
    type('.finance-new-category .finance-name-input', 'Deposit');
    const amount = type('.finance-new-category .finance-amount-input', '12000,50');
    amount.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const create = one('POST', 'positions/overview');
    expect(create.request.body).toMatchObject({
      requestId: expect.any(String),
      onDate: '2026-09-15',
      amount: '12000.50',
      position: { name: 'Deposit', locationId: '', kind: 'cash', currency: 'RUB' },
    });
    create.flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(fixture.componentInstance.dirty()).toBe(true);
    root()
      .querySelector<HTMLButtonElement>('.finance-new-category app-finance-row-actions button')!
      .click();
    const retry = one('POST', 'positions/overview');
    expect(retry.request.body).toEqual(create.request.body);
    retry.flush({ id: 'bank' });
    load([bank]);
    expect(fixture.componentInstance.dirty()).toBe(false);
  });

  it('shows a selected historic month with no budget row, using the reporting currency and read-only asset facts', () => {
    load();
    fixture.componentRef.setInput('month', null);
    fixture.componentRef.setInput('selectedMonth', '2026-07-01');
    fixture.componentRef.setInput('fallbackCurrency', 'USD');
    fixture.detectChanges();
    load([bank], '2026-07-31', 'USD');
    expect(root().querySelector('[data-asset-id=bank]')?.textContent).toContain('Savings');
    root().querySelector<HTMLButtonElement>('[data-asset-id=bank] [aria-expanded=false]')!.click();
    fixture.detectChanges();
    const facts = root().querySelector('#asset-details-bank')!;
    expect(facts.textContent).toContain('Local bank');
    expect(facts.textContent).toContain('finance.assets.kind.deposit');
    expect(facts.textContent).not.toContain('2028-09-01');
    expect(root().querySelector('tbody input')).toBeNull();
    expect(root().querySelector('.finance-new-category')).toBeNull();
  });

  it('accepts a whole-position valuation when first recording a security', () => {
    load([bank]);
    type('.finance-new-category .finance-name-input', 'Retirement fund');
    chooseSiteSelectOption(fixture, '#finance-new-asset-currency', 'EUR');
    root().querySelector<HTMLButtonElement>('.asset-options button')!.click();
    fixture.detectChanges();
    chooseSiteSelectOption(fixture, '#finance-new-asset-kind', 'fund');
    expect(siteSelectValue(fixture, '#finance-new-asset-location')).toBe('place');
    chooseSiteSelectOption(fixture, '#finance-new-asset-location', '');
    type('.asset-new-settings input[placeholder]', 'New broker');
    fixture.componentInstance.fields.instrument.setValue('INDEX');
    fixture.componentInstance.fields.venue.setValue('X');
    type('.finance-new-category .finance-amount-input', '1300');
    root()
      .querySelector<HTMLButtonElement>('.finance-new-category app-finance-row-actions button')!
      .click();
    const create = one('POST', 'positions/overview');
    expect(create.request.body).toMatchObject({
      amount: '1300',
      defaultLocationName: 'New broker',
      position: { kind: 'fund', currency: 'EUR', locationId: '', instrument: 'INDEX', venue: 'X' },
    });
    create.flush({ id: 'fund' });
    load();
  });

  it('keeps the valuation editable on the stock row and exposes quantity, conversion and missing-price details on demand', () => {
    const stock = {
      ...bank,
      id: 'stock',
      kind: 'stock' as const,
      quantity: '2.5',
      instrument: 'XYZ',
      venue: 'Market',
      stale: true,
    };
    load([stock]);
    const row = root().querySelector('[data-asset-id=stock]')!;
    const trigger = row.querySelector<HTMLButtonElement>('[aria-expanded]')!;
    expect(row.querySelector<HTMLInputElement>('#asset-stock-value')?.value).toBe('500');
    expect(root().querySelector('#asset-stock-quantity')).toBeNull();
    trigger.click();
    fixture.detectChanges();
    const panel = root().querySelector('#' + trigger.getAttribute('aria-controls'))!;
    expect(panel.textContent).toContain('Market');
    expect(panel.textContent).toContain('finance.transaction.converted');
    expect(panel.textContent).toContain('finance.assets.stale');
    const input = type('#asset-stock-quantity', '4');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const update = one('POST', 'movements');
    expect(update.request.body).toMatchObject({
      positionId: 'stock',
      quantity: '4',
      kind: 'reconcile',
    });
    update.flush({ ...update.request.body, id: 'reconcile', version: 1 });
    load([{ ...stock, quantity: '4' }]);
    trigger.click();
    fixture.detectChanges();
    expect(root().querySelector('#asset-stock-quantity')).toBeNull();
    expect(fixture.componentInstance.dirty()).toBe(false);
  });

  it('renames on blur without losing the deposit currency, terms, or location', () => {
    load([bank]);
    type('[data-asset-id="bank"] .finance-name-input', 'Holiday savings').dispatchEvent(
      new FocusEvent('blur'),
    );
    const patch = one('PATCH', 'positions/bank');
    expect(patch.request.body).toMatchObject({
      name: 'Holiday savings',
      kind: 'deposit',
      currency: 'USD',
      locationId: 'place',
      annualRate: '3.5',
      maturesOn: '2028-09-01',
    });
    patch.flush({ id: bank.id });
    load([{ ...bank, name: 'Holiday savings' }]);
    expect(fixture.componentInstance.dirty()).toBe(false);
  });

  it('keeps an asset with history available for archiving and restoring', () => {
    load([bank]);
    root().querySelector<HTMLButtonElement>('[data-asset-id] .finance-icon-button-danger')!.click();
    fixture.detectChanges();
    root().querySelector<HTMLButtonElement>('dialog .btn-outline-danger')!.click();
    one('DELETE', 'positions/bank').flush({}, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(root().querySelector('dialog [role=alert]')?.textContent).toContain(
      'finance.assets.positionHasHistory',
    );
    root().querySelector<HTMLButtonElement>('dialog .btn-outline-secondary')!.click();
    const archive = one('PATCH', 'positions/bank/archive');
    expect(archive.request.body).toEqual({ archived: true });
    archive.flush({});
    load([{ ...bank, archived: true }]);
    expect(root().querySelector('[data-asset-id] input')).toBeNull();
    root().querySelector<HTMLButtonElement>('[data-asset-id] [aria-expanded=false]')!.click();
    fixture.detectChanges();
    expect(root().querySelector('#asset-details-bank')?.textContent).toContain('Local bank');
    expect(root().querySelector('#asset-details-bank button')).toBeNull();
    root().querySelector<HTMLButtonElement>('[data-asset-id] .finance-icon-button')!.click();
    const restore = one('PATCH', 'positions/bank/archive');
    expect(restore.request.body).toEqual({ archived: false });
    restore.flush({});
    load([bank]);
    expect(root().querySelector('[data-asset-id] .finance-name-input')).not.toBeNull();
  });
});
