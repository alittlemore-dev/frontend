import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import {
  chooseSiteSelectOption,
  siteSelectOptionValues,
  siteSelectValue,
} from '@alittlemore.dev/design-system/testing';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { AssetMovement, AssetPosition } from '../models/finance-assets.model';
import { FINANCE_TEST_MONTH } from '../testing/finance-fixtures';
import { FinanceAssetOperationsComponent } from './finance-asset-operations.component';

const cash: AssetPosition = {
  id: 'account',
  locationId: 'bank',
  name: 'Main account',
  kind: 'bank',
  currency: 'RUB',
  instrument: '',
  venue: '',
  annualRate: null,
  maturesOn: null,
  quantity: '100',
  originalValue: '100',
  value: '100',
  priceDate: null,
  priceSource: null,
  rateDate: null,
  rateSource: null,
  missingPrice: false,
  missingRate: false,
  stale: false,
};
const deposit: AssetMovement = {
  id: 'transfer',
  requestId: 'abc',
  version: 3,
  deleted: false,
  kind: 'depositExternal',
  onDate: '2026-03-02',
  positionId: 'account',
  counterPositionId: null,
  amount: '15.50',
  quantity: null,
  totalValue: null,
  counterAmount: null,
  note: 'Savings',
  categoryId: null,
  changedAt: '2026-03-03T12:00:00Z',
  source: 'web',
};
describe('Asset operations in the shared transaction list', () => {
  let fixture: ComponentFixture<FinanceAssetOperationsComponent>;
  let http: HttpTestingController;
  const root = (): HTMLElement => fixture.nativeElement;
  const call = (method: string, suffix: string) =>
    http.expectOne((r) => r.method === method && r.url.endsWith('/finance/assets/' + suffix));
  function load(movements: AssetMovement[] = [], positions: AssetPosition[] = [cash]) {
    fixture.detectChanges();
    call('GET', 'locations').flush({ items: [{ id: 'bank', name: 'Bank' }] });
    const values = call('GET', 'positions');
    expect(values.request.params.get('asOf')).toBe('2026-03-31');
    values.flush({
      asOf: '2026-03-31',
      currency: 'RUB',
      knownValue: '100',
      complete: true,
      positions,
    });
    const rows = call('GET', 'movements');
    expect(rows.request.params.get('start')).toBe('2026-03-01');
    rows.flush({ items: movements });
    fixture.detectChanges();
  }
  function click(selector: string) {
    root().querySelector<HTMLButtonElement>(selector)!.click();
    fixture.detectChanges();
  }
  function input(selector: string, value: string) {
    const field = root().querySelector<HTMLInputElement>(selector)!;
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }
  function select(selector: string, value: string) {
    chooseSiteSelectOption(fixture, selector, value);
  }
  function submit(selector = 'app-finance-transaction-entry form') {
    root()
      .querySelector(selector)!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FinanceAssetOperationsComponent],
      providers: [
        provideI18nTesting(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FinanceAssetOperationsComponent);
    fixture.componentRef.setInput('month', { ...FINANCE_TEST_MONTH, periodStart: '2026-03-01' });
    fixture.componentRef.setInput('timeZone', 'America/Los_Angeles');
  });
  afterEach(() => {
    http.verify();
    jest.restoreAllMocks();
  });
  it('opens the current overview at the new asset field when there are no accounts yet', () => {
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    load([], []);
    expect(root().querySelector('.finance-add-transaction')).toBeNull();
    click('app-finance-operation-list p button');
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        fragment: 'finance-new-asset',
        queryParams: expect.objectContaining({ tab: 'overview', year: null, month: null }),
      }),
    );
  });

  it('returns from a drilldown to the original statistics month and keeps the report filters', async () => {
    const router = TestBed.inject(Router);
    await router.navigate([], {
      queryParams: {
        tab: 'transactions',
        year: 2026,
        month: 3,
        assetJournal: '2026-03',
        assetReportMonth: '2026-09',
        assetPeriod: 'year',
      },
    });
    load([deposit]);
    const navigate = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    click('app-finance-operation-list .btn-link');
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParamsHandling: 'merge',
        queryParams: {
          tab: 'assets',
          year: 2026,
          month: 9,
          assetJournal: null,
          assetPosition: null,
          assetReportMonth: null,
        },
      }),
    );
  });

  it('keeps an archived asset journal from opening an operation on the only active account', async () => {
    await TestBed.inject(Router).navigate([], { queryParams: { assetPosition: 'archived' } });
    load([], [cash, { ...cash, id: 'archived', archived: true }]);
    expect(root().querySelector('.finance-add-transaction')).toBeNull();
  });

  it('keeps old budget postings read-only while allowing edits to manual history', () => {
    const previous = {
      ...deposit,
      id: 'budget',
      kind: 'contribution' as const,
      createdAt: '2026-03-03T12:00:00Z',
    };
    const manual = { ...deposit, createdAt: previous.createdAt };
    load([previous, manual]);
    const rows = Array.from(root().querySelectorAll('.finance-transaction-row'));
    expect(rows[0].querySelector('.finance-transaction-edit')).not.toBeNull();
    expect(rows[1].querySelector('.finance-transaction-edit')).toBeNull();
  });

  it('can read and record assets for a selected month without a budget snapshot', async () => {
    fixture.componentRef.setInput('month', null);
    fixture.componentRef.setInput('selectedMonth', '2026-03-01');
    fixture.componentRef.setInput('fallbackCurrency', 'EUR');
    load([deposit], [cash]);
    expect(root().querySelector('tr time')?.getAttribute('datetime')).toBe('2026-03-02');
    click('.finance-add-transaction');
    input('#asset-operation-amount', '12');
    submit();
    const create = call('POST', 'movements');
    expect(create.request.body).toMatchObject({ kind: 'depositExternal', onDate: '2026-03-31' });
    create.flush(deposit);
    load([deposit]);
    click('.finance-add-transaction');
    expect(siteSelectOptionValues(fixture, '#asset-operation-kind')).not.toContain('contribution');
    expect(siteSelectOptionValues(fixture, '#asset-operation-kind')).toContain('depositExternal');
    expect(siteSelectOptionValues(fixture, '#asset-operation-kind')).toContain('statement');
    expect(siteSelectOptionValues(fixture, '#asset-operation-kind')).not.toContain('transfer');
    expect(siteSelectOptionValues(fixture, '#asset-operation-kind')).not.toContain('exchange');
  });

  it('saves a dated manual deposit independently of the budget and retries the same command', () => {
    const budget = jest.fn();
    fixture.componentInstance.budgetChanged.subscribe(budget);
    load();
    click('.finance-add-transaction');
    input('#asset-operation-amount', '25,30');
    input('#asset-operation-description', 'March savings');
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    expect(fixture.componentInstance.leave()).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(1);
    submit();
    const first = call('POST', 'movements');
    expect(first.request.body).toMatchObject({
      kind: 'depositExternal',
      onDate: '2026-03-31',
      amount: null,
      enteredAmount: '25.30',
      enteredCurrency: 'RUB',
      positionId: 'account',
      note: 'March savings',
      requestId: expect.any(String),
    });
    first.flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    expect(root().querySelector<HTMLInputElement>('#asset-operation-amount')?.value).toBe('25,30');
    expect(root().querySelector('dialog [role=alert]')?.textContent).toContain(
      'finance.error.rate',
    );
    submit();
    const again = call('POST', 'movements');
    expect(again.request.body).toEqual(first.request.body);
    again.flush(deposit);
    load([deposit]);
    expect(budget).not.toHaveBeenCalled();
    expect(root().querySelector('dialog form')).toBeNull();
    const date = root().querySelector('tr time')!;
    expect(date.getAttribute('datetime')).toBe('2026-03-02');
    expect(date.textContent).toContain('2 мар');
    expect(date.textContent).not.toContain('2026-03');
  });

  it('edits a historic withdrawal, shows revisions and restores it with the most recent version', () => {
    const row: AssetMovement = { ...deposit, kind: 'withdrawExternal', version: 4 };
    const archived = { ...cash, archived: true };
    load([row], [archived]);
    expect(root().querySelector('.finance-add-transaction')).toBeNull();
    expect(root().querySelector('.finance-repeat-button')).toBeNull();
    click('.finance-transaction-edit');
    input('#asset-operation-amount', '5');
    submit();
    const patch = call('PATCH', 'movements/transfer');
    expect(patch.request.body).toMatchObject({
      kind: 'withdrawExternal',
      onDate: '2026-03-02',
      amount: null,
      enteredAmount: '5',
      enteredCurrency: 'RUB',
      version: 4,
    });
    const updated = { ...row, amount: '5', version: 5 };
    patch.flush(updated);
    load([updated], [archived]);
    click('.finance-history-button');
    call('GET', 'movements/transfer/revisions').flush({ items: [row, updated] });
    fixture.detectChanges();
    const history = root().querySelector('#finance-assets-history')!;
    expect(history.textContent).toContain('15,50');
    expect(history.textContent).toContain('5,00');
    expect(history.textContent).not.toContain('T12:00');
    click('.finance-icon-button-danger');
    const remove = call('DELETE', 'movements/transfer');
    expect(remove.request.params.get('version')).toBe('5');
    const deleted = { ...updated, deleted: true, version: 6 };
    remove.flush(deleted);
    load([deleted], [archived]);
    expect(root().querySelector('.finance-archived')).toBeNull();
    fixture.componentRef.setInput('includeDeleted', true);
    fixture.detectChanges();
    click('.finance-archived .finance-row-actions button:last-child');
    const restore = call('POST', 'movements/transfer/restore');
    expect(restore.request.body).toEqual({ version: 6 });
    restore.flush({ ...updated, version: 7 });
    load([{ ...updated, version: 7 }], [archived]);
  });

  it('can record a cash withdrawal and choose the source asset currency from the same entry form', () => {
    load([], [{ ...cash, currency: 'USD' }]);
    click('.finance-add-transaction');
    select('#asset-operation-kind', 'withdrawExternal');
    input('#asset-operation-amount', '14');
    expect(siteSelectValue(fixture, '#asset-operation-currency')).toBe('USD');
    submit();
    const req = call('POST', 'movements');
    expect(req.request.body).toMatchObject({
      kind: 'withdrawExternal',
      enteredAmount: '14',
      enteredCurrency: 'USD',
      amount: null,
      positionId: 'account',
    });
    req.flush({}, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(root().querySelector('dialog [role=alert]')?.textContent).toContain(
      'finance.error.conflict',
    );
    input('#asset-operation-amount', '101');
    submit();
    call('POST', 'movements').flush({}, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(root().querySelector('dialog [role=alert]')?.textContent).toContain(
      'finance.assets.insufficientBalance',
    );
    select('#asset-operation-currency', 'AMD');
    submit();
    call('POST', 'movements').flush({}, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();
    expect(root().querySelector('dialog [role=alert]')?.textContent).toContain(
      'finance.error.conflict',
    );
    input('#asset-operation-amount', '14');
    submit();
    call('POST', 'movements').flush(deposit);
    load();
  });
  it('defaults currency to the account until the user chooses another currency', () => {
    const euro = { ...cash, id: 'euro', name: 'Euro reserve', currency: 'EUR' as const };
    load([], [cash, euro]);
    click('.finance-add-transaction');
    select('#asset-operation-category', cash.id);
    expect(siteSelectOptionValues(fixture, '#asset-operation-currency')).toEqual([
      'AMD',
      'RUB',
      'USD',
      'EUR',
    ]);
    expect(siteSelectValue(fixture, '#asset-operation-currency')).toBe('RUB');
    select('#asset-operation-category', euro.id);
    expect(siteSelectValue(fixture, '#asset-operation-currency')).toBe('EUR');
    select('#asset-operation-currency', 'USD');
    select('#asset-operation-category', cash.id);
    expect(siteSelectValue(fixture, '#asset-operation-currency')).toBe('USD');
    input('#asset-operation-amount', '17,25');
    submit();
    const request = call('POST', 'movements');
    expect(request.request.body).toMatchObject({
      positionId: cash.id,
      enteredAmount: '17.25',
      enteredCurrency: 'USD',
      amount: null,
    });
    request.flush({});
    load();
  });

  it('displays the entered amount and the asset equivalent and retains the input on edit or repeat', () => {
    const row: AssetMovement = {
      ...deposit,
      kind: 'withdrawExternal',
      enteredAmount: '2.50',
      enteredCurrency: 'USD',
      amount: '210.00',
    };
    load([row]);
    const amount = root().querySelector('.finance-amount-cell')!;
    expect(amount.textContent).toMatch(/−2,50\s*\$/);
    expect(amount.querySelector('small')?.textContent).toMatch(/−210,00\s*₽/);
    expect(amount.querySelector('small')?.title).toBe('finance.assets.inPositionCurrency');
    click('.finance-history-button');
    call('GET', 'movements/transfer/revisions').flush({ items: [row] });
    fixture.detectChanges();
    const history = root().querySelector('#finance-assets-history')!;
    expect(history.textContent).toMatch(/−2,50\s*\$/);
    expect(history.textContent).toMatch(/−210,00\s*₽/);
    for (const [selector, method] of [
      ['.finance-transaction-edit', 'PATCH'],
      ['.finance-repeat-button', 'POST'],
    ]) {
      click(selector);
      expect(root().querySelector<HTMLInputElement>('#asset-operation-amount')?.value).toBe('2.5');
      expect(siteSelectValue(fixture, '#asset-operation-currency')).toBe('USD');
      submit();
      const request = call(method, method === 'POST' ? 'movements' : 'movements/transfer');
      expect(request.request.body).toMatchObject({
        kind: 'withdrawExternal',
        positionId: 'account',
        enteredAmount: '2.5',
        enteredCurrency: 'USD',
        amount: null,
      });
      request.flush(row);
      load([row]);
    }
  });
  it('records a trade with both cash and security legs, or a manual valuation without a budget posting', async () => {
    const security = {
      ...cash,
      id: 'fund',
      name: 'Index fund',
      kind: 'fund' as const,
      instrument: 'INDEX',
      venue: 'EX',
    };
    const others = { ...cash, id: 'other', name: 'Collection', kind: 'other' as const };
    const positions = [cash, security, others];
    const budget = jest.fn();
    fixture.componentInstance.budgetChanged.subscribe(budget);
    load([], positions);
    for (const command of [
      {
        kind: 'buy',
        positionId: 'fund',
        counterPositionId: 'account',
        quantity: '2',
        amount: '6000',
      },
      { kind: 'valuation', positionId: 'other', totalValue: '12000' },
    ]) {
      click('.finance-add-transaction');
      expect(root().querySelector('#asset-operation-kind')).toBeNull();
      select('#asset-operation-category', command.positionId);
      expect(siteSelectOptionValues(fixture, '#asset-operation-kind')).not.toContain(
        'depositExternal',
      );
      select('#asset-operation-kind', command.kind);
      await fixture.whenStable();
      fixture.detectChanges();
      if (command.counterPositionId) select('#asset-counter', command.counterPositionId);
      if (command.quantity) input('#asset-quantity', command.quantity);
      if (command.amount) input('#asset-amount', command.amount);
      if (command.totalValue) input('#asset-totalValue', command.totalValue);
      submit('app-asset-editor form');
      const write = call('POST', 'movements');
      expect(write.request.body).toMatchObject({ ...command, onDate: '2026-03-31' });
      write.flush({});
      load([], positions);
    }
    expect(budget).not.toHaveBeenCalled();
  });

  it('trades securities using outside funds, preserves both legs in history, and reopens the funding choice', async () => {
    const stock: AssetPosition = {
      ...cash,
      id: 'stock',
      name: 'Stocks',
      kind: 'stock',
      quantity: '8',
      originalValue: '4000',
    };
    const row: AssetMovement = {
      ...deposit,
      kind: 'buy',
      positionId: 'stock',
      amount: '3000',
      quantity: '3',
      externalFunds: true,
    };
    load([], [stock]);
    click('.finance-add-transaction');
    expect(siteSelectValue(fixture, '#asset-operation-category')).toBe('stock');
    expect(siteSelectValue(fixture, '#asset-operation-kind')).toBe('buy');
    expect(siteSelectOptionValues(fixture, '#asset-operation-kind')).toEqual(
      expect.arrayContaining(['buy', 'sell', 'valuation', 'reconcile']),
    );
    await fixture.whenStable();
    select('#asset-counter', 'external');
    input('#asset-quantity', '3');
    input('#asset-amount', '3000');
    expect(root().textContent).toContain('finance.assets.unitPrice');
    submit('app-asset-editor form');
    const post = call('POST', 'movements');
    expect(post.request.body).toMatchObject({
      kind: 'buy',
      positionId: 'stock',
      externalFunds: true,
      counterPositionId: null,
      quantity: '3',
      amount: '3000',
    });
    post.flush(row);
    load([row], [stock]);
    expect(root().querySelector('.finance-transaction-row')?.textContent).toContain(
      'finance.assets.outsideTracker',
    );
    click('.finance-transaction-edit');
    await fixture.whenStable();
    expect(siteSelectValue(fixture, '#asset-counter')).toBe('external');
    select('#asset-operation-kind', 'sell');
    submit('app-asset-editor form');
    const patch = call('PATCH', 'movements/transfer');
    expect(patch.request.body).toMatchObject({
      kind: 'sell',
      version: 3,
      externalFunds: true,
      counterPositionId: null,
    });
    patch.flush({});
    load([], [stock]);
  });

  it('takes a security with a value-only opening straight to quantity reconciliation', async () => {
    const stock: AssetPosition = {
      ...cash,
      id: 'stock',
      name: 'Stocks',
      kind: 'stock',
      quantity: '0',
      originalValue: '8000',
    };
    load([], [stock]);
    click('.finance-add-transaction');
    await fixture.whenStable();
    expect(root().querySelector('app-asset-editor [role=status]')?.textContent).toContain(
      'finance.assets.recordHoldingFirst',
    );
    expect(
      root().querySelector<HTMLButtonElement>('app-asset-editor button[type=submit]')?.disabled,
    ).toBe(true);
    click('app-asset-editor [role=status] button');
    await fixture.whenStable();
    expect(siteSelectValue(fixture, '#asset-operation-kind')).toBe('reconcile');
    expect(root().querySelector<HTMLInputElement>('#asset-totalValue')?.value).toBe('8000');
    input('#asset-quantity', '8');
    submit('app-asset-editor form');
    const post = call('POST', 'movements');
    expect(post.request.body).toMatchObject({
      positionId: 'stock',
      kind: 'reconcile',
      quantity: '8',
      totalValue: '8000',
    });
    post.flush({});
    load([], [stock]);
  });
  it('keeps the dated opening preview required when modifying an existing budget allocation', async () => {
    const row: AssetMovement = { ...deposit, kind: 'openingBudget' };
    load([row]);
    click('.finance-transaction-edit');
    await fixture.whenStable();
    fixture.detectChanges();
    const save = () =>
      root().querySelector<HTMLButtonElement>('app-asset-editor button[type=submit]')!;
    const first = call('POST', 'opening-preview');
    expect(first.request.body).toEqual({
      movementId: row.id,
      positionId: row.positionId,
      onDate: row.onDate,
      amount: '15.5',
    });
    expect(save().disabled).toBe(true);
    input('#asset-amount', '18');
    expect(first.cancelled).toBe(true);
    call('POST', 'opening-preview').flush({}, { status: 503, statusText: 'Rate unavailable' });
    fixture.detectChanges();
    expect(save().disabled).toBe(true);
    click('app-asset-editor [role=alert] button');
    call('POST', 'opening-preview').flush({ availableAfter: '90', currency: 'RUB' });
    fixture.detectChanges();
    expect(save().disabled).toBe(false);
    select('#asset-opening-source', 'openingExternal');
    const changed = call('POST', 'opening-preview');
    expect(changed.request.body).toEqual({ ...first.request.body, amount: '0' });
    changed.flush({ availableAfter: '108', currency: 'RUB' });
    fixture.detectChanges();
    const budget = jest.fn();
    fixture.componentInstance.budgetChanged.subscribe(budget);
    submit('app-asset-editor form');
    const patch = call('PATCH', 'movements/transfer');
    expect(patch.request.body).toMatchObject({ kind: 'openingExternal', amount: '18', version: 3 });
    patch.flush({});
    load();
    expect(budget).toHaveBeenCalledTimes(1);
  });

  it('converts a budget posting in the shared currency form while retaining its draft and version', async () => {
    const row: AssetMovement = { ...deposit, kind: 'contribution' };
    const euro: AssetPosition = { ...cash, id: 'euro', name: 'Euro account', currency: 'EUR' };
    const refreshBudget = jest.fn();
    fixture.componentInstance.budgetChanged.subscribe(refreshBudget);
    load([row], [cash, euro]);
    click('.finance-transaction-edit');
    await fixture.whenStable();
    select('#asset-operation-category', 'euro');
    input('#asset-amount', '80,50');
    input('#asset-note', 'Revised deposit');
    select('#asset-operation-kind', 'depositExternal');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(siteSelectValue(fixture, '#asset-operation-category')).toBe('euro');
    expect(siteSelectValue(fixture, '#asset-operation-currency')).toBe('EUR');
    expect(root().querySelector<HTMLInputElement>('#asset-operation-amount')?.value).toBe('80,50');
    expect(fixture.componentInstance.dirty()).toBe(true);
    select('#asset-operation-currency', 'USD');
    submit();
    const patch = call('PATCH', 'movements/' + row.id);
    expect(patch.request.body).toMatchObject({
      version: row.version,
      kind: 'depositExternal',
      positionId: 'euro',
      enteredAmount: '80.50',
      enteredCurrency: 'USD',
      note: 'Revised deposit',
      onDate: row.onDate,
    });
    patch.flush({});
    load();
    expect(refreshBudget).toHaveBeenCalledTimes(1);
  });
});
