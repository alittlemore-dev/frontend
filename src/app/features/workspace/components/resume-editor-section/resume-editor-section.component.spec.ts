import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResumeEditorSectionComponent } from './resume-editor-section.component';

@Component({
  imports: [ResumeEditorSectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-resume-editor-section
    sectionKey="test"
    title="Company"
    summary="Engineer · 2024"
    backToStartLabel="Back to section start"
    [expanded]="expanded()"
    (expandedChange)="expanded.set($event)"
  >
    <button resumeSectionActions type="button">Remove</button>
    <input aria-label="Role" />
  </app-resume-editor-section>`,
})
class TestHostComponent {
  readonly expanded = signal(false);
}

describe('ResumeEditorSectionComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TestHostComponent] }).compileComponents();
  });

  function create(): void {
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
  }

  function toggle(): HTMLButtonElement {
    return fixture.nativeElement.querySelector('[data-testid="resume-group-toggle-test"]');
  }

  it('uses a named disclosure button and keeps entered content when folded', () => {
    create();
    const body: HTMLElement = fixture.nativeElement.querySelector('#resume-group-body-test');
    expect(body.hidden).toBe(true);
    expect(toggle().textContent).toContain('Company');
    expect(toggle().textContent).toContain('Engineer · 2024');
    toggle().click();
    fixture.detectChanges();
    expect(body.hidden).toBe(false);
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    input.value = 'Tech Lead';
    toggle().click();
    fixture.detectChanges();
    toggle().click();
    fixture.detectChanges();
    expect(input.value).toBe('Tech Lead');
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
  });

  it('returns to the section start and focuses its disclosure when the header sticks', () => {
    let notify: IntersectionObserverCallback | undefined;
    const disconnect = jest.fn();
    const original = window.IntersectionObserver;
    window.IntersectionObserver = jest
      .fn()
      .mockImplementation((callback: IntersectionObserverCallback) => {
        notify = callback;
        return { observe: jest.fn(), disconnect };
      });
    try {
      create();
      toggle().click();
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector('[aria-label="Back to section start"]'),
      ).toBeNull();
      notify?.(
        [{ isIntersecting: false, boundingClientRect: { top: -10 } } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
      fixture.detectChanges();
      const host: HTMLElement = fixture.nativeElement.querySelector('app-resume-editor-section');
      host.scrollIntoView = jest.fn();
      const focus = jest.spyOn(toggle(), 'focus');
      const back: HTMLButtonElement = fixture.nativeElement.querySelector(
        '[aria-label="Back to section start"]',
      );
      expect(back).not.toBeNull();
      back.click();
      expect(host.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
      expect(focus).toHaveBeenCalledWith({ preventScroll: true });
      fixture.destroy();
      expect(disconnect).toHaveBeenCalled();
    } finally {
      window.IntersectionObserver = original;
    }
  });

  it('renders with a server document without browser observers', () => {
    TestBed.overrideProvider(DOCUMENT, { useValue: document.implementation.createHTMLDocument() });
    expect(() => create()).not.toThrow();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
  });
});
