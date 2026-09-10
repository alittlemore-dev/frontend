import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { MatrixQuestionPublicPreviewComponent } from './matrix-question-public-preview.component';

describe('MatrixQuestionPublicPreviewComponent', () => {
  let fixture: ComponentFixture<MatrixQuestionPublicPreviewComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatrixQuestionPublicPreviewComponent],
      providers: [provideI18nTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MatrixQuestionPublicPreviewComponent);
    fixture.componentRef.setInput('question', 'What is typing?');
    fixture.componentRef.setInput('answer', 'Use **types**.');
    fixture.componentRef.setInput('interviewAnswerExplanation', 'Explain `Protocol`.');
    fixture.componentRef.setInput('interviewFrequency', 'often');
    fixture.componentRef.setInput('resources', [
      {
        key: 'python-docs',
        name: 'Python docs',
        url: 'https://docs.python.org',
        context: 'Read the typing section',
      },
    ]);
    fixture.componentRef.setInput('language', 'en');
    fixture.componentRef.setInput('bundleVersion', 0);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  it('renders the public question content shape from preview inputs', () => {
    expect(element.textContent).toContain('Question:');
    expect(element.textContent).toContain('Answer:');
    expect(element.textContent).toContain('Interview answer explanation:');
    expect(element.textContent).toContain('External resources:');
    expect(element.textContent).not.toContain('Вопрос:');
    expect(element.textContent).toContain('What is typing?');
    expect(element.querySelector('strong')?.textContent).toBe('types');
    expect(element.querySelector('code')?.textContent).toBe('Protocol');
    expect(element.textContent).toContain('Python docs');
    expect(element.textContent).toContain('Read the typing section');
    expect(element.querySelector('a')?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('sanitizes unsafe authored Markdown before binding HTML', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    fixture.componentRef.setInput(
      'answer',
      [
        '<script>alert("script")</script>',
        '<img src="x" onerror="alert(2)">',
        '<a href="javascript:alert(3)">unsafe</a>',
      ].join('\n'),
    );
    fixture.detectChanges();

    const answer = element.querySelectorAll('div')[0];
    expect(answer?.innerHTML).not.toContain('<script');
    expect(answer?.innerHTML).not.toContain('onerror');
    expect(answer?.innerHTML).not.toMatch(/href=["']javascript:/i);
    expect(answer?.textContent).toContain('unsafe');
    expect(warnSpy).toHaveBeenCalled();
  });

  it('renders highlighted fenced code in the authoring preview', () => {
    fixture.componentRef.setInput('answer', '```python\ndef answer():\n    return 42\n```');
    fixture.detectChanges();

    expect(element.querySelector('code.language-python')).toBeTruthy();
    expect(element.querySelector('.token.keyword')?.textContent).toBe('def');
  });
});
