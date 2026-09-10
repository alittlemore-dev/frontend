import { DOCUMENT } from '@angular/common';
import {
  DestroyRef,
  Injectable,
  Signal,
  WritableSignal,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';

const CONFIRM_DISCARD_KEY = 'adminUnsavedChanges.confirmDiscard';

export type AdminUnsavedValue = unknown;

export interface AdminUnsavedChangesSource {
  readonly hasChanges: Signal<boolean>;
  commit(): void;
  unregister(): void;
}

class RegisteredAdminUnsavedChangesSource implements AdminUnsavedChangesSource {
  private readonly baseline: WritableSignal<string>;
  private readonly registered = signal(true);

  readonly hasChanges: Signal<boolean>;

  constructor(
    private readonly current: Signal<AdminUnsavedValue>,
    private readonly active: Signal<boolean>,
    private readonly remove: (source: RegisteredAdminUnsavedChangesSource) => void,
  ) {
    this.baseline = signal(fingerprint(this.current()));
    this.hasChanges = computed(
      () => this.registered() && this.active() && fingerprint(this.current()) !== this.baseline(),
    );
  }

  commit(): void {
    this.baseline.set(fingerprint(this.current()));
  }

  unregister(): void {
    if (!this.registered()) return;
    this.registered.set(false);
    this.remove(this);
  }
}

export class AdminUnsavedChangesScope {
  private readonly sources = signal<readonly RegisteredAdminUnsavedChangesSource[]>([]);
  private disposed = false;

  readonly hasChanges = computed(() => this.sources().some((source) => source.hasChanges()));

  constructor(
    private readonly confirmChanges: () => boolean,
    private readonly removeScope: (scope: AdminUnsavedChangesScope) => void,
  ) {}

  registerSource(
    current: Signal<AdminUnsavedValue>,
    active: Signal<boolean>,
  ): AdminUnsavedChangesSource {
    const source = new RegisteredAdminUnsavedChangesSource(current, active, (registeredSource) => {
      this.sources.update((sources) => sources.filter((item) => item !== registeredSource));
    });
    this.sources.update((sources) => [...sources, source]);
    return source;
  }

  commit(): void {
    for (const source of this.sources()) source.commit();
  }

  confirmDiscard(): boolean {
    return !this.hasChanges() || this.confirmChanges();
  }

  confirmDiscardExcept(preservedSources: readonly AdminUnsavedChangesSource[]): boolean {
    const hasDiscardedChanges = this.sources().some(
      (source) => !preservedSources.includes(source) && source.hasChanges(),
    );
    return !hasDiscardedChanges || this.confirmChanges();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const source of this.sources()) source.unregister();
    this.removeScope(this);
  }
}

@Injectable({ providedIn: 'root' })
export class AdminUnsavedChangesService {
  private readonly document = inject(DOCUMENT);
  private readonly i18n = inject(I18nService);
  private readonly scopes = signal<readonly AdminUnsavedChangesScope[]>([]);
  private readonly beforeUnload = (event: BeforeUnloadEvent): void => {
    event.preventDefault();
    event.returnValue = true;
  };

  readonly hasChanges = computed(() => this.scopes().some((scope) => scope.hasChanges()));

  constructor() {
    effect((onCleanup) => {
      const browserWindow = this.document.defaultView;
      if (!browserWindow || !this.hasChanges()) return;
      browserWindow.addEventListener('beforeunload', this.beforeUnload);
      onCleanup(() => browserWindow.removeEventListener('beforeunload', this.beforeUnload));
    });
  }

  createScope(destroyRef: DestroyRef): AdminUnsavedChangesScope {
    const scope = new AdminUnsavedChangesScope(
      () => this.showConfirmation(),
      (disposedScope) => this.removeScope(disposedScope),
    );
    this.scopes.update((scopes) => [...scopes, scope]);
    destroyRef.onDestroy(() => scope.dispose());
    return scope;
  }

  confirmDiscard(): boolean {
    return !this.hasChanges() || this.showConfirmation();
  }

  discardChanges(): void {
    for (const scope of this.scopes()) scope.commit();
  }

  private showConfirmation(): boolean {
    const browserWindow = this.document.defaultView;
    if (!browserWindow) return false;
    return browserWindow.confirm(this.i18n.translate(CONFIRM_DISCARD_KEY));
  }

  private removeScope(scope: AdminUnsavedChangesScope): void {
    this.scopes.update((scopes) => scopes.filter((item) => item !== scope));
  }
}

function fingerprint(value: unknown): string {
  return fingerprintNested(value, new Set<object>());
}

function fingerprintNested(value: unknown, ancestors: Set<object>): string {
  if (value === null) return 'null';

  switch (typeof value) {
    case 'undefined':
      return 'undefined';
    case 'boolean':
      return `boolean:${String(value)}`;
    case 'number':
      return `number:${numberFingerprint(value)}`;
    case 'bigint':
      return `bigint:${value.toString()}`;
    case 'string':
      return `string:${JSON.stringify(value)}`;
    case 'symbol':
      return `symbol:${String(value.description)}`;
    case 'function':
      return `function:${value.name}`;
    case 'object':
      return objectFingerprint(value, ancestors);
  }
  throw new Error('Unsupported unsaved-change value');
}

function objectFingerprint(value: object, ancestors: Set<object>): string {
  if (ancestors.has(value)) return 'circular';
  if (value instanceof Date) return `date:${numberFingerprint(value.getTime())}`;
  if (isFile(value)) {
    return `file:${JSON.stringify([value.name, value.size, value.type, value.lastModified])}`;
  }

  ancestors.add(value);
  const result = collectionFingerprint(value, ancestors);
  ancestors.delete(value);
  return result;
}

function collectionFingerprint(value: object, ancestors: Set<object>): string {
  if (Array.isArray(value)) {
    return `array:[${value.map((item) => fingerprintNested(item, ancestors)).join(',')}]`;
  }
  if (value instanceof Set) {
    const entries = [...value].map((item) => fingerprintNested(item, ancestors)).sort();
    return `set:{${entries.join(',')}}`;
  }

  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${fingerprintNested(record[key], ancestors)}`);
  return `object:{${entries.join(',')}}`;
}

function isFile(value: object): value is File {
  return Object.prototype.toString.call(value) === '[object File]';
}

function numberFingerprint(value: number): string {
  if (Number.isNaN(value)) return 'NaN';
  if (value === Number.POSITIVE_INFINITY) return 'Infinity';
  if (value === Number.NEGATIVE_INFINITY) return '-Infinity';
  if (Object.is(value, -0)) return '-0';
  return String(value);
}
