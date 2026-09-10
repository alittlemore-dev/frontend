import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminAction, AdminActionsDropdownComponent } from './admin-actions-dropdown.component';

describe('AdminActionsDropdownComponent', () => {
  let fixture: ComponentFixture<AdminActionsDropdownComponent>;
  const actions: readonly AdminAction[] = [
    { id: 'edit', label: 'Редактировать', destructive: false, disabled: false },
    { id: 'delete', label: 'Удалить', destructive: true, disabled: false },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminActionsDropdownComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminActionsDropdownComponent);
    fixture.componentRef.setInput('actions', actions);
    fixture.componentRef.setInput('buttonLabel', 'Действия');
    fixture.componentRef.setInput('ariaLabel', 'Действия');
    fixture.componentRef.setInput('destructiveActionLabel', 'опасное действие');
    fixture.componentRef.setInput('testId', 'article-actions-typed-articles');
    fixture.detectChanges();
  });

  it('connects the trigger to an auto popover and synchronizes its accessible state', () => {
    const toggle = dropdownToggle();
    const menu = dropdownMenu();

    expect(toggle.textContent).toContain('Действия');
    expect(toggle.getAttribute('popovertarget')).toBe(menu.id);
    expect(toggle.getAttribute('popovertargetaction')).toBe('toggle');
    expect(menu.getAttribute('popover')).toBe('auto');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    dispatchToggle(menu, 'open');
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    dispatchToggle(menu, 'closed');
    fixture.detectChanges();

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('uses stylesheet-owned popover positioning for strict style-src-attr CSP', () => {
    const menu = dropdownMenu();

    expect(menu.getAttribute('data-bs-popper')).toBeNull();
    expect(menu.getAttribute('popover')).toBe('auto');
    expect(menu.classList).toContain('dropdown-menu');
    expect(menu.getAttribute('style')).toBeNull();
  });

  it('emits the selected action, closes the popover, and marks destructive actions', () => {
    const selected = jest.fn();
    const menu = dropdownMenu();
    const hidePopover = mockHidePopover(menu);
    fixture.componentInstance.actionSelected.subscribe(selected);

    dispatchToggle(menu, 'open');
    fixture.detectChanges();
    const deleteAction = fixture.nativeElement.querySelector(
      '[data-testid="article-actions-typed-articles-delete"]',
    ) as HTMLButtonElement;
    deleteAction.click();
    fixture.detectChanges();

    expect(deleteAction.classList).toContain('text-danger');
    expect(deleteAction.getAttribute('aria-label')).toBe('Удалить, опасное действие');
    expect(selected).toHaveBeenCalledWith('delete');
    expect(hidePopover).toHaveBeenCalledTimes(1);
    expect(dropdownToggle().getAttribute('aria-expanded')).toBe('false');
  });

  it('closes an open popover when the viewport changes', () => {
    const menu = dropdownMenu();
    const hidePopover = mockHidePopover(menu);
    dispatchToggle(menu, 'open');
    fixture.detectChanges();

    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();

    expect(hidePopover).toHaveBeenCalledTimes(1);
    expect(dropdownToggle().getAttribute('aria-expanded')).toBe('false');
  });

  it('hides unavailable actions instead of rendering disabled buttons', () => {
    fixture.componentRef.setInput('actions', [
      { id: 'edit', label: 'Редактировать', destructive: false, disabled: false },
      { id: 'delete', label: 'Удалить', destructive: true, disabled: true },
    ]);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="article-actions-typed-articles-edit"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="article-actions-typed-articles-delete"]'),
    ).toBeNull();
  });

  it('hides the dropdown trigger when every action is unavailable', () => {
    fixture.componentRef.setInput('actions', [
      { id: 'delete', label: 'Удалить', destructive: true, disabled: true },
    ]);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="article-actions-typed-articles-toggle"]'),
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="article-actions-typed-articles-menu"]'),
    ).toBeNull();
  });

  function dropdownToggle(): HTMLButtonElement {
    const toggle = fixture.nativeElement.querySelector(
      '[data-testid="article-actions-typed-articles-toggle"]',
    ) as HTMLButtonElement | null;
    expect(toggle).not.toBeNull();
    return toggle as HTMLButtonElement;
  }

  function dropdownMenu(): HTMLElement {
    const menu = fixture.nativeElement.querySelector(
      '[data-testid="article-actions-typed-articles-menu"]',
    ) as HTMLElement | null;
    expect(menu).not.toBeNull();
    return menu as HTMLElement;
  }

  function dispatchToggle(menu: HTMLElement, newState: 'open' | 'closed'): void {
    const event = new Event('toggle');
    Object.defineProperty(event, 'newState', { value: newState });
    menu.dispatchEvent(event);
  }

  function mockHidePopover(menu: HTMLElement): jest.Mock<void, []> {
    const hidePopover = jest.fn<void, []>();
    Object.defineProperty(menu, 'hidePopover', {
      configurable: true,
      value: hidePopover,
    });
    return hidePopover;
  }
});
