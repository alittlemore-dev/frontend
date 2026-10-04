import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  chooseSiteSelectOption,
  siteSelectOptionLabels,
} from '@alittlemore.dev/design-system/testing';
import { ResumeEditorNavigationComponent } from './resume-editor-navigation.component';

describe('ResumeEditorNavigationComponent', () => {
  let fixture: ComponentFixture<ResumeEditorNavigationComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ResumeEditorNavigationComponent] });
    fixture = TestBed.createComponent(ResumeEditorNavigationComponent);
    fixture.componentRef.setInput('items', [
      { key: 'profile', label: 'Profile', selectLabel: 'Profile', count: null, errors: 0 },
      { key: 'skills', label: 'Skills', selectLabel: 'Skills · Errors: 2', count: 3, errors: 2 },
    ]);
    fixture.componentRef.setInput('activeKey', 'profile');
    fixture.componentRef.setInput('label', 'Sections');
    fixture.componentRef.setInput('textLabel', 'Text');
    fixture.componentRef.setInput('textCount', 100);
    fixture.componentRef.setInput('textMax', 1000);
    fixture.componentRef.setInput('textTitle', '100 / 1000');
    fixture.detectChanges();
  });

  it('keeps section errors visible and emits desktop and mobile selection', () => {
    const selected = jest.fn();
    fixture.componentInstance.selected.subscribe(selected);
    const button = fixture.nativeElement.querySelector(
      '[data-testid="resume-section-nav-skills"]',
    ) as HTMLButtonElement;
    expect(button.getAttribute('aria-invalid')).toBe('true');
    expect(button.textContent).toContain('2');
    expect(siteSelectOptionLabels(fixture, '#resume-section-select')).toContain(
      'Skills · Errors: 2',
    );
    button.click();
    expect(selected).toHaveBeenLastCalledWith('skills');
    chooseSiteSelectOption(fixture, '#resume-section-select', 'skills');
    expect(selected).toHaveBeenLastCalledWith('skills');
  });
});
