import { ChangeDetectionStrategy, Component, PLATFORM_ID, signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TextareaAutosizeDirective } from './textarea-autosize.directive';

const CONTROL_STYLES = 'box-sizing: border-box; padding: 6px 12px; border: 1px solid';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, TextareaAutosizeDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<textarea
    appTextareaAutosize
    rows="3"
    [formControl]="text"
    style="${CONTROL_STYLES}"
  ></textarea>`,
})
class TestHostComponent {
  readonly text = new FormControl('First\nSecond\nThird\nFourth\nFifth', { nonNullable: true });
}

@Component({
  standalone: true,
  imports: [TextareaAutosizeDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<textarea appTextareaAutosize [value]="text()" style="${CONTROL_STYLES}"></textarea>`,
})
class ValueHostComponent {
  readonly text = signal('Short');
}

class TestResizeObserver implements ResizeObserver {
  static readonly instances: TestResizeObserver[] = [];
  readonly observe = jest.fn();
  readonly unobserve = jest.fn();
  readonly disconnect = jest.fn();

  constructor(private readonly callback: ResizeObserverCallback) {
    TestResizeObserver.instances.push(this);
  }

  resize(width: number): void {
    this.callback([{ contentRect: { width } } as ResizeObserverEntry], this);
  }
}

describe('TextareaAutosizeDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let layoutWidth: number;
  let originalObserver: PropertyDescriptor | undefined;

  beforeEach(async () => {
    layoutWidth = 200;
    TestResizeObserver.instances.length = 0;
    originalObserver = Object.getOwnPropertyDescriptor(window, 'ResizeObserver');
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: TestResizeObserver,
    });
    // JSDOM has no layout; model the native rows, wrapping, padding, and box sizing.
    jest.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (!(this instanceof HTMLTextAreaElement) || layoutWidth === 0) return 0;
      const height = parseFloat(this.style.height);
      if (!Number.isFinite(height)) return this.rows * 20 + 12;
      return this.style.boxSizing === 'border-box' ? height - 2 : height + 12;
    });
    jest.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (!(this instanceof HTMLTextAreaElement) || layoutWidth === 0) return 0;
      const charactersPerLine = (layoutWidth - 26) / 10;
      const lines = this.value
        .split('\n')
        .reduce(
          (total, line) => total + Math.max(1, Math.ceil(line.length / charactersPerLine)),
          0,
        );
      return Math.max(this.clientHeight, lines * 20 + 12);
    });
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
      x: 0,
      y: 0,
      width: layoutWidth,
      height: 20,
      top: 0,
      right: layoutWidth,
      bottom: 20,
      left: 0,
      toJSON: () => ({}),
    }));
    await TestBed.configureTestingModule({
      imports: [TestHostComponent, ValueHostComponent],
    }).compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
    jest.restoreAllMocks();
    if (originalObserver) Object.defineProperty(window, 'ResizeObserver', originalObserver);
    else Reflect.deleteProperty(window, 'ResizeObserver');
  });

  function render(): HTMLTextAreaElement {
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
  }

  it('fits initial content including padding and borders', () => {
    const textarea = render();
    expect(textarea.style.height).toBe('114px');
    expect(textarea.clientHeight).toBe(textarea.scrollHeight);
    expect(textarea.rows).toBe(3);
  });

  it('grows on input and shrinks to its minimum rows after a programmatic form update', fakeAsync(() => {
    const textarea = render();
    textarea.value = 'One\nTwo\nThree\nFour\nFive\nSix';
    textarea.dispatchEvent(new Event('input'));
    tick(16);
    expect(textarea.style.height).toBe('134px');

    fixture.componentInstance.text.setValue('Short');
    tick(16);
    expect(textarea.style.height).toBe('74px');
    expect(textarea.clientHeight).toBe(textarea.scrollHeight);
  }));

  it('retains the native content width when reflowing unchanged text', fakeAsync(() => {
    const textarea = render();
    fixture.componentInstance.text.setValue('a'.repeat(40));
    tick(16);
    expect(textarea.style.height).toBe('74px');

    layoutWidth = 100;
    TestResizeObserver.instances[0].resize(layoutWidth);
    expect(textarea.style.height).toBe('134px');
    expect(textarea.clientHeight).toBe(textarea.scrollHeight);

    layoutWidth = 400;
    TestResizeObserver.instances[0].resize(layoutWidth);
    expect(textarea.style.height).toBe('74px');
    expect(textarea.style.padding).toBe('6px 12px');
    expect(textarea.style.boxSizing).toBe('border-box');
  }));

  it('handles content-box sizing without counting padding twice', fakeAsync(() => {
    const textarea = render();
    textarea.style.boxSizing = 'content-box';
    fixture.componentInstance.text.setValue('First\nSecond\nThird\nFourth');
    tick(16);
    expect(textarea.style.height).toBe('80px');
    expect(textarea.clientHeight).toBe(textarea.scrollHeight);
  }));

  it('measures a textarea when its hidden container becomes visible', () => {
    layoutWidth = 0;
    const textarea = render();
    expect(textarea.style.height).toBe('');

    layoutWidth = 200;
    TestResizeObserver.instances[0].resize(layoutWidth);
    expect(textarea.style.height).toBe('114px');
  });

  it('uses one row by default and resizes after a signal value binding changes', () => {
    const valueFixture = TestBed.createComponent(ValueHostComponent);
    valueFixture.detectChanges();
    const textarea = valueFixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.rows).toBe(1);
    expect(textarea.style.height).toBe('34px');

    valueFixture.componentInstance.text.set('First\nSecond\nThird\nFourth\nFifth');
    valueFixture.detectChanges();
    expect(textarea.style.height).toBe('114px');
    valueFixture.destroy();
  });

  it('disconnects its observer and cancels pending sizing when destroyed', fakeAsync(() => {
    const textarea = render();
    const observer = TestResizeObserver.instances[0];
    const cancellation = jest.spyOn(window, 'cancelAnimationFrame');
    expect(observer.observe).toHaveBeenCalledWith(textarea);
    fixture.componentInstance.text.setValue('Short');
    fixture.destroy();
    tick(16);
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
    expect(cancellation).toHaveBeenCalledTimes(1);
    expect(textarea.style.height).toBe('114px');
  }));

  it('does not measure or observe controls during server rendering', () => {
    TestBed.overrideProvider(PLATFORM_ID, { useValue: 'server' });
    const measurement = jest.spyOn(window, 'getComputedStyle');
    const textarea = render();
    expect(textarea.style.height).toBe('');
    expect(measurement).not.toHaveBeenCalled();
    expect(TestResizeObserver.instances).toHaveLength(0);
  });
});
