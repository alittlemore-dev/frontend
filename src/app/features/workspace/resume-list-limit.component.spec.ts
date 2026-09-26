import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../testing/i18n-testing';
import { ResumeListLimitComponent } from './resume-list-limit.component';

describe('ResumeListLimitComponent', () => {
  let fixture: ComponentFixture<ResumeListLimitComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResumeListLimitComponent],
      providers: [provideI18nTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(ResumeListLimitComponent);
    fixture.componentRef.setInput('count', 2);
    fixture.componentRef.setInput('max', 3);
    fixture.componentRef.setInput('totalCount', 9);
    fixture.componentRef.setInput('totalMax', 10);
    fixture.detectChanges();
  });

  it('shows local and resume-wide counts and explains either reached limit', () => {
    expect(fixture.nativeElement.textContent.replace(/\s+/g, ' ')).toContain('2/3 · всего 9/10');
    expect(fixture.nativeElement.textContent).not.toContain('лимит');

    fixture.componentRef.setInput('totalCount', 10);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('лимит');
    expect(fixture.nativeElement.getAttribute('title')).toContain('Во всём резюме 10 из 10');
    expect(fixture.nativeElement.getAttribute('title')).toContain(
      'добавить ещё один элемент нельзя',
    );

    fixture.componentRef.setInput('totalCount', 9);
    fixture.componentRef.setInput('count', 3);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('3/3');
    expect(fixture.nativeElement.textContent).toContain('лимит');
  });
});
