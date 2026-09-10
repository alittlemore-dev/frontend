import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiError } from '../../../../../../core/models/api-error.model';
import { provideI18nTesting } from '../../../../../../testing/i18n-testing';
import { MatrixQuestionDetail } from '../../../../models/matrix-question.model';
import { MatrixQuestionDetailComponent } from './matrix-question-detail.component';

const mockDetail: MatrixQuestionDetail = {
  slug: 'what-is-a-closure',
  question: 'What is a closure?',
  answer: 'A **closure** is a function with access to its outer scope.',
  interviewAnswerExplanation: 'Demonstrate understanding of lexical scoping.',
  sheetKey: 'javascript',
  sheet: 'JavaScript',
  grade: 'Junior',
  interviewFrequency: 'often',
  section: 'Core',
  subsection: 'Syntax',
  publishStatus: 'Published',
  suggestedByUsername: 'anon',
  translations: {
    ru: {
      question: 'Что такое замыкание?',
      answer: 'Замыкание — это функция.',
      interviewAnswerExplanation: 'Лексическая область видимости.',
      sheet: 'JavaScript',
      section: 'Core',
      subsection: 'Syntax',
    },
    en: {
      question: 'What is a closure?',
      answer: 'A **closure** is a function with access to its outer scope.',
      interviewAnswerExplanation: 'Demonstrate understanding of lexical scoping.',
      sheet: 'JavaScript',
      section: 'Core',
      subsection: 'Syntax',
    },
  },
  resources: [
    {
      id: '00000000000000000000000000000010',
      name: 'MDN',
      url: 'https://mdn.io',
      context: 'See MDN docs',
      translations: {
        ru: { name: 'MDN', context: 'См. документацию MDN' },
        en: { name: 'MDN', context: 'See MDN docs' },
      },
    },
  ],
};

const mockError: ApiError = {
  code: 'server_error',
  type: 'server_error',
  message: 'Internal server error',
  location: null,
  attr: null,
};

describe('MatrixQuestionDetailComponent', () => {
  let fixture: ComponentFixture<MatrixQuestionDetailComponent>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatrixQuestionDetailComponent],
      providers: [provideI18nTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MatrixQuestionDetailComponent);
    fixture.componentRef.setInput('language', 'ru');
    el = fixture.nativeElement as HTMLElement;
  });

  it('should show loading spinner when loading', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.componentRef.setInput('question', null);
    fixture.componentRef.setInput('error', null);
    fixture.detectChanges();
    expect(el.querySelector('app-loading-spinner')).toBeTruthy();
  });

  it('should show error when error is set', () => {
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('question', null);
    fixture.componentRef.setInput('error', mockError);
    fixture.detectChanges();
    expect(el.querySelector('app-error-message')).toBeTruthy();
  });

  it('should show nothing when question is null and no loading/error', () => {
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('question', null);
    fixture.componentRef.setInput('error', null);
    fixture.detectChanges();
    expect(el.querySelector('.question-detail')).toBeFalsy();
  });

  it('should render question text when question is set', () => {
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('question', mockDetail);
    fixture.componentRef.setInput('error', null);
    fixture.detectChanges();
    expect(el.textContent).toContain('What is a closure?');
    expect(el.textContent).toContain('Кто предложил: Анонимный');
  });

  it('should render a real suggester username without localization', () => {
    fixture.componentRef.setInput('question', {
      ...mockDetail,
      suggestedByUsername: 'alice',
    });
    fixture.detectChanges();

    expect(el.textContent).toContain('Кто предложил: alice');
  });

  it('does not render the public question page link inside detail content', () => {
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('question', mockDetail);
    fixture.componentRef.setInput('error', null);
    fixture.detectChanges();

    expect(
      el.querySelector('a[href="/ru/competency-matrix/questions/what-is-a-closure"]'),
    ).toBeNull();
  });

  it('should render detail headings in Russian', () => {
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('question', mockDetail);
    fixture.componentRef.setInput('error', null);
    fixture.detectChanges();
    const headings = Array.from(el.querySelectorAll('h2')).map((heading) =>
      heading.textContent?.trim(),
    );
    expect(headings).toContain('Вопрос:');
    expect(headings).toContain('Ответ:');
    expect(headings).toContain('Объяснение ответа на собеседовании:');
    expect(headings).not.toContain('Как часто спрашивают:');
  });

  it('should render localized interview frequency as an inline detail row when it is set', () => {
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('question', mockDetail);
    fixture.componentRef.setInput('error', null);
    fixture.detectChanges();

    const paragraphs = Array.from(el.querySelectorAll('p')).map((paragraph) =>
      paragraph.textContent?.trim(),
    );
    expect(paragraphs).toContain('Как часто спрашивают: Часто');
    expect(el.querySelector('.badge')).toBeNull();
  });

  it('should hide interview frequency when it is not set', () => {
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('question', { ...mockDetail, interviewFrequency: null });
    fixture.componentRef.setInput('error', null);
    fixture.detectChanges();

    expect(el.textContent).not.toContain('Как часто спрашивают:');
  });

  it('should render answer as HTML (markdown converted)', () => {
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('question', mockDetail);
    fixture.componentRef.setInput('error', null);
    fixture.detectChanges();
    const answerDiv = el.querySelector('.question-detail div');
    expect(answerDiv?.innerHTML).toContain('<strong>');
  });

  it('should render fenced code blocks with real syntax highlighting', () => {
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('question', {
      ...mockDetail,
      answer: '```ts\nconst answer = 42;\n```',
    });
    fixture.componentRef.setInput('error', null);
    fixture.detectChanges();

    const pre = el.querySelector('pre.markdown-code');
    const code = el.querySelector('code.language-ts');
    expect(pre).toBeTruthy();
    expect(code?.textContent).toContain('const answer = 42;');
    expect(code?.querySelector('.token.keyword')?.textContent).toBe('const');
    expect(code?.querySelector('.token.number')?.textContent).toBe('42');
  });

  it('should render typed wiki links with the active language prefix', () => {
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('question', {
      ...mockDetail,
      answer: 'Read [[articles:typed-articles|typed article]].',
    });
    fixture.componentRef.setInput('error', null);
    fixture.componentRef.setInput('language', 'en');
    fixture.detectChanges();

    const link = el.querySelector<HTMLAnchorElement>('a[href="/en/articles/typed-articles"]');
    expect(link?.textContent).toBe('typed article');
  });

  it('should render resources', () => {
    fixture.componentRef.setInput('loading', false);
    fixture.componentRef.setInput('question', mockDetail);
    fixture.componentRef.setInput('error', null);
    fixture.detectChanges();
    expect(el.textContent).toContain('MDN');
    expect(el.querySelector('a[href="https://mdn.io"]')).toBeTruthy();
  });
});
