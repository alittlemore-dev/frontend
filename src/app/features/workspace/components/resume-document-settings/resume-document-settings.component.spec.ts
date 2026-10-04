import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { ResumeSettings } from '../../models/resume-workspace.model';
import { ResumeDocumentSettingsComponent } from './resume-document-settings.component';

@Component({
  imports: [ResumeDocumentSettingsComponent],
  template: `<app-resume-document-settings
    [settings]="settings()"
    [disabled]="disabled()"
    (settingsChange)="settings.set($event)"
  />`,
})
class HostComponent {
  readonly settings = signal<ResumeSettings>({
    dateFormat: 'year',
    sectionOrder: [],
    hiddenSections: [],
  });
  readonly disabled = signal(false);
}

describe('ResumeDocumentSettingsComponent', () => {
  function create(): ReturnType<typeof TestBed.createComponent<HostComponent>> {
    TestBed.configureTestingModule({ imports: [HostComponent], providers: [provideI18nTesting()] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('reorders sections using the keyboard and retains visibility and date settings', () => {
    const fixture = create();
    const rows = fixture.nativeElement.querySelectorAll(
      '[tabindex="0"]',
    ) as NodeListOf<HTMLElement>;
    const row = rows[2];
    row.focus();
    row.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        altKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    fixture.detectChanges();
    expect(fixture.componentInstance.settings().sectionOrder.slice(0, 3)).toEqual([
      'summary',
      'experience',
      'skills',
    ]);
    expect(fixture.componentInstance.settings().dateFormat).toBe('year');
    expect(fixture.nativeElement.querySelectorAll('[tabindex="0"]')[1].textContent).toContain(
      'Опыт',
    );
    expect(fixture.componentInstance.settings().hiddenSections).toEqual([]);
    expect(document.activeElement).toBe(row);
    row.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true }),
    );
    fixture.detectChanges();
    expect(document.activeElement).toBe(row);
    expect(fixture.componentInstance.settings().sectionOrder.slice(0, 3)).toEqual([
      'experience',
      'summary',
      'skills',
    ]);
  });

  it('hides a section without changing the order or removing its settings row', () => {
    const fixture = create();
    const checkbox = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    checkbox.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.settings().hiddenSections).toEqual(['summary']);
    expect(fixture.componentInstance.settings().sectionOrder).toEqual([]);
    expect(fixture.nativeElement.querySelectorAll('input')).toHaveLength(7);
    checkbox.click();
    expect(fixture.componentInstance.settings().hiddenSections).toEqual([]);
  });

  it('ignores keyboard reordering while busy and disables visibility controls', () => {
    const fixture = create();
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector('[tabindex="0"]')
      .dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }),
      );
    expect(fixture.componentInstance.settings().sectionOrder).toEqual([]);
    expect((fixture.nativeElement.querySelector('input') as HTMLInputElement).disabled).toBe(true);
  });
});
