import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideI18nTesting } from '../../../testing/i18n-testing';
import { SectionNavigationComponent } from './section-navigation.component';

describe('SectionNavigationComponent', () => {
  it('keeps native links and intercepts only ordinary primary clicks for Angular routing', async () => {
    await TestBed.configureTestingModule({
      imports: [SectionNavigationComponent],
      providers: [provideRouter([]), provideI18nTesting()],
    }).compileComponents();
    const fixture = TestBed.createComponent(SectionNavigationComponent);
    fixture.componentRef.setInput('id', 'test-sections');
    fixture.componentRef.setInput('label', 'Sections');
    fixture.componentRef.setInput('home', {
      key: 'home',
      labelKey: 'workspace.section.dashboard',
      route: '/home',
      icon: 'dashboard',
    });
    fixture.componentRef.setInput('groups', [
      {
        key: 'content',
        labelKey: 'workspace.section.knowledge',
        pages: [
          { key: 'people', labelKey: 'workspace.section.people', route: '/people', icon: 'people' },
        ],
      },
    ]);
    fixture.componentRef.setInput('selectedKey', 'people');
    fixture.detectChanges();
    const navigate = jest.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const selected = jest.fn();
    fixture.componentInstance.linkSelected.subscribe(selected);
    const link = fixture.nativeElement.querySelector('a[href="/people"]') as HTMLAnchorElement;
    expect(link.getAttribute('aria-current')).toBe('page');
    const ordinary = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(ordinary);
    expect(ordinary.defaultPrevented).toBe(true);
    expect(navigate).toHaveBeenCalledWith('/people');
    expect(selected).toHaveBeenCalledTimes(1);
    navigate.mockClear();
    selected.mockClear();
    let preventedByNavigation = false;
    link.addEventListener(
      'click',
      (event) => {
        preventedByNavigation = event.defaultPrevented;
        event.preventDefault();
      },
      { once: true },
    );
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
    expect(preventedByNavigation).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    expect(selected).not.toHaveBeenCalled();
    fixture.destroy();
  });
});
