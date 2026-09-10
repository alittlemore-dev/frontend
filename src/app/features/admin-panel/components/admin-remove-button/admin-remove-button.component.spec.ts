import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminRemoveButtonComponent } from './admin-remove-button.component';

describe('AdminRemoveButtonComponent', () => {
  let fixture: ComponentFixture<AdminRemoveButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminRemoveButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminRemoveButtonComponent);
  });

  it('renders an accessible minus action with the supplied test id', () => {
    fixture.componentRef.setInput('ariaLabel', 'Remove cover image');
    fixture.componentRef.setInput('testId', 'remove-cover-image');
    fixture.componentRef.setInput('disabled', false);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector<HTMLButtonElement>(
      '[data-testid="remove-cover-image"]',
    );

    expect(button?.getAttribute('aria-label')).toBe('Remove cover image');
    expect(button?.getAttribute('title')).toBe('Remove cover image');
    expect(button?.textContent?.trim()).toBe('−');
  });

  it('emits remove only while the action is enabled', () => {
    fixture.componentRef.setInput('ariaLabel', 'Remove cover image');
    fixture.componentRef.setInput('testId', 'remove-cover-image');
    fixture.componentRef.setInput('disabled', false);
    fixture.detectChanges();
    const remove = jest.fn();
    fixture.componentInstance.remove.subscribe(remove);
    const button = fixture.nativeElement.querySelector<HTMLButtonElement>(
      '[data-testid="remove-cover-image"]',
    );

    button.click();
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    button.click();

    expect(remove).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
  });
});
