import { ChangeDetectionStrategy, Component, CSP_NONCE, PLATFORM_ID, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MarkdownEditorStickyBottomInsetDirective } from './markdown-editor.sticky-bottom-inset.directive';

const BOTTOM_INSET_PROPERTY = '--markdown-editor-sticky-bottom-inset';
const TEST_NONCE = 'sticky-bottom-inset-test-nonce';

@Component({
  selector: 'app-markdown-editor-sticky-bottom-inset-test-host',
  standalone: true,
  imports: [MarkdownEditorStickyBottomInsetDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (firstVisible()) {
      <form #firstForm data-testid="first-form">
        <div class="markdown-editor-shell" data-testid="first-editor">Editor</div>
        <div class="markdown-editor-shell" data-testid="first-editor-secondary">Editor</div>
        <footer data-testid="first-footer" [appMarkdownEditorStickyBottomInset]="firstForm">
          @if (projectedActionsVisible()) {
            <button type="button" data-testid="projected-action">Projected action</button>
          }
        </footer>
      </form>
    }
    @if (secondVisible()) {
      <form #secondForm data-testid="second-form">
        <div class="markdown-editor-shell" data-testid="second-editor">Editor</div>
        <footer data-testid="second-footer" [appMarkdownEditorStickyBottomInset]="secondForm">
          Actions
        </footer>
      </form>
    }
  `,
})
export class MarkdownEditorStickyBottomInsetTestHostComponent {
  readonly firstVisible = signal(true);
  readonly secondVisible = signal(false);
  readonly projectedActionsVisible = signal(false);
}

@Component({
  selector: 'app-markdown-editor-sticky-bottom-inset-foreign-scope-test-host',
  standalone: true,
  imports: [MarkdownEditorStickyBottomInsetDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer data-testid="foreign-scope-footer" [appMarkdownEditorStickyBottomInset]="foreignScope">
      Actions
    </footer>
  `,
})
export class MarkdownEditorStickyBottomInsetForeignScopeTestHostComponent {
  readonly foreignScope = document.implementation.createHTMLDocument().createElement('form');
}

class TestResizeObserver implements ResizeObserver {
  static readonly instances: TestResizeObserver[] = [];
  static observeError = false;

  readonly disconnect = jest.fn();
  readonly observe = jest.fn((target: Element, options?: ResizeObserverOptions) => {
    if (TestResizeObserver.observeError) {
      throw new Error('Observation unavailable');
    }
    this.target = target;
    this.options = options;
  });
  readonly unobserve = jest.fn();
  target: Element | null = null;
  options: ResizeObserverOptions | undefined;

  constructor(private readonly callback: ResizeObserverCallback) {
    TestResizeObserver.instances.push(this);
  }

  emit(blockSize: number): void {
    const target = this.target;
    if (target === null) {
      throw new Error('ResizeObserver has no target');
    }
    const size: ResizeObserverSize = { blockSize, inlineSize: 320 };
    const entry = {
      target,
      borderBoxSize: [size],
      contentBoxSize: [size],
      devicePixelContentBoxSize: [size],
      contentRect: new DOMRectReadOnly(0, 0, 320, blockSize),
    } satisfies ResizeObserverEntry;
    this.callback([entry], this);
  }

  emitWithoutBorderBoxSize(): void {
    const target = this.target;
    if (target === null) {
      throw new Error('ResizeObserver has no target');
    }
    const entry = {
      target,
      borderBoxSize: [],
      contentBoxSize: [],
      devicePixelContentBoxSize: [],
      contentRect: new DOMRectReadOnly(),
    } satisfies ResizeObserverEntry;
    this.callback([entry], this);
  }
}

describe('MarkdownEditorStickyBottomInsetDirective', () => {
  let fixture: ComponentFixture<MarkdownEditorStickyBottomInsetTestHostComponent> | null;
  let resizeObserverDescriptor: PropertyDescriptor | undefined;

  beforeEach(async () => {
    fixture = null;
    TestResizeObserver.instances.splice(0);
    TestResizeObserver.observeError = false;
    resizeObserverDescriptor = Object.getOwnPropertyDescriptor(window, 'ResizeObserver');
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: TestResizeObserver,
      writable: true,
    });
    await TestBed.configureTestingModule({
      imports: [
        MarkdownEditorStickyBottomInsetTestHostComponent,
        MarkdownEditorStickyBottomInsetForeignScopeTestHostComponent,
      ],
      providers: [{ provide: CSP_NONCE, useValue: TEST_NONCE }],
    }).compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
    document.head
      .querySelectorAll(`style[nonce="${TEST_NONCE}"]`)
      .forEach((styleElement) => styleElement.remove());
    if (resizeObserverDescriptor === undefined) {
      Reflect.deleteProperty(window, 'ResizeObserver');
    } else {
      Object.defineProperty(window, 'ResizeObserver', resizeObserverDescriptor);
    }
    jest.restoreAllMocks();
  });

  it.each([
    { label: 'zero-height footer', measured: 0, expected: '0px' },
    { label: 'one-row footer', measured: 48, expected: '48px' },
    { label: 'wrapped multi-row footer', measured: 96.2, expected: '97px' },
  ])(
    'publishes the rounded $label border box to descendant editor content',
    ({ measured, expected }) => {
      createHost();
      const observer = observerFor('[data-testid="first-footer"]');

      observer.emit(measured);

      expect(observer.options).toEqual({ box: 'border-box' });
      expect(resolvedBottomInset('[data-testid="first-form"]')).toBe(expected);
      expect(
        element('[data-testid="first-form"]').contains(element('[data-testid="first-editor"]')),
      ).toBe(true);
      expect(
        element('[data-testid="first-form"]').contains(
          element('[data-testid="first-editor-secondary"]'),
        ),
      ).toBe(true);
      expectNoInlineStyles(
        '[data-testid="first-form"]',
        '[data-testid="first-footer"]',
        '[data-testid="first-editor"]',
        '[data-testid="first-editor-secondary"]',
      );
    },
  );

  it('keeps the published inset live across repeated footer size changes', () => {
    createHost();
    const observer = observerFor('[data-testid="first-footer"]');

    observer.emit(48);
    expect(resolvedBottomInset('[data-testid="first-form"]')).toBe('48px');

    observer.emit(112.01);
    expect(resolvedBottomInset('[data-testid="first-form"]')).toBe('113px');

    observer.emit(0);
    expect(resolvedBottomInset('[data-testid="first-form"]')).toBe('0px');
  });

  it('updates when projected action content appears and disappears', () => {
    createHost();
    const observer = observerFor('[data-testid="first-footer"]');
    observer.emit(48);

    fixture?.componentInstance.projectedActionsVisible.set(true);
    fixture?.detectChanges();
    expect(element('[data-testid="projected-action"]')).toBeTruthy();
    observer.emit(92.4);
    expect(resolvedBottomInset('[data-testid="first-form"]')).toBe('93px');

    fixture?.componentInstance.projectedActionsVisible.set(false);
    fixture?.detectChanges();
    observer.emit(48);
    expect(resolvedBottomInset('[data-testid="first-form"]')).toBe('48px');
  });

  it('isolates simultaneous forms with different footer heights', () => {
    createHost();
    fixture?.componentInstance.secondVisible.set(true);
    fixture?.detectChanges();
    const firstObserver = observerFor('[data-testid="first-footer"]');
    const secondObserver = observerFor('[data-testid="second-footer"]');

    firstObserver.emit(48);
    secondObserver.emit(104);

    expect(resolvedBottomInset('[data-testid="first-form"]')).toBe('48px');
    expect(resolvedBottomInset('[data-testid="second-form"]')).toBe('104px');
    const firstScope = generatedScopeAttribute('[data-testid="first-form"]');
    const secondScope = generatedScopeAttribute('[data-testid="second-form"]');
    expect(firstScope.value).not.toBe(secondScope.value);
    expectNoInlineStyles(
      '[data-testid="first-form"]',
      '[data-testid="first-footer"]',
      '[data-testid="first-editor"]',
      '[data-testid="first-editor-secondary"]',
      '[data-testid="second-form"]',
      '[data-testid="second-footer"]',
      '[data-testid="second-editor"]',
    );
  });

  it('disconnects observation and removes its scoped style and attribute on destruction', () => {
    createHost();
    const form = element('[data-testid="first-form"]');
    const observer = observerFor('[data-testid="first-footer"]');
    observer.emit(48);
    const scopeAttribute = generatedScopeAttribute('[data-testid="first-form"]');
    const styleElement = styleForScope(scopeAttribute.value);

    fixture?.componentInstance.firstVisible.set(false);
    fixture?.detectChanges();

    expect(observer.disconnect).toHaveBeenCalledTimes(1);
    expect(form.hasAttribute(scopeAttribute.name)).toBe(false);
    expect(styleElement.isConnected).toBe(false);
  });

  it('carries the Angular CSP nonce on each narrowly scoped runtime style', () => {
    createHost();
    observerFor('[data-testid="first-footer"]').emit(48);
    const scope = generatedScopeAttribute('[data-testid="first-form"]');
    const styleElement = styleForScope(scope.value);

    expect(styleElement.getAttribute('nonce')).toBe(TEST_NONCE);
    expect(styleElement.sheet?.cssRules).toHaveLength(1);
    expectNoInlineStyles(
      '[data-testid="first-form"]',
      '[data-testid="first-footer"]',
      '[data-testid="first-editor"]',
      '[data-testid="first-editor-secondary"]',
    );
  });

  it('supports environments without a CSP nonce without adding inline styles', () => {
    TestBed.overrideProvider(CSP_NONCE, { useValue: null });
    createHost();
    observerFor('[data-testid="first-footer"]').emit(48);
    const scope = generatedScopeAttribute('[data-testid="first-form"]');
    const styleElement = styleForScope(scope.value);

    expect(styleElement.hasAttribute('nonce')).toBe(false);
    expectNoInlineStyles(
      '[data-testid="first-form"]',
      '[data-testid="first-footer"]',
      '[data-testid="first-editor"]',
      '[data-testid="first-editor-secondary"]',
    );
  });

  it('ignores observer entries without a finite border-box block size', () => {
    createHost();
    const observer = observerFor('[data-testid="first-footer"]');
    const styleElement = document.head.querySelector<HTMLStyleElement>(
      `style[nonce="${TEST_NONCE}"]`,
    );
    if (styleElement === null) {
      throw new Error('Missing empty scoped style');
    }

    observer.emitWithoutBorderBoxSize();

    expect(styleElement.sheet?.cssRules).toHaveLength(0);
    expect(resolvedBottomInset('[data-testid="first-form"]')).toBe('');
  });

  it('fails closed when ResizeObserver is unavailable', () => {
    Reflect.deleteProperty(window, 'ResizeObserver');
    const stylesBefore = document.head.querySelectorAll(`style[nonce="${TEST_NONCE}"]`).length;

    createHost();

    expect(TestResizeObserver.instances).toHaveLength(0);
    expect(document.head.querySelectorAll(`style[nonce="${TEST_NONCE}"]`)).toHaveLength(
      stylesBefore,
    );
    expectNoGeneratedScope('[data-testid="first-form"]');
  });

  it('fails closed without observing or styling a scope from another document', () => {
    const foreignFixture = TestBed.createComponent(
      MarkdownEditorStickyBottomInsetForeignScopeTestHostComponent,
    );
    const stylesBefore = document.head.querySelectorAll(`style[nonce="${TEST_NONCE}"]`).length;

    expect(() => foreignFixture.detectChanges()).not.toThrow();

    expect(TestResizeObserver.instances).toHaveLength(0);
    expect(document.head.querySelectorAll(`style[nonce="${TEST_NONCE}"]`)).toHaveLength(
      stylesBefore,
    );
    expect(
      Array.from(foreignFixture.componentInstance.foreignScope.attributes).some((attribute) =>
        attribute.name.startsWith('data-markdown-editor-sticky-bottom-inset'),
      ),
    ).toBe(false);
    foreignFixture.destroy();
  });

  it('cleans up and fails closed when border-box observation cannot start', () => {
    TestResizeObserver.observeError = true;
    const stylesBefore = document.head.querySelectorAll(`style[nonce="${TEST_NONCE}"]`).length;

    expect(() => createHost()).not.toThrow();

    expect(TestResizeObserver.instances).toHaveLength(1);
    expect(TestResizeObserver.instances[0]?.disconnect).toHaveBeenCalledTimes(1);
    expect(document.head.querySelectorAll(`style[nonce="${TEST_NONCE}"]`)).toHaveLength(
      stylesBefore,
    );
    expectNoGeneratedScope('[data-testid="first-form"]');
  });

  function createHost(): void {
    fixture = TestBed.createComponent(MarkdownEditorStickyBottomInsetTestHostComponent);
    fixture.detectChanges();
  }

  function observerFor(selector: string): TestResizeObserver {
    const target = element(selector);
    const observer = TestResizeObserver.instances.find((candidate) => candidate.target === target);
    if (observer === undefined) {
      throw new Error(`Missing ResizeObserver for ${selector}`);
    }
    return observer;
  }

  function element(selector: string): HTMLElement {
    const matched = fixture?.debugElement.query(By.css(selector)).nativeElement as
      HTMLElement | undefined;
    if (matched === undefined) {
      throw new Error(`Missing element: ${selector}`);
    }
    return matched;
  }

  function resolvedBottomInset(selector: string): string {
    return window
      .getComputedStyle(element(selector))
      .getPropertyValue(BOTTOM_INSET_PROPERTY)
      .trim();
  }

  function expectNoInlineStyles(...selectors: readonly string[]): void {
    selectors.forEach((selector) => expect(element(selector).hasAttribute('style')).toBe(false));
  }

  function generatedScopeAttribute(selector: string): Attr {
    const attribute = Array.from(element(selector).attributes).find((candidate) =>
      candidate.name.startsWith('data-markdown-editor-sticky-bottom-inset'),
    );
    if (attribute === undefined) {
      throw new Error(`Missing generated scope attribute: ${selector}`);
    }
    return attribute;
  }

  function expectNoGeneratedScope(selector: string): void {
    expect(
      Array.from(element(selector).attributes).some((attribute) =>
        attribute.name.startsWith('data-markdown-editor-sticky-bottom-inset'),
      ),
    ).toBe(false);
  }

  function styleForScope(scope: string): HTMLStyleElement {
    const styleElement = Array.from(document.head.querySelectorAll<HTMLStyleElement>('style')).find(
      (candidate) => candidate.textContent?.includes(scope) === true,
    );
    if (styleElement === undefined) {
      throw new Error(`Missing style for scope: ${scope}`);
    }
    return styleElement;
  }
});

describe('MarkdownEditorStickyBottomInsetDirective on the server', () => {
  it('does not observe or mutate a server-rendered form', async () => {
    TestResizeObserver.instances.splice(0);
    const stylesBefore = document.head.querySelectorAll(`style[nonce="${TEST_NONCE}"]`).length;
    const resizeObserverDescriptor = Object.getOwnPropertyDescriptor(window, 'ResizeObserver');
    await TestBed.configureTestingModule({
      imports: [MarkdownEditorStickyBottomInsetTestHostComponent],
      providers: [
        { provide: CSP_NONCE, useValue: TEST_NONCE },
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    }).compileComponents();
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: TestResizeObserver,
      writable: true,
    });
    const fixture = TestBed.createComponent(MarkdownEditorStickyBottomInsetTestHostComponent);

    expect(() => fixture.detectChanges()).not.toThrow();
    const form = fixture.debugElement.query(By.css('[data-testid="first-form"]'))
      .nativeElement as HTMLElement;
    expect(TestResizeObserver.instances).toHaveLength(0);
    expect(document.head.querySelectorAll(`style[nonce="${TEST_NONCE}"]`)).toHaveLength(
      stylesBefore,
    );
    expect(
      Array.from(form.attributes).some((attribute) =>
        attribute.name.startsWith('data-markdown-editor-sticky-bottom-inset'),
      ),
    ).toBe(false);
    expect(form.hasAttribute('style')).toBe(false);
    fixture.destroy();
    if (resizeObserverDescriptor === undefined) {
      Reflect.deleteProperty(window, 'ResizeObserver');
    } else {
      Object.defineProperty(window, 'ResizeObserver', resizeObserverDescriptor);
    }
  });
});
