import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UnsavedChangesService } from '../../../../core/unsaved-changes/unsaved-changes.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { AssetMovement, AssetPosition } from '../models/finance-assets.model';
import { AssetBalanceInlineComponent } from './asset-balance-inline.component';

const day = '2026-03-31';
const path = '/api/personal-workspace/finance/assets/movements';
const bank: AssetPosition = {
  id: 'main',
  name: 'Current account',
  locationId: 'bank',
  kind: 'bank',
  currency: 'RUB',
  instrument: '',
  venue: '',
  annualRate: null,
  maturesOn: null,
  quantity: '12000',
  originalValue: '12000.00',
  value: '150.00',
  priceDate: null,
  priceSource: '',
  rateDate: null,
  rateSource: '',
  missingPrice: false,
  missingRate: false,
  stale: false,
};
const observation: AssetMovement = {
  id: 'observed',
  requestId: 'previous',
  version: 3,
  kind: 'reconcile',
  onDate: day,
  positionId: 'main',
  amount: '12000',
  quantity: null,
  totalValue: null,
  categoryId: null,
  counterAmount: null,
  counterPositionId: null,
  note: 'bank statement',
  source: 'web',
  changedAt: day + 'T10:00:00Z',
  deleted: false,
};

describe('Asset balance inline', () => {
  let http: HttpTestingController;
  let fixture: ComponentFixture<AssetBalanceInlineComponent>;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideI18nTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AssetBalanceInlineComponent);
    fixture.componentRef.setInput('position', bank);
    fixture.componentRef.setInput('today', day);
    fixture.componentRef.setInput('asOf', day);
    fixture.componentRef.setInput('trackingStart', '2026-03-01');
    fixture.componentRef.setInput('movements', []);
    fixture.detectChanges();
  });
  afterEach(() => http.verify());

  function input(field: 'value' | 'quantity' = 'value'): HTMLInputElement {
    return fixture.nativeElement.querySelector('#asset-main-' + field);
  }
  function enterValue(value: string, field: 'value' | 'quantity' = 'value'): HTMLInputElement {
    const control = input(field);
    control.value = value;
    control.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    return control;
  }
  function enter(control: HTMLInputElement) {
    control.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
  }

  it('starts clean, shows the account currency, and saves the observed balance exactly once', () => {
    const guard = TestBed.inject(UnsavedChangesService);
    expect(guard.hasChanges()).toBe(false);
    expect(input().value).toBe('12000');
    expect(fixture.nativeElement.querySelector('[title=RUB]')?.textContent).toBe('₽');
    const control = enterValue('12800,75');
    expect(guard.hasChanges()).toBe(true);
    enter(control);
    control.dispatchEvent(new FocusEvent('blur'));
    const request = http.expectOne((r) => r.url.endsWith(path));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toMatchObject({
      kind: 'reconcile',
      positionId: bank.id,
      amount: '12800.75',
      onDate: day,
      quantity: null,
      categoryId: null,
    });
    request.flush({ ...observation, version: 1, amount: '12800.75' });
    control.dispatchEvent(new FocusEvent('blur'));
    expect(guard.hasChanges()).toBe(false);
    expect(control.value).toBe('12800.75');
  });

  it('updates an existing observation on the same date and preserves its note', () => {
    fixture.componentRef.setInput('movements', [observation]);
    fixture.detectChanges();
    enterValue('0').dispatchEvent(new FocusEvent('blur'));
    const edit = http.expectOne((r) => r.url.endsWith(path + '/observed'));
    expect(edit.request.method).toBe('PATCH');
    expect(edit.request.body).toMatchObject({
      kind: 'reconcile',
      version: 3,
      amount: '0',
      note: 'bank statement',
    });
    edit.flush({ ...observation, version: 4, amount: '0' });
  });

  it('keeps invalid input local, cancels on Escape and retries a failed creation with its original request ID', () => {
    const bad = enterValue('12,001');
    enter(bad);
    expect(fixture.nativeElement.querySelector('[role=alert]')).toBeTruthy();
    bad.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(bad.value).toBe('12000');
    expect(TestBed.inject(UnsavedChangesService).hasChanges()).toBe(false);
    const valid = enterValue('12300');
    enter(valid);
    const first = http.expectOne((r) => r.url.endsWith(path));
    first.flush(null, { status: 503, statusText: 'Unavailable' });
    expect(valid.value).toBe('12300');
    enter(valid);
    const second = http.expectOne((r) => r.url.endsWith(path));
    expect(second.request.body.requestId).toBe(first.request.body.requestId);
    second.flush({ ...observation, version: 1, amount: '12300' });
  });

  it('records quantity and whole-position value without a trade or a cash leg', () => {
    fixture.componentRef.setInput('position', {
      ...bank,
      kind: 'stock',
      quantity: '2',
      originalValue: null,
      value: null,
      missingPrice: true,
    });
    fixture.detectChanges();
    expect(input().value).toBe('');
    expect(input('quantity').value).toBe('2');
    enter(enterValue('3.012345678901', 'quantity'));
    const quantity = http.expectOne((r) => r.url.endsWith(path));
    expect(quantity.request.body).toMatchObject({
      kind: 'reconcile',
      quantity: '3.012345678901',
      totalValue: null,
      amount: null,
      counterPositionId: null,
    });
    const row = { ...observation, ...quantity.request.body, version: 1 };
    quantity.flush(row);
    enter(enterValue('9000'));
    const total = http.expectOne((r) => r.url.endsWith(path + '/' + row.id));
    expect(total.request.body).toMatchObject({
      kind: 'reconcile',
      quantity: '3.012345678901',
      totalValue: '9000',
      version: 1,
    });
    total.flush({ ...row, ...total.request.body, version: 2 });
  });

  it('uses an isolated statement before regular tracking and leaves unknown amounts empty', () => {
    fixture.componentRef.setInput('asOf', '2026-02-20');
    fixture.componentRef.setInput('trackingStart', null);
    fixture.componentRef.setInput('position', { ...bank, originalValue: null, quantity: null });
    fixture.detectChanges();
    expect(input().value).toBe('');
    enter(enterValue('0'));
    const history = http.expectOne((r) => r.method === 'GET' && r.url.endsWith(path));
    expect(history.request.params.get('start')).toBe('2026-02-20');
    history.flush({ items: [observation] });
    const create = http.expectOne((r) => r.url.endsWith(path));
    expect(create.request.body).toMatchObject({
      onDate: '2026-02-20',
      kind: 'statement',
      amount: '0',
    });
    create.flush({ ...observation, ...create.request.body, version: 1 });
  });
});
