import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { chooseSiteSelectOption, siteSelectValue } from '../../../../testing/site-select-testing';
import { MarkdownEditorComponent } from '../../../../core/editor/markdown-editor.component';
import { MarkdownEditorStickyBottomInsetDirective } from '../../../../core/editor/markdown-editor.sticky-bottom-inset.directive';
import {
  AdminMatrixQuestionDetailDto,
  AdminMatrixQuestionPayload,
  AdminMatrixResource,
} from '../../models/matrix-question-workspace.model';
import { MatrixQuestionWorkspaceService } from '../../services/matrix-question-workspace.service';
import { AdminUnsavedChangesScope } from '../../services/admin-unsaved-changes.service';
import { MatrixStructurePickerComponent } from '../matrix-structure-picker/matrix-structure-picker.component';
import { MatrixQuestionFormComponent } from './matrix-question-form.component';
import {
  MatrixQuestionTranslationChange,
  MatrixQuestionTranslationField,
} from './matrix-question-translation.model';
import { MatrixQuestionTranslationWorkspaceComponent } from './matrix-question-translation-workspace.component';

const RESOURCE_ID = '00000000000000000000000000000003';
const SUBSECTION_ID = '00000000000000000000000000000013';

const resource: AdminMatrixResource = {
  id: RESOURCE_ID,
  name: 'Python docs',
  url: 'https://docs.python.org',
  translations: {
    ru: { name: 'Документация Python' },
    en: { name: 'Python docs' },
  },
};

const INVALID_SHORT_TEXT = 'x'.repeat(256);
const INVALID_MATRIX_TEXT = 'x'.repeat(20_001);
const VALID_RESOURCE_URL = 'https://example.com/docs';

interface MatrixQuestionControlValidationCase {
  description: string;
  selector: string;
  expectedMessage: string;
  setInvalidValue: () => void;
}

describe('MatrixQuestionFormComponent', () => {
  let fixture: ComponentFixture<MatrixQuestionFormComponent>;
  let service: jest.Mocked<MatrixQuestionWorkspaceService>;
  let emittedPayloads: AdminMatrixQuestionPayload[];
  let unsavedChangesScope: AdminUnsavedChangesScope;
  let confirmDiscard: jest.Mock<boolean, []>;

  beforeEach(async () => {
    service = {
      searchResources: jest.fn().mockReturnValue(of([resource])),
    } as unknown as jest.Mocked<MatrixQuestionWorkspaceService>;
    emittedPayloads = [];
    confirmDiscard = jest.fn(() => false);
    unsavedChangesScope = new AdminUnsavedChangesScope(confirmDiscard, () => undefined);

    await TestBed.configureTestingModule({
      imports: [MatrixQuestionFormComponent],
      providers: [
        provideI18nTesting(),
        { provide: MatrixQuestionWorkspaceService, useValue: service },
      ],
    })
      .overrideComponent(MatrixQuestionFormComponent, {
        remove: {
          imports: [
            MatrixStructurePickerComponent,
            MarkdownEditorComponent,
            MatrixQuestionTranslationWorkspaceComponent,
          ],
        },
        add: {
          imports: [
            MatrixStructurePickerStubComponent,
            MarkdownEditorStubComponent,
            MatrixQuestionTranslationWorkspaceStubComponent,
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(MatrixQuestionFormComponent);
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('question', null);
    fixture.componentRef.setInput('createInitialValue', null);
    fixture.componentRef.setInput('submitting', false);
    fixture.componentRef.setInput('submitLabelKey', 'adminMatrixQueue.createAndNext');
    fixture.componentRef.setInput('showCancelAction', true);
    fixture.componentRef.setInput('unsavedChangesScope', unsavedChangesScope);
    fixture.componentInstance.questionSave.subscribe((payload) => emittedPayloads.push(payload));
    fixture.detectChanges();
  });

  it('renders the required custom submit label in the shared action footer', () => {
    const footer = fixture.nativeElement.querySelector<HTMLElement>(
      '[data-testid="matrix-form-action-footer"]',
    );
    const submit = fixture.nativeElement.querySelector<HTMLButtonElement>(
      '[data-testid="matrix-form-save"]',
    );

    expect(footer).not.toBeNull();
    expect(submit?.textContent?.trim()).toBe('Создать и к следующему');
  });

  it('scopes the measured action-footer inset to the owning form and all localized editors', () => {
    clickDisplayMode('ru-en');
    const form = fixture.debugElement.query(By.css('form')).nativeElement as HTMLFormElement;
    const footer = fixture.debugElement.query(
      By.directive(MarkdownEditorStickyBottomInsetDirective),
    );
    const insetDirective = footer.injector.get(MarkdownEditorStickyBottomInsetDirective);
    const editors = fixture.debugElement.queryAll(By.directive(MarkdownEditorStubComponent));

    expect(insetDirective.appMarkdownEditorStickyBottomInset()).toBe(form);
    expect(editors).toHaveLength(4);
    expect(editors.every((editor) => form.contains(editor.nativeElement as HTMLElement))).toBe(
      true,
    );
    expect(
      fixture.nativeElement
        .querySelector<HTMLElement>('[data-testid="matrix-form-action-footer"]')
        ?.hasAttribute('style'),
    ).toBe(false);
  });

  it('shows or hides the cancel action explicitly', () => {
    expect(
      fixture.nativeElement.querySelector<HTMLButtonElement>('[data-testid="matrix-form-cancel"]'),
    ).not.toBeNull();

    fixture.componentRef.setInput('showCancelAction', false);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector<HTMLButtonElement>('[data-testid="matrix-form-cancel"]'),
    ).toBeNull();
  });

  it('tracks form, attached-resource, and unfinished new-resource changes against the baseline', () => {
    expect(unsavedChangesScope.hasChanges()).toBe(false);

    fixture.componentInstance.questionForm.controls.questionRu.setValue('Черновик');
    expect(unsavedChangesScope.hasChanges()).toBe(true);

    fixture.componentInstance.questionForm.controls.questionRu.setValue('');
    expect(unsavedChangesScope.hasChanges()).toBe(false);

    fixture.componentInstance.attachResource(resource);
    expect(unsavedChangesScope.hasChanges()).toBe(true);

    fixture.componentInstance.resourceDrafts.set([]);
    fixture.componentInstance.newResourceNameRu.set('Новый ресурс');
    expect(unsavedChangesScope.hasChanges()).toBe(true);
  });

  it('removes its draft source when a modal-owned form is destroyed', () => {
    fixture.componentInstance.questionForm.controls.questionRu.setValue('Черновик');
    expect(unsavedChangesScope.hasChanges()).toBe(true);

    fixture.destroy();

    expect(unsavedChangesScope.hasChanges()).toBe(false);
  });

  it('marks required fields and clears the red border after a required value is entered', () => {
    const slug = fixture.nativeElement.querySelector('#matrix-form-slug') as HTMLInputElement;

    expect(fixture.nativeElement.textContent).toContain('Slug *');
    submitForm();
    fixture.detectChanges();
    expect(slug.classList).toContain('is-invalid');

    slug.value = 'draft-question';
    slug.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(slug.classList).not.toContain('is-invalid');
  });

  it('describes interview-answer-explanation editors as interview answer explanations', () => {
    clickDisplayMode('ru-en');

    const russianLabel = fixture.nativeElement.querySelector(
      '#matrix-form-interview-answer-explanation-ru-label',
    ) as HTMLElement;
    const englishLabel = fixture.nativeElement.querySelector(
      '#matrix-form-interview-answer-explanation-en-label',
    ) as HTMLElement;
    const russianHint = fixture.nativeElement.querySelector(
      '#matrix-form-interview-answer-explanation-ru-hint',
    ) as HTMLElement;
    const russianEditor = fixture.nativeElement.querySelector(
      '#matrix-form-interview-answer-explanation-ru',
    ) as HTMLElement;

    expect(russianLabel.textContent?.trim()).toBe('Объяснение ответа на собеседовании RU');
    expect(englishLabel.textContent?.trim()).toBe('Объяснение ответа на собеседовании EN');
    expect(russianHint.textContent?.trim()).toBe(
      'Объясните, зачем задают вопрос, какой ответ ожидается и почему, а также какие ошибки часто допускают кандидаты.',
    );
    expect(russianEditor.getAttribute('aria-describedby')).toBe(
      'matrix-form-interview-answer-explanation-ru-hint',
    );
  });

  it('passes language and localized labels to every Markdown editor', () => {
    clickDisplayMode('ru-en');

    const editors = fixture.debugElement
      .queryAll(By.directive(MarkdownEditorStubComponent))
      .map((debugElement) => debugElement.componentInstance as MarkdownEditorStubComponent);

    expect(editors.map((editor) => editor.language)).toEqual(['ru', 'en', 'ru', 'en']);
    expect(editors.map((editor) => editor.accessibleLabel)).toEqual([
      'Ответ RU',
      'Ответ EN',
      'Объяснение ответа на собеседовании RU',
      'Объяснение ответа на собеседовании EN',
    ]);
  });

  it.each<MatrixQuestionControlValidationCase>([
    {
      description: 'slug pattern',
      selector: '#matrix-form-slug',
      expectedMessage: 'Используйте строчные латинские буквы, цифры и одинарные дефисы.',
      setInvalidValue: () => setInput('#matrix-form-slug', 'Invalid Slug'),
    },
    {
      description: 'question RU required text',
      selector: '#matrix-form-question-ru',
      expectedMessage: 'Заполните поле.',
      setInvalidValue: () => setInput('#matrix-form-question-ru', '   '),
    },
    {
      description: 'question EN max length',
      selector: '#matrix-form-question-en',
      expectedMessage: 'Максимум 255 символов.',
      setInvalidValue: () => setInput('#matrix-form-question-en', INVALID_SHORT_TEXT),
    },
    {
      description: 'answer RU max length',
      selector: '#matrix-form-answer-ru',
      expectedMessage: 'Максимум 20000 символов.',
      setInvalidValue: () => setMarkdownEditor('#matrix-form-answer-ru', INVALID_MATRIX_TEXT),
    },
    {
      description: 'answer EN max length',
      selector: '#matrix-form-answer-en',
      expectedMessage: 'Максимум 20000 символов.',
      setInvalidValue: () => setMarkdownEditor('#matrix-form-answer-en', INVALID_MATRIX_TEXT),
    },
    {
      description: 'answer explanation RU max length',
      selector: '#matrix-form-interview-answer-explanation-ru',
      expectedMessage: 'Максимум 20000 символов.',
      setInvalidValue: () =>
        setMarkdownEditor('#matrix-form-interview-answer-explanation-ru', INVALID_MATRIX_TEXT),
    },
    {
      description: 'answer explanation EN max length',
      selector: '#matrix-form-interview-answer-explanation-en',
      expectedMessage: 'Максимум 20000 символов.',
      setInvalidValue: () =>
        setMarkdownEditor('#matrix-form-interview-answer-explanation-en', INVALID_MATRIX_TEXT),
    },
  ])('shows invalid styling and localized feedback for $description', (validationCase) => {
    fillValidQuestionMinimum();
    validationCase.setInvalidValue();

    submitForm();

    expect(emittedPayloads).toEqual([]);
    expectInvalidControl(validationCase.selector, validationCase.expectedMessage);
  });

  it('shows invalid styling and localized feedback for the required subsection picker', () => {
    clickDisplayMode('ru-en');
    setInput('#matrix-form-slug', 'draft-question');
    setInput('#matrix-form-question-ru', 'Вопрос?');
    setInput('#matrix-form-question-en', 'Question?');

    submitForm();

    expect(emittedPayloads).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('Выберите подраздел.');
    expectInvalidControl('[data-testid="matrix-structure-subsection"]', 'Выберите подраздел.');
  });

  it('emits an incomplete draft payload with only minimum required fields', () => {
    clickDisplayMode('ru-en');
    setInput('#matrix-form-slug', 'draft-question');
    selectQuestionSubsection(SUBSECTION_ID);
    setInput('#matrix-form-question-ru', 'Неполный вопрос?');
    setInput('#matrix-form-question-en', 'Incomplete question?');

    submitForm();

    expect(emittedPayloads[0]).toEqual(
      expect.objectContaining({
        subsectionId: SUBSECTION_ID,
        grade: null,
        interviewFrequency: null,
        publishStatus: 'Draft',
        translations: expect.objectContaining({
          ru: expect.objectContaining({ answer: '' }),
        }),
        resources: [],
      }),
    );
  });

  it('updates the shared readiness panel live and keeps advisory warnings non-blocking', () => {
    expect(
      fixture.nativeElement.querySelector('[data-testid="matrix-readiness-panel"]')?.textContent,
    ).toContain('0 / 9');
    fillValidQuestionMinimum();
    setSelect('#matrix-form-grade', 'Middle');
    setMarkdownEditor('#matrix-form-answer-ru', 'Ответ');
    setMarkdownEditor('#matrix-form-answer-en', 'Answer');
    setMarkdownEditor('#matrix-form-interview-answer-explanation-ru', 'Объяснение');
    setMarkdownEditor('#matrix-form-interview-answer-explanation-en', 'Explanation');
    setSelect('#matrix-form-status', 'Published');

    expect(
      fixture.nativeElement.querySelector('[data-testid="matrix-readiness-panel"]')?.textContent,
    ).toContain('9 / 9');
    expect(fixture.componentInstance.readiness().warningCount).toBeGreaterThan(0);

    submitForm();

    expect(emittedPayloads[0].publishStatus).toBe('Published');
  });

  it('opens the exact localized edit field selected from readiness while preview is visible', () => {
    fillValidQuestionMinimum();
    clickViewMode('preview');

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-readiness-id="publicationBlocker:answerEn"]')
      ?.click();
    fixture.detectChanges();

    expect(previewSection().hidden).toBe(true);
    expect(element('#matrix-form-answer-en')).not.toBeNull();
    expect(element('#matrix-form-answer-ru')).toBeNull();
  });

  it('focuses a readiness target when the form is already in edit mode', async () => {
    const frequency = element('#matrix-form-interview-frequency');

    element('[data-readiness-id="warning:interviewFrequency"]')?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(frequency);
  });

  it('focuses the exact localized resource context selected from readiness', async () => {
    fixture.componentInstance.attachResource(resource);
    fixture.componentInstance.setLocalizedDisplayMode('en');
    fixture.detectChanges();

    element(`[data-readiness-id="warning:resource:${RESOURCE_ID}:context:ru"]`)?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const context = element('#matrixResourceContextRu0');
    expect(context).not.toBeNull();
    expect(document.activeElement).toBe(context);
  });

  it('focuses the shared Markdown editor selected from readiness', async () => {
    fillValidQuestionMinimum();

    element('[data-readiness-id="publicationBlocker:answerEn"]')?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const editor = fixture.debugElement.query(By.css('#matrix-form-answer-en app-markdown-editor'))
      .componentInstance as MarkdownEditorStubComponent;
    expect(editor.focus).toHaveBeenCalled();
  });

  it('shares identical review state with translation mode and resets it after content changes', () => {
    fillValidQuestionMinimum();
    setInput('#matrix-form-question-en', 'Вопрос?');
    const identicalSelector = '[data-readiness-id="identical:question:question"]';
    expect(element(identicalSelector)).not.toBeNull();

    element(identicalSelector)?.click();
    fixture.detectChanges();
    expect(translationSection().hidden).toBe(false);

    const translation = translationWorkspace();
    translation.identicalReviewed.emit(translation.fields[0]);
    fixture.detectChanges();
    expect(element(identicalSelector)).toBeNull();

    translation.translationChange.emit({
      scope: 'question',
      fieldId: 'question',
      value: 'Different question?',
    });
    fixture.detectChanges();
    translation.translationChange.emit({
      scope: 'question',
      fieldId: 'question',
      value: 'Вопрос?',
    });
    fixture.detectChanges();

    expect(element(identicalSelector)).not.toBeNull();
  });

  it('does not create a question when discarding an unfinished nested draft is rejected', () => {
    clickDisplayMode('ru-en');
    setInput('#matrix-form-slug', 'draft-question');
    selectQuestionSubsection(SUBSECTION_ID);
    setInput('#matrix-form-question-ru', 'Неполный вопрос?');
    setInput('#matrix-form-question-en', 'Incomplete question?');
    fixture.componentInstance.newResourceNameRu.set('Незавершённый ресурс');

    submitForm();

    expect(confirmDiscard).toHaveBeenCalled();
    expect(emittedPayloads).toEqual([]);
  });

  it('prefills create form from explicit initial value', () => {
    fixture.componentRef.setInput('createInitialValue', {
      slug: 'queued-question-0007',
      subsectionId: null,
      preferredSheetKey: 'python',
      grade: 'Junior',
      interviewFrequency: null,
      publishStatus: 'Draft',
      translations: {
        ru: {
          question: 'Что такое PEP 8?',
          answer: '',
          interviewAnswerExplanation: '',
        },
        en: {
          question: 'What is PEP 8?',
          answer: '',
          interviewAnswerExplanation: '',
        },
      },
    });
    fixture.detectChanges();

    expect(inputValue('#matrix-form-slug')).toBe('queued-question-0007');
    expect(inputValue('#matrix-form-question-ru')).toBe('Что такое PEP 8?');
    expect(fixture.componentInstance.questionForm.controls.questionEn.value).toBe('What is PEP 8?');
    expect(selectValue('#matrix-form-grade')).toBe('Junior');
    expect(
      fixture.debugElement.query(By.directive(MatrixStructurePickerStubComponent)).componentInstance
        .preferredSheetKey,
    ).toBe('python');
  });

  it('edits answer and interview-answer-explanation Markdown through shared editors', () => {
    fixture.componentRef.setInput('createInitialValue', {
      slug: 'queued-question-0007',
      subsectionId: SUBSECTION_ID,
      preferredSheetKey: 'python',
      grade: 'Junior',
      interviewFrequency: null,
      publishStatus: 'Draft',
      translations: {
        ru: {
          question: 'Что такое PEP 8?',
          answer: '## RU answer',
          interviewAnswerExplanation: 'RU explanation',
        },
        en: {
          question: 'What is PEP 8?',
          answer: '## EN answer',
          interviewAnswerExplanation: 'EN explanation',
        },
      },
    });
    fixture.detectChanges();
    clickDisplayMode('ru-en');

    const editors = fixture.debugElement.queryAll(By.directive(MarkdownEditorStubComponent));

    expect(editors).toHaveLength(4);
    expect(editors.map((editor) => editor.componentInstance.value)).toEqual([
      '## RU answer',
      '## EN answer',
      'RU explanation',
      'EN explanation',
    ]);

    editors[0].componentInstance.valueChange.emit('Updated RU answer');
    editors[1].componentInstance.valueChange.emit('Updated EN answer');
    editors[2].componentInstance.valueChange.emit('Updated RU explanation');
    editors[3].componentInstance.valueChange.emit('Updated EN explanation');
    fixture.detectChanges();

    submitForm();

    expect(emittedPayloads[0].translations).toEqual({
      ru: {
        question: 'Что такое PEP 8?',
        answer: 'Updated RU answer',
        interviewAnswerExplanation: 'Updated RU explanation',
      },
      en: {
        question: 'What is PEP 8?',
        answer: 'Updated EN answer',
        interviewAnswerExplanation: 'Updated EN explanation',
      },
    });
  });

  it('shows only RU localized fields by default when creating a question', () => {
    fixture.componentRef.setInput('createInitialValue', {
      slug: 'queued-question-0007',
      subsectionId: SUBSECTION_ID,
      preferredSheetKey: 'python',
      grade: 'Junior',
      interviewFrequency: null,
      publishStatus: 'Draft',
      translations: {
        ru: {
          question: 'Что такое PEP 8?',
          answer: '## RU answer',
          interviewAnswerExplanation: 'RU explanation',
        },
        en: {
          question: 'What is PEP 8?',
          answer: '## EN answer',
          interviewAnswerExplanation: 'EN explanation',
        },
      },
    });
    fixture.detectChanges();

    expect(inputValue('#matrix-form-question-ru')).toBe('Что такое PEP 8?');
    expect(element('#matrix-form-question-en')).toBeNull();
    expect(element('#matrix-form-answer-ru')).not.toBeNull();
    expect(element('#matrix-form-answer-en')).toBeNull();
    expect(element('#matrix-form-interview-answer-explanation-ru')).not.toBeNull();
    expect(element('#matrix-form-interview-answer-explanation-en')).toBeNull();
    expect(
      fixture.nativeElement
        .querySelector('[data-testid="matrix-form-display-mode-ru"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      fixture.debugElement
        .queryAll(By.directive(MarkdownEditorStubComponent))
        .map((editor) => editor.componentInstance.value),
    ).toEqual(['## RU answer', 'RU explanation']);
    expect(fixture.componentInstance.questionForm.controls.questionEn.value).toBe('What is PEP 8?');
  });

  it('shows only RU localized fields by default when editing an existing question', () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('question', questionDetail());
    fixture.detectChanges();

    expect(element('#matrix-form-question-ru')).not.toBeNull();
    expect(element('#matrix-form-question-en')).toBeNull();
    expect(element('#matrix-form-answer-ru')).not.toBeNull();
    expect(element('#matrix-form-answer-en')).toBeNull();
    expect(
      fixture.nativeElement
        .querySelector('[data-testid="matrix-form-display-mode-ru"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('switches between RU and EN localized field sets without losing values', () => {
    fixture.componentRef.setInput('createInitialValue', {
      slug: 'queued-question-0007',
      subsectionId: SUBSECTION_ID,
      preferredSheetKey: 'python',
      grade: 'Junior',
      interviewFrequency: null,
      publishStatus: 'Draft',
      translations: {
        ru: {
          question: 'Что такое PEP 8?',
          answer: '## RU answer',
          interviewAnswerExplanation: 'RU explanation',
        },
        en: {
          question: 'What is PEP 8?',
          answer: '## EN answer',
          interviewAnswerExplanation: 'EN explanation',
        },
      },
    });
    fixture.detectChanges();

    clickDisplayMode('ru');
    expect(inputValue('#matrix-form-question-ru')).toBe('Что такое PEP 8?');
    expect(element('#matrix-form-question-en')).toBeNull();
    expect(element('#matrix-form-answer-ru')).not.toBeNull();
    expect(element('#matrix-form-answer-en')).toBeNull();
    expect(element('#matrix-form-interview-answer-explanation-ru')).not.toBeNull();
    expect(element('#matrix-form-interview-answer-explanation-en')).toBeNull();
    setInput('#matrix-form-question-ru', 'Что такое PEP 8 на практике?');
    setMarkdownEditor('#matrix-form-answer-ru', 'Updated RU answer');
    setMarkdownEditor('#matrix-form-interview-answer-explanation-ru', 'Updated RU explanation');

    clickDisplayMode('en');
    expect(element('#matrix-form-question-ru')).toBeNull();
    expect(inputValue('#matrix-form-question-en')).toBe('What is PEP 8?');
    expect(element('#matrix-form-answer-ru')).toBeNull();
    expect(element('#matrix-form-answer-en')).not.toBeNull();
    expect(element('#matrix-form-interview-answer-explanation-ru')).toBeNull();
    expect(element('#matrix-form-interview-answer-explanation-en')).not.toBeNull();
    setInput('#matrix-form-question-en', 'What is PEP 8 in practice?');
    setMarkdownEditor('#matrix-form-answer-en', 'Updated EN answer');
    setMarkdownEditor('#matrix-form-interview-answer-explanation-en', 'Updated EN explanation');

    clickDisplayMode('ru-en');
    expect(inputValue('#matrix-form-question-ru')).toBe('Что такое PEP 8 на практике?');
    expect(inputValue('#matrix-form-question-en')).toBe('What is PEP 8 in practice?');

    submitForm();

    expect(emittedPayloads[0].translations).toEqual({
      ru: {
        question: 'Что такое PEP 8 на практике?',
        answer: 'Updated RU answer',
        interviewAnswerExplanation: 'Updated RU explanation',
      },
      en: {
        question: 'What is PEP 8 in practice?',
        answer: 'Updated EN answer',
        interviewAnswerExplanation: 'Updated EN explanation',
      },
    });
  });

  it('reveals the exact hidden localized field that blocks submission', () => {
    fillValidQuestionMinimum();
    setInput('#matrix-form-question-en', INVALID_SHORT_TEXT);
    clickDisplayMode('ru');

    submitForm();

    expect(emittedPayloads).toEqual([]);
    expect(element('#matrix-form-question-en')).not.toBeNull();
    expect(
      fixture.nativeElement
        .querySelector('[data-testid="matrix-form-display-mode-en"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
    expectInvalidControl('#matrix-form-question-en', 'Максимум 255 символов.');
  });

  it('opens the translation workspace and applies question and resource EN changes to the form', () => {
    fixture.componentRef.setInput('createInitialValue', {
      slug: 'queued-question-0007',
      subsectionId: SUBSECTION_ID,
      preferredSheetKey: 'python',
      grade: 'Junior',
      interviewFrequency: null,
      publishStatus: 'Draft',
      translations: {
        ru: {
          question: 'Что такое PEP 8?',
          answer: 'RU answer',
          interviewAnswerExplanation: 'RU explanation',
        },
        en: {
          question: 'Что такое PEP 8?',
          answer: '',
          interviewAnswerExplanation: '',
        },
      },
    });
    fixture.detectChanges();
    fixture.componentInstance.attachResource(resource);
    fixture.componentInstance.newResourceNameRu.set('Новый ресурс');
    fixture.componentInstance.newResourceNameEn.set('New resource');
    fixture.componentInstance.newResourceUrl.set(VALID_RESOURCE_URL);
    fixture.componentInstance.addNewResource();
    fixture.detectChanges();

    clickViewMode('translation');
    const workspace = translationWorkspace();
    expect(workspace.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scope: 'question',
          fieldId: 'question',
          source: 'Что такое PEP 8?',
          translation: 'Что такое PEP 8?',
        }),
        expect.objectContaining({
          scope: 'resource',
          resourceId: RESOURCE_ID,
          fieldId: 'name',
          editable: false,
        }),
        expect.objectContaining({
          scope: 'resource',
          resourceId: 'new--1',
          fieldId: 'name',
          editable: true,
        }),
      ]),
    );

    workspace.translationChange.emit({
      scope: 'question',
      fieldId: 'question',
      value: 'What is PEP 8?',
    });
    workspace.translationChange.emit({
      scope: 'question',
      fieldId: 'answer',
      value: 'EN answer',
    });
    workspace.translationChange.emit({
      scope: 'resource',
      resourceId: 'new--1',
      fieldId: 'name',
      value: 'New documentation resource',
    });
    workspace.translationChange.emit({
      scope: 'resource',
      resourceId: RESOURCE_ID,
      fieldId: 'context',
      value: 'Read the docs',
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.questionForm.controls.questionEn.value).toBe('What is PEP 8?');
    expect(fixture.componentInstance.questionForm.controls.answerEn.value).toBe('EN answer');
    expect(unsavedChangesScope.hasChanges()).toBe(true);
    expect(translationWorkspace().fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resourceId: 'new--1',
          fieldId: 'name',
          translation: 'New documentation resource',
        }),
        expect.objectContaining({
          resourceId: RESOURCE_ID,
          fieldId: 'context',
          translation: 'Read the docs',
        }),
      ]),
    );
  });

  it('opens the existing public preview in EN without changing the UI language', () => {
    const i18n = TestBed.inject(I18nService);
    const ensureLanguageBundle = jest
      .spyOn(i18n, 'ensureLanguageBundle')
      .mockReturnValue(of(void 0));
    clickViewMode('translation');

    translationWorkspace().previewEnglish.emit();
    fixture.detectChanges();

    expect(ensureLanguageBundle).toHaveBeenCalledWith('en');
    expect(i18n.language()).toBe('ru');
    expect(fixture.componentInstance.previewLanguage()).toBe('en');
    expect(previewSection().hidden).toBe(false);
  });

  it('keeps translation mode visible and reports a failed direct EN preview', () => {
    const i18n = TestBed.inject(I18nService);
    jest
      .spyOn(i18n, 'ensureLanguageBundle')
      .mockReturnValue(throwError(() => new Error('bundle unavailable')));
    clickViewMode('translation');

    translationWorkspace().previewEnglish.emit();
    fixture.detectChanges();

    expect(translationSection().hidden).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Не удалось загрузить язык предпросмотра.');
  });

  it('blocks invalid slug and long answer text before emitting', () => {
    clickDisplayMode('ru-en');
    setInput('#matrix-form-slug', 'Invalid Slug');
    selectQuestionSubsection(SUBSECTION_ID);
    setInput('#matrix-form-question-ru', 'Вопрос?');
    setInput('#matrix-form-question-en', 'Question?');

    submitForm();

    expect(emittedPayloads).toEqual([]);

    setInput('#matrix-form-slug', 'valid-question');
    setMarkdownEditor('#matrix-form-answer-en', 'x'.repeat(20_001));

    submitForm();

    expect(emittedPayloads).toEqual([]);
  });

  it('blocks an incomplete published payload before emitting', () => {
    clickDisplayMode('ru-en');
    setInput('#matrix-form-slug', 'draft-question');
    selectQuestionSubsection(SUBSECTION_ID);
    setInput('#matrix-form-question-ru', 'Неполный вопрос?');
    setInput('#matrix-form-question-en', 'Incomplete question?');
    fixture.componentInstance.newResourceNameRu.set('Незавершённый ресурс');
    setSelect('#matrix-form-status', 'Published');

    submitForm();

    expect(emittedPayloads).toEqual([]);
    expect(confirmDiscard).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Нельзя опубликовать вопрос');
  });

  it('generates slug only from the explicit button action', () => {
    const slug = fixture.nativeElement.querySelector('#matrix-form-slug') as HTMLInputElement;
    const generateButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find(
      (button): button is HTMLButtonElement =>
        (button as HTMLButtonElement).textContent?.includes('Сгенерировать') ?? false,
    );

    expect(generateButton?.disabled).toBe(true);
    clickDisplayMode('en');
    setInput('#matrix-form-question-en', 'What is dependency injection?');
    fixture.detectChanges();

    expect(slug.value).toBe('');
    expect(generateButton?.disabled).toBe(false);
    generateButton?.click();
    fixture.detectChanges();

    expect(slug.value).toBe('what-is-dependency-injection');
  });

  it('lays out metadata, question text, and multiline fields in readable rows', () => {
    clickDisplayMode('ru-en');
    fixture.componentInstance.attachResource(resource);
    fixture.detectChanges();

    expect(fieldColumn('#matrix-form-grade').classList).toContain('col-md-4');
    expect(fieldColumn('#matrix-form-interview-frequency').classList).toContain('col-md-4');
    expect(fieldColumn('#matrix-form-status').classList).toContain('col-md-4');
    expect(fieldColumn('#matrix-form-question-ru').classList).toContain('col-md-6');
    expect(fieldColumn('#matrix-form-question-en').classList).toContain('col-md-6');

    for (const selector of [
      '#matrix-form-answer-ru',
      '#matrix-form-answer-en',
      '#matrix-form-interview-answer-explanation-ru',
      '#matrix-form-interview-answer-explanation-en',
      '#matrixResourceContextRu0',
      '#matrixResourceContextEn0',
    ]) {
      const column = fieldColumn(selector);
      expect(column.classList).toContain('col-12');
      expect(column.classList).not.toContain('col-md-6');
    }
  });

  it('blocks invalid new resource URL and too-long resource context', () => {
    clickDisplayMode('ru-en');
    setInput('[data-testid="matrix-resource-new-name-ru"]', 'Документация');
    setInput('[data-testid="matrix-resource-new-name-en"]', 'Documentation');
    setInput('[data-testid="matrix-resource-new-url"]', 'ftp://example.com/docs');
    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-resource-add-new"]')
      ?.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('ftp://example.com/docs');

    fixture.nativeElement
      .querySelector<HTMLInputElement>('[data-testid="matrix-resource-search"]')!
      .dispatchEvent(new Event('input'));
    fixture.componentInstance.attachResource(resource);
    fixture.detectChanges();
    setTextarea('#matrixResourceContextEn0', 'x'.repeat(20_001));
    setInput('#matrix-form-slug', 'draft-question');
    selectQuestionSubsection(SUBSECTION_ID);
    setInput('#matrix-form-question-ru', 'Вопрос?');
    setInput('#matrix-form-question-en', 'Question?');

    submitForm();

    expect(emittedPayloads).toEqual([]);
  });

  it.each<MatrixQuestionControlValidationCase>([
    {
      description: 'new resource RU name',
      selector: '[data-testid="matrix-resource-new-name-ru"]',
      expectedMessage: 'Заполните поле.',
      setInvalidValue: () => {
        setInput('[data-testid="matrix-resource-new-name-en"]', 'Documentation');
        setInput('[data-testid="matrix-resource-new-url"]', VALID_RESOURCE_URL);
      },
    },
    {
      description: 'new resource EN name',
      selector: '[data-testid="matrix-resource-new-name-en"]',
      expectedMessage: 'Максимум 255 символов.',
      setInvalidValue: () => {
        setInput('[data-testid="matrix-resource-new-name-ru"]', 'Документация');
        setInput('[data-testid="matrix-resource-new-name-en"]', INVALID_SHORT_TEXT);
        setInput('[data-testid="matrix-resource-new-url"]', VALID_RESOURCE_URL);
      },
    },
    {
      description: 'new resource URL',
      selector: '[data-testid="matrix-resource-new-url"]',
      expectedMessage: 'Укажите ссылку с http или https.',
      setInvalidValue: () => {
        setInput('[data-testid="matrix-resource-new-name-ru"]', 'Документация');
        setInput('[data-testid="matrix-resource-new-name-en"]', 'Documentation');
        setInput('[data-testid="matrix-resource-new-url"]', 'ftp://example.com/docs');
      },
    },
  ])('shows invalid styling and localized feedback for $description', (validationCase) => {
    validationCase.setInvalidValue();

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-resource-add-new"]')
      ?.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain(VALID_RESOURCE_URL);
    expectInvalidControl(validationCase.selector, validationCase.expectedMessage);
  });

  it.each<MatrixQuestionControlValidationCase>([
    {
      description: 'resource RU context',
      selector: '#matrixResourceContextRu0',
      expectedMessage: 'Максимум 20000 символов.',
      setInvalidValue: () => setTextarea('#matrixResourceContextRu0', INVALID_MATRIX_TEXT),
    },
    {
      description: 'resource EN context',
      selector: '#matrixResourceContextEn0',
      expectedMessage: 'Максимум 20000 символов.',
      setInvalidValue: () => setTextarea('#matrixResourceContextEn0', INVALID_MATRIX_TEXT),
    },
  ])('shows invalid styling and localized feedback for $description', (validationCase) => {
    clickDisplayMode('ru-en');
    fixture.componentInstance.attachResource(resource);
    fixture.detectChanges();
    fillValidQuestionMinimum();
    validationCase.setInvalidValue();

    submitForm();

    expect(emittedPayloads).toEqual([]);
    expectInvalidControl(validationCase.selector, validationCase.expectedMessage);
  });

  it('adds, searches, edits context, and removes resources in the form payload', () => {
    clickDisplayMode('ru-en');
    setInput('[data-testid="matrix-resource-search"]', 'python');
    fixture.detectChanges();
    expect(service.searchResources).toHaveBeenCalledWith('python', 10, 'ru');

    fixture.nativeElement
      .querySelector<HTMLButtonElement>(`[data-testid="matrix-resource-attach-${RESOURCE_ID}"]`)
      ?.click();
    fixture.detectChanges();
    setTextarea('#matrixResourceContextRu0', 'Читать');
    setTextarea('#matrixResourceContextEn0', 'Read');

    setInput('#matrix-form-slug', 'draft-question');
    selectQuestionSubsection(SUBSECTION_ID);
    setInput('#matrix-form-question-ru', 'Вопрос?');
    setInput('#matrix-form-question-en', 'Question?');
    submitForm();

    expect(emittedPayloads[0].resources).toEqual([
      {
        resourceId: RESOURCE_ID,
        translations: { ru: { context: 'Читать' }, en: { context: 'Read' } },
      },
    ]);
  });

  it('previews unsaved localized Markdown and attached resources as public content', () => {
    clickDisplayMode('ru-en');
    setInput('#matrix-form-question-ru', 'Как работает typing?');
    setInput('#matrix-form-question-en', 'How does typing work?');
    setMarkdownEditor(
      '#matrix-form-answer-ru',
      'Изучите **типы** в [[articles:python-typing|статье]].',
    );
    setMarkdownEditor(
      '#matrix-form-answer-en',
      'Learn **types** in the [[articles:python-typing|article]].',
    );
    setMarkdownEditor('#matrix-form-interview-answer-explanation-ru', 'Покажите `Protocol`.');
    setMarkdownEditor('#matrix-form-interview-answer-explanation-en', 'Show `Protocol`.');
    setSelect('#matrix-form-interview-frequency', 'often');
    fixture.componentInstance.attachResource(resource);
    fixture.detectChanges();
    setTextarea('#matrixResourceContextRu0', 'Читать раздел typing');
    setTextarea('#matrixResourceContextEn0', 'Read the typing section');

    expect(previewSection().hidden).toBe(true);
    clickViewMode('preview');
    expect(previewSection().hidden).toBe(false);

    const ruPreview = fixture.nativeElement.querySelector<HTMLElement>(
      '[data-testid="matrix-question-public-preview"]',
    );
    const ruWikiLink = ruPreview?.querySelector<HTMLAnchorElement>(
      'a[href="/ru/articles/python-typing"]',
    );

    expect(ruPreview?.textContent).toContain('Как работает typing?');
    expect(ruPreview?.querySelector('strong')?.textContent).toBe('типы');
    expect(ruWikiLink?.textContent).toBe('статье');
    expect(ruPreview?.textContent).toContain('Документация Python');
    expect(ruPreview?.textContent).toContain('Читать раздел typing');

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-preview-language-en"]')
      ?.click();
    fixture.detectChanges();

    const enPreview = fixture.nativeElement.querySelector<HTMLElement>(
      '[data-testid="matrix-question-public-preview"]',
    );
    expect(enPreview?.textContent).toContain('How does typing work?');
    expect(enPreview?.querySelector('strong')?.textContent).toBe('types');
    expect(
      enPreview?.querySelector<HTMLAnchorElement>('a[href="/en/articles/python-typing"]')
        ?.textContent,
    ).toBe('article');
    expect(enPreview?.textContent).toContain('Python docs');
    expect(enPreview?.textContent).toContain('Read the typing section');

    clickViewMode('edit');
    expect(previewSection().hidden).toBe(true);
    expect(inputValue('#matrix-form-question-en')).toBe('How does typing work?');

    clickViewMode('preview');
    expect(previewSection().hidden).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('How does typing work?');
  });

  it('keeps the current preview language and shows feedback when another bundle fails', () => {
    const i18n = TestBed.inject(I18nService);
    jest
      .spyOn(i18n, 'ensureLanguageBundle')
      .mockReturnValue(throwError(() => new Error('bundle unavailable')));
    clickViewMode('preview');

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-preview-language-en"]')
      ?.click();
    fixture.detectChanges();

    const preview = fixture.nativeElement.querySelector<HTMLElement>(
      '[data-testid="matrix-question-public-preview"]',
    );
    expect(preview?.getAttribute('lang')).toBe('ru');
    expect(fixture.nativeElement.textContent).toContain('Не удалось загрузить язык предпросмотра.');
  });

  it('loads existing question values into the edit form', () => {
    fixture.componentRef.setInput('mode', 'edit');
    fixture.componentRef.setInput('question', questionDetail());
    fixture.detectChanges();

    expect(inputValue('#matrix-form-slug')).toBe('existing-question');
    expect(inputValue('#matrix-form-question-ru')).toBe('Существующий вопрос?');
    expect(fixture.componentInstance.questionForm.controls.questionEn.value).toBe(
      'Existing question?',
    );
  });

  function submitForm(): void {
    fixture.debugElement.query(By.css('form')).nativeElement.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  function setInput(selector: string, value: string): void {
    const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function setTextarea(selector: string, value: string): void {
    const textarea = fixture.nativeElement.querySelector(selector) as HTMLTextAreaElement;
    textarea.value = value;
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function setMarkdownEditor(selector: string, value: string): void {
    const editor = fixture.debugElement
      .query(By.css(selector))
      ?.query(By.directive(MarkdownEditorStubComponent))?.componentInstance as
      MarkdownEditorStubComponent | undefined;
    if (editor === undefined) {
      throw new Error(`No Markdown editor found for ${selector}`);
    }
    editor.valueChange.emit(value);
    fixture.detectChanges();
  }

  function setSelect(selector: string, value: string): void {
    chooseSiteSelectOption(fixture, selector, value);
  }

  function selectQuestionSubsection(subsectionId: string): void {
    const picker = fixture.debugElement.query(By.directive(MatrixStructurePickerStubComponent))
      .componentInstance as MatrixStructurePickerStubComponent;
    picker.selectedSubsectionIdChange.emit(subsectionId);
    fixture.detectChanges();
  }

  function fillValidQuestionMinimum(): void {
    clickDisplayMode('ru-en');
    setInput('#matrix-form-slug', 'draft-question');
    selectQuestionSubsection(SUBSECTION_ID);
    setInput('#matrix-form-question-ru', 'Вопрос?');
    setInput('#matrix-form-question-en', 'Question?');
  }

  function clickDisplayMode(mode: 'ru' | 'en' | 'ru-en'): void {
    const button = fixture.nativeElement.querySelector(
      `[data-testid="matrix-form-display-mode-${mode}"]`,
    ) as HTMLButtonElement | null;
    if (button === null) {
      throw new Error(`No display mode button found for ${mode}`);
    }
    button.click();
    fixture.detectChanges();
  }

  function clickViewMode(mode: 'edit' | 'translation' | 'preview'): void {
    const button = fixture.nativeElement.querySelector(
      `[data-testid="matrix-form-view-${mode}"]`,
    ) as HTMLButtonElement | null;
    if (button === null) {
      throw new Error(`No form view mode button found for ${mode}`);
    }
    button.click();
    fixture.detectChanges();
  }

  function translationWorkspace(): MatrixQuestionTranslationWorkspaceStubComponent {
    return fixture.debugElement.query(By.directive(MatrixQuestionTranslationWorkspaceStubComponent))
      .componentInstance as MatrixQuestionTranslationWorkspaceStubComponent;
  }

  function translationSection(): HTMLElement {
    const section = element('[data-testid="matrix-translation-workspace-stub"]')?.closest(
      'section',
    );
    if (!(section instanceof HTMLElement)) {
      throw new Error('No matrix question translation section found');
    }
    return section;
  }

  function previewSection(): HTMLElement {
    const section = element('[data-testid="matrix-question-public-preview"]')?.closest('section');
    if (!(section instanceof HTMLElement)) {
      throw new Error('No matrix question preview section found');
    }
    return section;
  }

  function expectInvalidControl(selector: string, expectedMessage: string): void {
    const element = fixture.nativeElement.querySelector(selector) as HTMLElement | null;
    expect(element).not.toBeNull();
    expect(element?.classList).toContain('is-invalid');
    expect(element?.getAttribute('aria-invalid')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain(expectedMessage);
  }

  function inputValue(selector: string): string {
    const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
    return input.value;
  }

  function element(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector) as HTMLElement | null;
  }

  function selectValue(selector: string): string {
    return siteSelectValue(fixture, selector);
  }

  function fieldColumn(selector: string): HTMLElement {
    const field = fixture.nativeElement.querySelector(selector) as HTMLElement | null;
    const column = field?.closest('.row > div, .row > section');
    if (!(column instanceof HTMLElement)) {
      throw new Error(`No grid column found for ${selector}`);
    }
    return column;
  }
});

@Component({
  selector: 'app-matrix-structure-picker',
  standalone: true,
  template:
    '<select data-testid="matrix-structure-subsection" [class.is-invalid]="invalid" [attr.aria-invalid]="invalid ? \'true\' : null"></select>',
})
class MatrixStructurePickerStubComponent {
  @Input({ required: true }) unsavedChangesScope!: AdminUnsavedChangesScope;
  @Input({ required: true }) language!: 'ru' | 'en';
  @Input({ required: true }) selectedSubsectionId!: string | null;
  @Input({ required: true }) preferredSheetKey!: string | null;
  @Input() disabled = false;
  @Input() invalid = false;
  @Output() readonly selectedSubsectionIdChange = new EventEmitter<string | null>();

  readonly focusSubsection = jest.fn();
}

@Component({
  selector: 'app-markdown-editor',
  standalone: true,
  template: '',
})
class MarkdownEditorStubComponent {
  @Input({ required: true }) value!: string;
  @Input({ required: true }) language!: 'ru' | 'en';
  @Input({ required: true }) accessibleLabel!: string;
  @Input({ required: true }) imageUploadsEnabled!: boolean;
  @Output() readonly valueChange = new EventEmitter<string>();

  readonly focus = jest.fn();
}

@Component({
  selector: 'app-matrix-question-translation-workspace',
  standalone: true,
  template: '<div data-testid="matrix-translation-workspace-stub"></div>',
})
class MatrixQuestionTranslationWorkspaceStubComponent {
  @Input({ required: true }) fields!: readonly MatrixQuestionTranslationField[];
  @Input({ required: true }) resetKey!: string;
  @Input({ required: true }) disabled!: boolean;
  @Input({ required: true }) reviewedTranslationSignatures!: ReadonlyMap<string, string>;
  @Output() readonly translationChange = new EventEmitter<MatrixQuestionTranslationChange>();
  @Output() readonly identicalReviewed = new EventEmitter<MatrixQuestionTranslationField>();
  @Output() readonly previewEnglish = new EventEmitter<void>();

  readonly focusTranslationField = jest.fn<void, [string]>();
}

function questionDetail(): AdminMatrixQuestionDetailDto {
  return {
    id: '7',
    slug: 'existing-question',
    question: 'Existing question?',
    answer: '',
    interviewAnswerExplanation: '',
    subsectionId: SUBSECTION_ID,
    sheetKey: 'python',
    sheet: 'Python',
    grade: null,
    interviewFrequency: null,
    section: 'Core',
    subsection: 'Syntax',
    publishStatus: 'Draft',
    suggestedByUsername: 'owner',
    translations: {
      ru: { question: 'Существующий вопрос?', answer: '', interviewAnswerExplanation: '' },
      en: { question: 'Existing question?', answer: '', interviewAnswerExplanation: '' },
    },
    resources: [],
  };
}
