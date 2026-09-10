import { ComponentFixture } from '@angular/core/testing';

export function chooseSiteSelectOption<T>(
  fixture: ComponentFixture<T>,
  selector: string,
  value: string,
): void {
  const trigger = siteSelectTrigger(fixture, selector);
  if (trigger.getAttribute('aria-expanded') !== 'true') {
    trigger.click();
    fixture.detectChanges();
  }
  const option = siteSelectOptions(fixture, trigger).find(
    (candidate) => candidate.dataset['value'] === value,
  );
  if (option === undefined) {
    throw new Error(`Site select option "${value}" not found for selector "${selector}"`);
  }
  option.click();
  fixture.detectChanges();
}

export function siteSelectOptionValues<T>(
  fixture: ComponentFixture<T>,
  selector: string,
): string[] {
  return siteSelectOptions(fixture, siteSelectTrigger(fixture, selector)).map(
    (option) => option.dataset['value'] ?? '',
  );
}

export function siteSelectOptionLabels<T>(
  fixture: ComponentFixture<T>,
  selector: string,
): string[] {
  return siteSelectOptions(fixture, siteSelectTrigger(fixture, selector)).map(
    (option) => option.textContent?.trim() ?? '',
  );
}

export function siteSelectValue<T>(fixture: ComponentFixture<T>, selector: string): string {
  const selected = siteSelectOptions(fixture, siteSelectTrigger(fixture, selector)).find((option) =>
    option.classList.contains('site-select-option-committed'),
  );
  return selected?.dataset['value'] ?? '';
}

export function siteSelectTrigger<T>(
  fixture: ComponentFixture<T>,
  selector: string,
): HTMLButtonElement {
  const trigger = fixture.nativeElement.querySelector(selector) as HTMLElement | null;
  if (!(trigger instanceof HTMLButtonElement) || trigger.getAttribute('role') !== 'combobox') {
    throw new Error(`Site select trigger not found for selector "${selector}"`);
  }
  return trigger;
}

function siteSelectOptions<T>(
  fixture: ComponentFixture<T>,
  trigger: HTMLButtonElement,
): HTMLElement[] {
  const listboxId = trigger.getAttribute('aria-controls');
  if (listboxId === null) {
    throw new Error('Site select trigger does not reference a listbox');
  }
  const listbox = fixture.nativeElement.querySelector(`#${listboxId}`) as HTMLElement | null;
  if (listbox === null) {
    throw new Error(`Site select listbox "${listboxId}" not found`);
  }
  return Array.from(listbox.querySelectorAll<HTMLElement>('[role="option"]'));
}
