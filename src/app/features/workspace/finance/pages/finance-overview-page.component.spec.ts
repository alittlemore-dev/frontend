import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { FinanceTransactionEntryComponent } from '../components/finance-transaction-entry.component';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { FinanceMonth, FinanceRevision, FinanceTransaction } from '../models/finance.model';
import { FinanceService } from '../services/finance.service';
import { FinanceOverviewPageComponent } from './finance-overview-page.component';
import {
  FINANCE_TEST_MONTH as MONTH,
  FINANCE_TEST_TRANSACTION as TRANSACTION,
} from '../testing/finance-fixtures';

describe('FinanceOverviewPageComponent', () => {
  let fixture: ComponentFixture<FinanceOverviewPageComponent>;
  const service = {
    ensure: jest.fn(() => of(MONTH)),
    month: jest.fn(() => of(MONTH)),
    transactions: jest.fn(() => of<readonly FinanceTransaction[]>([])),
    createCategory: jest.fn(() => of(MONTH)),
    updateCategory: jest.fn(() => of(MONTH)),
    changeCurrency: jest.fn(() => of(MONTH)),
    updateOpeningBalance: jest.fn(() => of(MONTH)),
    createTransaction: jest.fn(() => of(TRANSACTION)),
    updateTransaction: jest.fn(() => of(TRANSACTION)),
    archiveCategory: jest.fn(() => of(MONTH)),
    deleteCategoryPermanently: jest.fn(() => of(MONTH)),
    restoreCategory: jest.fn(() => of(MONTH)),
    revisions: jest.fn(() => of<readonly FinanceRevision[]>([])),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    service.transactions.mockReturnValue(of([]));
    service.deleteCategoryPermanently.mockReturnValue(of(MONTH));
    service.revisions.mockReturnValue(of([]));
    await TestBed.configureTestingModule({
      imports: [FinanceOverviewPageComponent],
      providers: [
        provideRouter([]),
        provideI18nTesting({ 'finance.category.none': 'Без категории' }),
        { provide: FinanceService, useValue: service },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FinanceOverviewPageComponent);
    fixture.detectChanges();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('creates the month automatically with the selected language and shows both tabs', () => {
    expect(service.ensure).toHaveBeenCalledWith('ru');
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('[role="tab"]')).toHaveLength(2);
    expect(root.querySelectorAll('#finance-panel-summary .finance-budget')).toHaveLength(2);
    expect(root.querySelector('ds-site-select')).not.toBeNull();
    expect(root.querySelector<HTMLInputElement>('.finance-name-input')?.value).toBe('Еда');
    expect(root.querySelector<HTMLInputElement>('#finance-opening')?.value).toBe('0');
  });

  it('does not save an unchanged scientific-zero opening balance', () => {
    const page = fixture.componentInstance;
    page.saveOpeningBalance();
    expect(service.updateOpeningBalance).not.toHaveBeenCalled();
  });

  it('marks the category archive control as destructive', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(
      root.querySelector('.finance-category-table .finance-icon-button-danger'),
    ).not.toBeNull();
  });

  it('keeps a blank category plan unset when creating a category', () => {
    const page = fixture.componentInstance;
    page.updateNewCategoryDraft('income', 'name', 'Bonus');
    page.createCategoryInline('income');
    expect(service.createCategory).toHaveBeenCalledWith('income', 'Bonus', null);
  });

  it('saves an inline category name without a separate edit action', () => {
    const page = fixture.componentInstance;
    const category = MONTH.categories[0];
    page.updateCategoryDraft(category, 'name', 'Продукты');
    page.saveCategoryInline(category);
    expect(service.updateCategory).toHaveBeenCalledWith('food', 'Продукты', null, 0);
  });

  it('changes the month currency directly from the design-system select', () => {
    const page = fixture.componentInstance;
    page.selectCurrency('EUR');
    expect(service.changeCurrency).toHaveBeenCalledWith('EUR');
    expect(service.transactions).toHaveBeenCalledTimes(2);
  });

  function entries(): FinanceTransactionEntryComponent[] {
    return fixture.debugElement
      .queryAll(By.directive(FinanceTransactionEntryComponent))
      .map((node) => node.componentInstance as FinanceTransactionEntryComponent);
  }

  function removalDialog(): HTMLDialogElement {
    const dialog = fixture.nativeElement.querySelector(
      '.finance-removal-dialog',
    ) as HTMLDialogElement;
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => dialog.removeAttribute('open');
    return dialog;
  }

  function transactionDialog(): HTMLDialogElement {
    const dialog = fixture.nativeElement.querySelector(
      '.finance-transaction-dialog',
    ) as HTMLDialogElement;
    dialog.showModal = () => dialog.setAttribute('open', '');
    dialog.close = () => dialog.removeAttribute('open');
    return dialog;
  }

  function openTransaction(kind: 'expense' | 'income' = 'expense'): HTMLDialogElement {
    const dialog = transactionDialog();
    fixture.componentInstance.openTransactionCreation(kind);
    fixture.detectChanges();
    return dialog;
  }

  it('shows a localized month and year beside the overview title', () => {
    const root = fixture.nativeElement as HTMLElement;
    const label = root.querySelector('.finance-month-label');
    expect(label?.textContent).toContain(
      new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
        new Date('2026-09-01T00:00:00Z'),
      ),
    );
    TestBed.inject(I18nService).switchLanguage('en').subscribe();
    fixture.detectChanges();
    expect(label?.textContent).toContain(
      new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
        new Date('2026-09-01T00:00:00Z'),
      ),
    );
  });

  it('opens the category removal dialog and archives only after choosing archive', () => {
    const dialog = removalDialog();
    const root = fixture.nativeElement as HTMLElement;
    root
      .querySelector<HTMLButtonElement>('.finance-category-table .finance-icon-button-danger')
      ?.click();
    fixture.detectChanges();
    expect(dialog.open).toBe(true);
    expect(service.archiveCategory).not.toHaveBeenCalled();
    dialog.querySelector<HTMLButtonElement>('.btn-outline-secondary')?.click();
    expect(service.archiveCategory).toHaveBeenCalledWith('food');
    expect(service.deleteCategoryPermanently).not.toHaveBeenCalled();
    expect(dialog.open).toBe(false);
  });

  it('permanently deletes only the selected category and refreshes the operations', () => {
    const dialog = removalDialog();
    fixture.componentInstance.openCategoryRemoval(MONTH.categories[0]);
    fixture.detectChanges();
    dialog.querySelector<HTMLButtonElement>('.btn-outline-danger')?.click();
    expect(service.deleteCategoryPermanently).toHaveBeenCalledWith('food');
    expect(service.archiveCategory).not.toHaveBeenCalled();
    expect(service.transactions).toHaveBeenCalledTimes(2);
    expect(dialog.open).toBe(false);
  });

  it('keeps the removal dialog open with an error when deletion fails', () => {
    service.deleteCategoryPermanently.mockReturnValue(throwError(() => ({ status: 500 })));
    const dialog = removalDialog();
    fixture.componentInstance.openCategoryRemoval(MONTH.categories[0]);
    fixture.detectChanges();
    dialog.querySelector<HTMLButtonElement>('.btn-outline-danger')?.click();
    fixture.detectChanges();
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.componentInstance.saving()).toBe(false);
  });

  it('separates operations into expense and income columns with creation controls', () => {
    const page = fixture.componentInstance;
    page.transactions.set([
      TRANSACTION,
      {
        ...TRANSACTION,
        id: 'income',
        kind: 'income',
        categoryId: 'salary',
        categoryName: 'Зарплата',
      },
    ]);
    page.setTab('transactions');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const columns = root.querySelectorAll('.finance-transactions-column');
    expect(columns).toHaveLength(2);
    expect(columns[0].querySelectorAll('.finance-transaction-row')).toHaveLength(1);
    expect(columns[0].textContent).toContain('Еда');
    expect(columns[1].querySelectorAll('.finance-transaction-row')).toHaveLength(1);
    expect(columns[1].textContent).toContain('Зарплата');
    const buttons = root.querySelectorAll<HTMLButtonElement>('.finance-add-transaction');
    expect(buttons).toHaveLength(2);
    const dialog = transactionDialog();
    buttons[1].click();
    fixture.detectChanges();
    expect(dialog.open).toBe(true);
    expect(fixture.componentInstance.transactionEditor()?.kind).toBe('income');
    expect(
      entries()[0]
        .categoryOptions()
        .map((option) => option.value),
    ).toEqual(['', 'salary']);
  });

  it('creates an expense from the dialog in the tracker zone and closes it after saving', () => {
    const dialog = openTransaction();
    const expense = entries()[0];
    expense.form.setValue({
      categoryId: 'food',
      amount: '12.5',
      currency: 'USD',
      dateTime: '2026-09-15T16:00',
      description: ' Lunch ',
    });
    fixture.detectChanges();
    const form = fixture.nativeElement.querySelector(
      'app-finance-transaction-entry form',
    ) as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
    expect(service.createTransaction).toHaveBeenCalledWith({
      categoryId: 'food',
      amount: '12.5',
      currency: 'USD',
      occurredAt: '2026-09-15T12:00:00Z',
      description: 'Lunch',
    });
    expect(dialog.open).toBe(false);
    expect(fixture.componentInstance.transactionEditor()).toBeNull();
    expect(service.transactions).toHaveBeenCalledTimes(2);
  });

  it('opens an operation in the dialog with its existing values and version', () => {
    const page = fixture.componentInstance;
    page.transactions.set([TRANSACTION]);
    page.setTab('transactions');
    fixture.detectChanges();
    const dialog = transactionDialog();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.finance-transaction-edit')?.click();
    fixture.detectChanges();
    expect(dialog.open).toBe(true);
    const editor = entries()[0];
    expect(editor.form.getRawValue()).toEqual({
      categoryId: 'food',
      amount: '10',
      currency: 'RUB',
      dateTime: '2026-09-15T16:00',
      description: 'Обед',
    });
    editor.form.controls.amount.setValue('25');
    editor.submit();
    expect(service.updateTransaction).toHaveBeenCalledWith(
      'transaction',
      1,
      expect.objectContaining({ amount: '25', categoryId: 'food' }),
    );
    expect(dialog.open).toBe(false);
  });

  it('shows preserved uncategorized operations in their original income or expense column', () => {
    const page = fixture.componentInstance;
    page.transactions.set([{ ...TRANSACTION, categoryId: null, categoryName: '' }]);
    page.setTab('transactions');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.finance-transactions-column')?.textContent).toContain(
      'Без категории',
    );
    expect(root.querySelectorAll('.finance-transaction-row')).toHaveLength(1);
  });

  it('shows currency symbols in the summary selector and formatted amounts', () => {
    expect(fixture.componentInstance.currencyOptions.map((option) => option.label)).toEqual([
      '֏',
      '₽',
      '$',
      '€',
    ]);
    expect(fixture.componentInstance.money('10', 'RUB')).toContain('₽');
    expect(fixture.componentInstance.money('10', 'AMD')).toContain('֏');
    const root = fixture.nativeElement as HTMLElement;
    expect(
      [...root.querySelectorAll('.finance-balance-symbol')].map((node) => node.textContent?.trim()),
    ).toEqual(['₽', '₽']);
    expect(root.querySelector('.finance-balance-number')?.textContent).toContain('0,00');
  });

  it('saves a localized negative opening balance while keeping the currency beside it', async () => {
    service.updateOpeningBalance.mockReturnValueOnce(of({ ...MONTH, openingBalance: '-12.5' }));
    const root = fixture.nativeElement as HTMLElement;
    const opening = root.querySelector<HTMLInputElement>('#finance-opening')!;
    opening.value = '-12,5';
    opening.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    opening.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(service.updateOpeningBalance).toHaveBeenCalledWith('-12.5');
    expect(opening.value).toBe('-12.5');
    expect(root.querySelector('#finance-opening-currency')?.textContent).toContain('₽');
  });

  it('rejects an operation date outside the current month before sending it', () => {
    openTransaction();
    fixture.componentInstance.saveTransaction({
      categoryId: 'food',
      amount: '10',
      currency: 'RUB',
      dateTime: '2026-08-31T12:00',
      description: '',
    });
    expect(service.createTransaction).not.toHaveBeenCalled();
    expect(fixture.componentInstance.errorKey()).toBe('finance.error.date');
  });

  it('preserves the open dialog draft during an asynchronous retry', () => {
    const dialog = openTransaction();
    const expense = entries()[0];
    expense.form.controls.amount.setValue('12');
    expense.form.controls.description.setValue('Unsaved expense');
    fixture.componentInstance.errorKey.set('finance.error.load');
    fixture.detectChanges();
    const retry = new Subject<FinanceMonth>();
    service.ensure.mockReturnValueOnce(retry);
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.alert button')?.click();
    fixture.detectChanges();
    expect(entries()[0].form.controls.amount.value).toBe('12');
    retry.next(MONTH);
    retry.complete();
    fixture.detectChanges();
    expect(entries()[0].form.controls.amount.value).toBe('12');
    expect(entries()[0].form.controls.description.value).toBe('Unsaved expense');
    expect(dialog.open).toBe(true);
  });

  it('keeps the dialog and authored values when the API rejects saving', () => {
    service.createTransaction.mockReturnValueOnce(throwError(() => ({ status: 503 })));
    const dialog = openTransaction();
    const expense = entries()[0];
    expense.form.setValue({
      categoryId: 'food',
      amount: '12,5',
      currency: 'RUB',
      dateTime: '2026-09-15T12:00',
      description: 'Lunch',
    });
    expense.submit();
    fixture.detectChanges();
    expect(service.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '12.5' }),
    );
    expect(expense.form.controls.amount.value).toBe('12,5');
    expect(expense.form.controls.description.value).toBe('Lunch');
    expect(dialog.querySelector('[role="alert"]')).not.toBeNull();
    expect(dialog.open).toBe(true);
  });

  it('cancels creation without saving and starts a new empty draft on reopening', () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    const dialog = openTransaction();
    entries()[0].form.controls.amount.setValue('77');
    entries()[0].form.controls.description.setValue('Cancelled draft');
    dialog
      .querySelector<HTMLButtonElement>('.finance-entry-actions button[type="button"]')
      ?.click();
    fixture.detectChanges();
    expect(dialog.open).toBe(false);
    expect(service.createTransaction).not.toHaveBeenCalled();
    openTransaction('income');
    expect(entries()[0].form.controls.amount.value).toBe('');
    expect(entries()[0].form.controls.description.value).toBe('');
    confirm.mockRestore();
  });

  it('protects an operation draft on cancel and treats a full revert as clean', () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const dialog = openTransaction();
    const description = dialog.querySelector<HTMLTextAreaElement>('textarea')!;
    description.value = 'Unsaved operation';
    description.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(dialog.open).toBe(true);
    expect(description.value).toBe('Unsaved operation');
    description.value = '';
    description.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    dialog
      .querySelector<HTMLButtonElement>('.finance-entry-actions button[type="button"]')!
      .click();
    fixture.detectChanges();
    expect(dialog.open).toBe(false);
    expect(confirm).toHaveBeenCalledTimes(1);
    confirm.mockRestore();
  });

  it('keeps failed opening balance and category drafts when retry reloads the month', () => {
    service.updateOpeningBalance.mockReturnValueOnce(throwError(() => ({ status: 503 })));
    service.updateCategory.mockReturnValueOnce(throwError(() => ({ status: 503 })));
    const page = fixture.componentInstance;
    page.openingDraft.set('123');
    page.saveOpeningBalance();
    page.updateCategoryDraft(MONTH.categories[0], 'name', 'Unsaved name');
    page.updateCategoryDraft(MONTH.categories[0], 'plan', '456');
    page.saveCategoryInline(MONTH.categories[0]);
    page.initialize();
    expect(page.openingDraft()).toBe('123');
    expect(page.categoryDrafts()['food']).toEqual({ name: 'Unsaved name', plan: '456' });
  });

  it('ignores an older transaction response after the filter changes', () => {
    const older = new Subject<readonly FinanceTransaction[]>();
    const newer = new Subject<readonly FinanceTransaction[]>();
    service.transactions.mockReturnValueOnce(older).mockReturnValueOnce(newer);
    const page = fixture.componentInstance;
    page.setIncludeDeleted(true);
    page.setIncludeDeleted(false);
    newer.next([TRANSACTION]);
    older.next([{ ...TRANSACTION, id: 'deleted', deleted: true }]);
    expect(page.transactions()).toEqual([TRANSACTION]);
  });

  it('keeps history responses attached to the selected operation', () => {
    const older = new Subject<readonly FinanceRevision[]>();
    const newer = new Subject<readonly FinanceRevision[]>();
    service.revisions.mockReturnValueOnce(older).mockReturnValueOnce(newer);
    const page = fixture.componentInstance;
    const other = { ...TRANSACTION, id: 'other' };
    page.showRevisions(TRANSACTION);
    page.showRevisions(other);
    newer.next([]);
    older.error({ status: 500 });
    expect(page.revisionsFor()).toEqual(other);
    expect(page.revisions()).toEqual([]);
    expect(page.errorKey()).toBeNull();
  });

  it('toggles history, replaces the selected operation, and cancels a closed request', () => {
    const pending = new Subject<readonly FinanceRevision[]>();
    service.revisions.mockReturnValueOnce(pending);
    const page = fixture.componentInstance;
    page.transactions.set([TRANSACTION, { ...TRANSACTION, id: 'other' }]);
    page.setTab('transactions');
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const buttons = root.querySelectorAll<HTMLButtonElement>('.finance-history-button');
    buttons[0].click();
    fixture.detectChanges();
    expect(root.querySelector('#finance-history [role="status"]')).not.toBeNull();
    expect(buttons[0].getAttribute('aria-expanded')).toBe('true');
    buttons[0].click();
    fixture.detectChanges();
    expect(root.querySelector('#finance-history')).toBeNull();
    expect(buttons[0].getAttribute('aria-expanded')).toBe('false');
    expect(service.revisions).toHaveBeenCalledTimes(1);
    pending.error({ status: 500 });
    expect(page.revisionsErrorKey()).toBeNull();
    buttons[0].click();
    buttons[1].click();
    fixture.detectChanges();
    expect(root.querySelectorAll('#finance-history')).toHaveLength(1);
    expect(page.revisionsFor()?.id).toBe('other');
    expect(buttons[0].getAttribute('aria-expanded')).toBe('false');
    expect(buttons[1].getAttribute('aria-expanded')).toBe('true');
  });

  it('cancels a pending retry when a mutation returns newer month data', () => {
    const pending = new Subject<FinanceMonth>();
    service.ensure.mockReturnValueOnce(pending);
    const updated = { ...MONTH, currency: 'EUR' as const };
    service.changeCurrency.mockReturnValueOnce(of(updated));
    const page = fixture.componentInstance;
    page.initialize();
    page.selectCurrency('EUR');
    pending.next(MONTH);
    expect(page.month()?.currency).toBe('EUR');
    expect(page.loading()).toBe(false);
  });

  it('waits for the transaction month refresh before allowing currency changes', () => {
    const pending = new Subject<FinanceMonth>();
    service.month.mockReturnValueOnce(pending);
    const dialog = openTransaction();
    const expense = entries()[0];
    expense.form.controls.categoryId.setValue('food');
    expense.form.controls.amount.setValue('10');
    expense.submit();
    const page = fixture.componentInstance;
    expect(page.saving()).toBe(true);
    expect(dialog.open).toBe(false);
    page.selectCurrency('EUR');
    expect(service.changeCurrency).not.toHaveBeenCalled();
    pending.next(MONTH);
    pending.complete();
    expect(page.saving()).toBe(false);
    page.selectCurrency('EUR');
    expect(service.changeCurrency).toHaveBeenCalledWith('EUR');
  });
});
