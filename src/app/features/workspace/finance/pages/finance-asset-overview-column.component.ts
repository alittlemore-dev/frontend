import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  ModalDialogDirective,
  SiteSelectComponent,
  SiteSelectOption,
} from '@alittlemore.dev/design-system';
import { forkJoin, map, Observable, Subscription } from 'rxjs';
import { Temporal } from 'temporal-polyfill';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../../core/i18n/translate.pipe';
import { UnsavedChangesService } from '../../../../core/unsaved-changes/unsaved-changes.service';
import { AssetBalanceInlineComponent } from '../components/asset-balance-inline.component';
import { AssetDateComponent } from '../components/asset-date.component';
import { AssetEditorComponent, AssetEditorSelection } from '../components/asset-editor.component';
import { AssetGoalInlineComponent } from '../components/asset-goal-inline.component';
import {
  FinanceRowActionsComponent,
  FinanceRowNameComponent,
} from '../components/finance-overview-row.component';
import {
  AssetGoal,
  AssetKind,
  AssetLocation,
  AssetMovement,
  AssetPosition,
  AssetPositionDraft,
  AssetReport,
  isSecurity,
} from '../models/finance-assets.model';
import { FinanceCurrency, FinanceMonth } from '../models/finance.model';
import { FinanceAssetsService } from '../services/finance-assets.service';
import { formatFinanceMoney } from '../utils/finance-format';
import { formatFinanceDate } from '../utils/finance-time';
import { assetKindOptions, FINANCE_CURRENCY_OPTIONS } from '../utils/finance-select-options';

interface Portfolio {
  report: AssetReport;
  goal: AssetGoal | null;
  locations: AssetLocation[];
  movements: AssetMovement[];
}

@Component({
  selector: 'app-finance-asset-overview-column',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    ModalDialogDirective,
    SiteSelectComponent,
    FinanceRowNameComponent,
    FinanceRowActionsComponent,
    AssetBalanceInlineComponent,
    AssetGoalInlineComponent,
    AssetEditorComponent,
    AssetDateComponent,
  ],
  templateUrl: './finance-asset-overview-column.component.html',
  styleUrls: [
    '../components/finance-budget-column.component.scss',
    './finance-asset-overview-column.component.scss',
  ],
})
export class FinanceAssetOverviewColumnComponent {
  private readonly injector = inject(Injector);
  private readonly api = inject(FinanceAssetsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  readonly i18n = inject(I18nService);
  private readonly changes = inject(UnsavedChangesService);
  private readonly scope = this.changes.createScope(this.destroyRef);
  readonly month = input<FinanceMonth | null>(null);
  readonly selectedMonth = input<string | null>(null);
  readonly fallbackCurrency = input<FinanceCurrency>('RUB');
  readonly period = computed(
    () => this.selectedMonth() ?? this.month()?.periodStart ?? this.today().slice(0, 7) + '-01',
  );
  private readonly reportingCurrency = computed(
    () => this.month()?.currency ?? this.fallbackCurrency(),
  );
  readonly today = input.required<string>();
  readonly readOnly = input(false);
  readonly viewOnly = computed(() => this.readOnly() || !this.month());
  readonly kindOptions = computed(() => assetKindOptions(this.i18n));
  readonly currencyOptions = FINANCE_CURRENCY_OPTIONS;
  readonly security = isSecurity;
  readonly portfolio = signal<Portfolio | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly error = signal('');
  readonly writing = signal(false);
  readonly nameDrafts = signal<Record<string, string>>({});
  readonly newDetails = signal(false);
  readonly expandedId = signal<string | null>(null);
  readonly selection = signal<AssetEditorSelection | null>(null);
  readonly removal = signal<AssetPosition | null>(null);
  readonly removalDialog = viewChild.required(ModalDialogDirective);
  private readonly settings = viewChild(AssetEditorComponent);
  private readonly quantity = viewChild<AssetBalanceInlineComponent>('quantity');
  private readonly balances = viewChildren(AssetBalanceInlineComponent);
  private readonly goal = viewChild(AssetGoalInlineComponent);
  private readonly newForm = new FormGroup({
    name: new FormControl('', { nonNullable: true }),
    amount: new FormControl('', { nonNullable: true }),
    kind: new FormControl<AssetKind>('cash', { nonNullable: true }),
    currency: new FormControl<FinanceCurrency>('RUB', { nonNullable: true }),
    location: new FormControl('', { nonNullable: true }),
    newLocation: new FormControl('', { nonNullable: true }),
    instrument: new FormControl('', { nonNullable: true }),
    venue: new FormControl('', { nonNullable: true }),
    annualRate: new FormControl('', { nonNullable: true }),
    maturesOn: new FormControl('', { nonNullable: true }),
  });
  readonly fields = this.newForm.controls;
  readonly newAsset = toSignal(
    this.newForm.valueChanges.pipe(map(() => this.newForm.getRawValue())),
    { initialValue: this.newForm.getRawValue() },
  );
  private readonly blank = this.newForm.getRawValue();
  private readonly baseline = signal(this.blank);
  private readonly localDirty = computed(
    () =>
      Object.keys(this.nameDrafts()).length > 0 ||
      JSON.stringify(this.newAsset()) !== JSON.stringify(this.baseline()),
  );
  readonly dirty = computed(
    () =>
      this.localDirty() ||
      this.goal()?.dirty() === true ||
      this.settings()?.dirty() === true ||
      this.balances().some((row) => row.dirty()),
  );
  readonly busy = computed(
    () =>
      this.writing() ||
      this.goal()?.busy() === true ||
      this.settings()?.busy() === true ||
      this.balances().some((row) => row.busy()),
  );
  readonly asOf = computed(() => {
    const start = Temporal.PlainDate.from(this.period());
    const last = start.with({ day: start.daysInMonth }).toString();
    return last < this.today() ? last : this.today();
  });
  readonly locationNames = computed(
    () => new Map(this.portfolio()?.locations.map((l) => [l.id, l.name]) ?? []),
  );
  readonly locationOptions = computed<readonly SiteSelectOption[]>(() => [
    ...(this.portfolio()?.locations ?? []).map((location) => ({
      value: location.id,
      label: location.name,
    })),
    { value: '', label: this.i18n.translate('finance.assets.addLocation') },
  ]);
  private readonly context = computed(() =>
    [this.period(), this.reportingCurrency(), this.asOf()].join('/'),
  );
  private pending?: Subscription;
  private retry?: { payload: string; id: string };

  constructor() {
    this.scope.registerSource(this.localDirty, signal(true));
    effect(() => {
      this.context();
      untracked(() => {
        this.portfolio.set(null);
        this.discard();
        this.refresh();
      });
    });
  }

  refresh(): void {
    this.pending?.unsubscribe();
    const start = this.period();
    this.loadError.set(false);
    this.loading.set(true);
    this.pending = forkJoin({
      report: this.api.report(start, this.asOf(), this.reportingCurrency()),
      goal: this.api.goal(start.slice(0, 7)),
      locations: this.api.locations(),
      movements: this.api.movements(start, this.asOf()),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (portfolio) => {
          const first = !this.portfolio();
          this.portfolio.set(portfolio);
          if (first) {
            this.resetNew();
            if (this.document.location?.hash === '#finance-new-asset') {
              afterNextRender(() => this.document.getElementById('finance-new-asset')?.focus(), {
                injector: this.injector,
              });
            }
          }
          this.loading.set(false);
        },
        error: () => {
          this.loadError.set(true);
          this.loading.set(false);
        },
      });
  }

  leave(): boolean {
    if (this.busy() || (this.dirty() && !this.changes.confirmDiscard())) return false;
    this.discard();
    return true;
  }

  discard(): void {
    this.goal()?.discard();
    for (const row of this.balances()) row.discard();
    this.selection.set(null);
    this.expandedId.set(null);
    this.nameDrafts.set({});
    this.resetNew();
    this.error.set('');
  }

  private resetNew(): void {
    const locations = this.portfolio()?.locations ?? [];
    const location =
      locations.length === 1
        ? locations[0]
        : locations.find((l) => l.name === this.i18n.translate('finance.assets.defaultLocation'));
    const empty = {
      ...this.blank,
      currency: this.reportingCurrency(),
      location: location?.id ?? '',
    };
    this.newForm.reset(empty);
    this.baseline.set(empty);
    this.newDetails.set(false);
    this.retry = undefined;
  }

  money(value: string | null, currency: FinanceCurrency): string {
    return value === null
      ? this.i18n.translate('finance.notSet')
      : formatFinanceMoney(value, currency, this.i18n.dateLocale());
  }

  percent(value: string): string {
    return new Intl.NumberFormat(this.i18n.dateLocale(), {
      style: 'percent',
      maximumFractionDigits: 2,
    }).format(Number(value) / 100);
  }

  changeName(p: AssetPosition, value: string): void {
    const next = { ...this.nameDrafts() };
    if (value === p.name) delete next[p.id];
    else next[p.id] = value;
    this.nameDrafts.set(next);
  }

  rename(p: AssetPosition): void {
    const draft = this.nameDrafts()[p.id];
    if (draft === undefined) return;
    const name = draft.trim();
    if (!name) {
      this.error.set('finance.assets.invalid');
      return;
    }
    if (name === p.name) {
      this.changeName(p, p.name);
      return;
    }
    const { locationId, kind, currency, instrument, venue, annualRate, maturesOn } = p;
    this.write(
      this.api.savePosition(p.id, {
        name,
        locationId,
        kind,
        currency,
        instrument,
        venue,
        annualRate,
        maturesOn,
      }),
      () => this.changeName(p, p.name),
    );
  }

  create(): void {
    if (this.viewOnly() || this.writing()) return;
    const f = this.newForm.getRawValue();
    const security = isSecurity(f.kind);
    const amount = f.amount.trim().replace(',', '.');
    const deposit = f.kind === 'deposit' || f.kind === 'savings';
    const rate = f.annualRate.trim().replace(',', '.');
    if (
      !f.name.trim() ||
      (security && (!f.instrument.trim() || !f.venue.trim())) ||
      (deposit && rate && !/^\d+(\.\d+)?$/.test(rate))
    ) {
      this.error.set('finance.assets.invalid');
      return;
    }
    const precision = f.currency === 'AMD' ? /^\d{1,18}$/ : /^\d{1,18}(\.\d{1,2})?$/;
    if (amount && !precision.test(amount)) {
      this.error.set('finance.assets.invalidBalance');
      return;
    }
    const draft: AssetPositionDraft = {
      name: f.name.trim(),
      locationId: f.location,
      kind: f.kind,
      currency: f.currency,
      instrument: security ? f.instrument.trim() : '',
      venue: security ? f.venue.trim() : '',
      annualRate: deposit && rate ? rate : null,
      maturesOn: deposit && f.maturesOn ? f.maturesOn : null,
    };
    const locationName =
      f.newLocation.trim() || this.i18n.translate('finance.assets.defaultLocation');
    const payload = JSON.stringify([draft, this.asOf(), amount, locationName]);
    if (this.retry?.payload !== payload) {
      const id = this.document.defaultView?.crypto?.randomUUID?.();
      if (!id) {
        this.error.set('finance.error.save');
        return;
      }
      this.retry = { id, payload };
    }
    this.write(
      this.api.quickPosition(this.retry.id, draft, this.asOf(), amount || null, locationName),
      () => this.resetNew(),
    );
  }

  toggleDetails(id: string): void {
    if (this.busy()) return;
    if ((this.settings()?.dirty() || this.quantity()?.dirty()) && !this.changes.confirmDiscard())
      return;
    this.selection.set(null);
    this.expandedId.update((previous) => (previous === id ? null : id));
  }

  number(value: string): string {
    return new Intl.NumberFormat(this.i18n.dateLocale(), { maximumFractionDigits: 12 }).format(
      Number(value),
    );
  }

  date(value: string): string {
    return formatFinanceDate(value, this.i18n.dateLocale(), 'UTC');
  }

  openRemoval(p: AssetPosition): void {
    this.removal.set(p);
    this.error.set('');
    this.removalDialog().open();
  }

  remove(permanent: boolean): void {
    const p = this.removal();
    if (!p) return;
    const op = permanent ? this.api.deletePosition(p.id) : this.api.archivePosition(p.id, true);
    this.write(
      op,
      () => {
        this.removalDialog().close();
        this.removal.set(null);
        if (this.expandedId() === p.id) {
          this.selection.set(null);
          this.expandedId.set(null);
        }
        this.changeName(p, p.name);
      },
      permanent ? 'finance.assets.positionHasHistory' : 'finance.error.conflict',
    );
  }

  restore(p: AssetPosition): void {
    this.write(this.api.archivePosition(p.id, false));
  }

  private write(
    operation: Observable<unknown>,
    saved?: () => void,
    conflict = 'finance.error.conflict',
  ): void {
    if (this.writing() || this.viewOnly()) return;
    this.writing.set(true);
    this.error.set('');
    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.writing.set(false);
        saved?.();
        this.refresh();
      },
      error: (e) => {
        this.writing.set(false);
        this.error.set(e.status === 409 ? conflict : 'finance.error.save');
      },
    });
  }
}
