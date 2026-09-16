import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DropdownAction, ActionsDropdownComponent } from './actions-dropdown.component';

describe('ActionsDropdownComponent', () => {
  let fixture: ComponentFixture<ActionsDropdownComponent>;
  const actions: readonly DropdownAction[] = [
    { id: 'edit', label: 'Редактировать', destructive: false, disabled: false },
    { id: 'delete', label: 'Удалить', destructive: true, disabled: false },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActionsDropdownComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ActionsDropdownComponent);
    fixture.componentRef.setInput('actions', actions);
    fixture.componentRef.setInput('buttonLabel', 'Действия');
    fixture.componentRef.setInput('ariaLabel', 'Действия с записью');
    fixture.componentRef.setInput('destructiveActionLabel', 'опасное действие');
    fixture.componentRef.setInput('testId', 'record-actions');
    fixture.detectChanges();
  });

  it('emits a destructive selection with an explicit accessible warning', () => {
    const selected: string[] = [];
    fixture.componentInstance.actionSelected.subscribe((action) => selected.push(action));
    const deleteButton = element<HTMLButtonElement>('[data-testid="record-actions-delete"]');
    deleteButton.click();
    fixture.detectChanges();
    expect(deleteButton.getAttribute('aria-label')).toBe('Удалить, опасное действие');
    expect(selected).toEqual(['delete']);
  });

  it('does not offer actions that the caller marked unavailable', () => {
    fixture.componentRef.setInput('actions', [
      { id: 'edit', label: 'Редактировать', destructive: false, disabled: false },
      { id: 'delete', label: 'Удалить', destructive: true, disabled: true },
    ]);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="record-actions-edit"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="record-actions-delete"]')).toBeNull();

    fixture.componentRef.setInput('actions', [
      { id: 'delete', label: 'Удалить', destructive: true, disabled: true },
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('ds-dropdown')).toBeNull();
  });

  function element<T extends Element>(selector: string): T {
    const value = fixture.nativeElement.querySelector(selector) as T | null;
    if (value === null) {
      throw new Error(`Missing element: ${selector}`);
    }
    return value;
  }
});
