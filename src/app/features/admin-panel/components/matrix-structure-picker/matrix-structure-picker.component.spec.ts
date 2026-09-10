import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { chooseSiteSelectOption } from '../../../../testing/site-select-testing';
import { AdminMatrixStructure } from '../../models/matrix-question-workspace.model';
import { MatrixQuestionWorkspaceService } from '../../services/matrix-question-workspace.service';
import { AdminUnsavedChangesScope } from '../../services/admin-unsaved-changes.service';
import { MatrixStructurePickerComponent } from './matrix-structure-picker.component';

const SHEET_ID = '00000000000000000000000000000001';
const SECTION_ID = '00000000000000000000000000000002';
const SUBSECTION_ID = '00000000000000000000000000000003';
const SQL_SHEET_ID = '00000000000000000000000000000004';
const NEW_SUBSECTION_ID = '00000000000000000000000000000005';
const NEW_SECTION_ID = '00000000000000000000000000000006';

const initialStructure: AdminMatrixStructure = {
  sheets: [
    {
      id: SHEET_ID,
      key: 'python',
      name: 'Питон',
      priority: 1,
      translations: { ru: { name: 'Питон' }, en: { name: 'Python' } },
      sections: [
        {
          id: SECTION_ID,
          name: 'Основы',
          priority: 1,
          translations: { ru: { name: 'Основы' }, en: { name: 'Core' } },
          subsections: [
            {
              id: SUBSECTION_ID,
              name: 'Стиль',
              priority: 1,
              translations: { ru: { name: 'Стиль' }, en: { name: 'Style' } },
            },
          ],
        },
      ],
    },
  ],
};

const INVALID_SHORT_TEXT = 'x'.repeat(256);

interface MatrixStructureValidationCase {
  description: string;
  selector: string;
  addButtonSelector: string;
  expectedMessage: string;
  prepare: () => void;
}

describe('MatrixStructurePickerComponent', () => {
  let fixture: ComponentFixture<MatrixStructurePickerComponent>;
  let service: jest.Mocked<MatrixQuestionWorkspaceService>;
  let unsavedChangesScope: AdminUnsavedChangesScope;

  beforeEach(async () => {
    service = {
      getStructure: jest.fn().mockReturnValue(of(initialStructure)),
      createSheet: jest.fn(),
      createSection: jest.fn(),
      createSubsection: jest.fn(),
    } as unknown as jest.Mocked<MatrixQuestionWorkspaceService>;
    unsavedChangesScope = new AdminUnsavedChangesScope(
      () => false,
      () => undefined,
    );

    await TestBed.configureTestingModule({
      imports: [MatrixStructurePickerComponent],
      providers: [
        provideI18nTesting(),
        { provide: MatrixQuestionWorkspaceService, useValue: service },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MatrixStructurePickerComponent);
    fixture.componentRef.setInput('language', 'ru');
    fixture.componentRef.setInput('selectedSubsectionId', null);
    fixture.componentRef.setInput('preferredSheetKey', null);
    fixture.componentRef.setInput('unsavedChangesScope', unsavedChangesScope);
    fixture.detectChanges();
  });

  it('loads localized structure and enables dependent selects step by step', () => {
    const sheet = select('[data-testid="matrix-structure-sheet"]');
    const section = select('[data-testid="matrix-structure-section"]');
    const subsection = select('[data-testid="matrix-structure-subsection"]');

    expect(service.getStructure).toHaveBeenCalledWith('ru');
    expect(fixture.nativeElement.textContent).toContain('Питон');
    expect(section.disabled).toBe(true);
    expect(subsection.disabled).toBe(true);

    choose(sheet, SHEET_ID);
    fixture.detectChanges();

    expect(section.disabled).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Основы');

    choose(section, SECTION_ID);
    fixture.detectChanges();

    expect(subsection.disabled).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Стиль');
  });

  it('keeps unfinished inline-create drafts across a language reload', () => {
    fixture.componentInstance.sheetForm.setValue({
      key: 'draft-sheet',
      nameRu: 'Черновик',
      nameEn: 'Draft',
    });

    fixture.componentRef.setInput('language', 'en');
    fixture.detectChanges();

    expect(fixture.componentInstance.sheetForm.getRawValue()).toEqual({
      key: 'draft-sheet',
      nameRu: 'Черновик',
      nameEn: 'Draft',
    });
    expect(unsavedChangesScope.hasChanges()).toBe(true);
  });

  it('emits selected subsection id', () => {
    const emit = jest.spyOn(fixture.componentInstance.selectedSubsectionIdChange, 'emit');

    choose(select('[data-testid="matrix-structure-sheet"]'), SHEET_ID);
    fixture.detectChanges();
    choose(select('[data-testid="matrix-structure-section"]'), SECTION_ID);
    fixture.detectChanges();
    choose(select('[data-testid="matrix-structure-subsection"]'), SUBSECTION_ID);

    expect(emit).toHaveBeenLastCalledWith(SUBSECTION_ID);
  });

  it('focuses the first actionable structure prerequisite when subsection is disabled', () => {
    const sheet = select('[data-testid="matrix-structure-sheet"]');
    const scrollIntoView = jest.fn();
    const focus = jest.spyOn(sheet, 'focus');
    sheet.scrollIntoView = scrollIntoView;

    fixture.componentInstance.focusSubsection();

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('focuses the subsection select when its prerequisites are selected', () => {
    choose(select('[data-testid="matrix-structure-sheet"]'), SHEET_ID);
    fixture.detectChanges();
    choose(select('[data-testid="matrix-structure-section"]'), SECTION_ID);
    fixture.detectChanges();
    const subsection = select('[data-testid="matrix-structure-subsection"]');
    const scrollIntoView = jest.fn();
    const focus = jest.spyOn(subsection, 'focus');
    subsection.scrollIntoView = scrollIntoView;

    fixture.componentInstance.focusSubsection();

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('selects the preferred sheet by key when no subsection is selected', () => {
    fixture.componentRef.setInput('preferredSheetKey', 'PYTHON');
    fixture.detectChanges();

    expect(select('[data-testid="matrix-structure-sheet"]').value).toBe(SHEET_ID);
    expect(select('[data-testid="matrix-structure-section"]').disabled).toBe(false);
    expect(select('[data-testid="matrix-structure-subsection"]').disabled).toBe(true);
    expect(fixture.nativeElement.textContent).not.toContain('Создайте лист');
  });

  it('highlights a missing preferred sheet key and pre-fills sheet creation', () => {
    fixture.componentRef.setInput('preferredSheetKey', 'SQL');
    fixture.detectChanges();

    expect(select('[data-testid="matrix-structure-sheet"]').value).toBe('');
    expect(fixture.nativeElement.textContent).toContain(
      'Лист с ключом sql не найден. Создайте лист и заполните названия RU/EN.',
    );
    expect(inputValue('[data-testid="matrix-structure-sheet-key"]')).toBe('sql');
    expect(inputValue('[data-testid="matrix-structure-sheet-ru"]')).toBe('');
    expect(inputValue('[data-testid="matrix-structure-sheet-en"]')).toBe('');
  });

  it('reloads structure and selects newly created sheet', () => {
    const updatedStructure: AdminMatrixStructure = {
      sheets: [
        ...initialStructure.sheets,
        {
          id: SQL_SHEET_ID,
          key: 'sql',
          name: 'SQL',
          priority: 2,
          translations: { ru: { name: 'SQL' }, en: { name: 'SQL' } },
          sections: [],
        },
      ],
    };
    service.getStructure
      .mockReturnValueOnce(of(initialStructure))
      .mockReturnValueOnce(of(updatedStructure));
    service.createSheet.mockReturnValue(
      of({
        id: SQL_SHEET_ID,
        key: 'sql',
        name: 'SQL',
        priority: 2,
        translations: { ru: { name: 'SQL' }, en: { name: 'SQL' } },
        sections: [],
      }),
    );
    fixture = TestBed.createComponent(MatrixStructurePickerComponent);
    fixture.componentRef.setInput('language', 'ru');
    fixture.componentRef.setInput('selectedSubsectionId', null);
    fixture.componentRef.setInput('preferredSheetKey', null);
    fixture.componentRef.setInput('unsavedChangesScope', unsavedChangesScope);
    fixture.detectChanges();

    setInput('[data-testid="matrix-structure-sheet-key"]', 'sql');
    setInput('[data-testid="matrix-structure-sheet-ru"]', 'SQL');
    setInput('[data-testid="matrix-structure-sheet-en"]', 'SQL');
    fixture.detectChanges();
    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-structure-add-sheet"]')
      ?.click();
    fixture.detectChanges();

    expect(service.createSheet).toHaveBeenCalledWith(
      {
        key: 'sql',
        translations: { ru: { name: 'SQL' }, en: { name: 'SQL' } },
      },
      'ru',
    );
    expect(select('[data-testid="matrix-structure-sheet"]').value).toBe(SQL_SHEET_ID);
  });

  it('reloads structure and selects newly created section', () => {
    const updatedStructure: AdminMatrixStructure = {
      sheets: [
        {
          ...initialStructure.sheets[0],
          sections: [
            ...initialStructure.sheets[0].sections,
            {
              id: NEW_SECTION_ID,
              name: 'Асинхронность',
              priority: 2,
              translations: { ru: { name: 'Асинхронность' }, en: { name: 'Async' } },
              subsections: [],
            },
          ],
        },
      ],
    };
    service.getStructure
      .mockReturnValueOnce(of(initialStructure))
      .mockReturnValueOnce(of(updatedStructure));
    service.createSection.mockReturnValue(
      of({
        id: NEW_SECTION_ID,
        name: 'Асинхронность',
        priority: 2,
        translations: { ru: { name: 'Асинхронность' }, en: { name: 'Async' } },
        subsections: [],
      }),
    );
    fixture = TestBed.createComponent(MatrixStructurePickerComponent);
    fixture.componentRef.setInput('language', 'ru');
    fixture.componentRef.setInput('selectedSubsectionId', null);
    fixture.componentRef.setInput('preferredSheetKey', null);
    fixture.componentRef.setInput('unsavedChangesScope', unsavedChangesScope);
    fixture.detectChanges();
    choose(select('[data-testid="matrix-structure-sheet"]'), SHEET_ID);
    fixture.detectChanges();
    setInput('[data-testid="matrix-structure-section-ru"]', 'Асинхронность');
    setInput('[data-testid="matrix-structure-section-en"]', 'Async');
    fixture.detectChanges();

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-structure-add-section"]')
      ?.click();
    fixture.detectChanges();

    expect(service.createSection).toHaveBeenCalledWith(
      SHEET_ID,
      {
        translations: { ru: { name: 'Асинхронность' }, en: { name: 'Async' } },
      },
      'ru',
    );
    expect(select('[data-testid="matrix-structure-section"]').value).toBe(NEW_SECTION_ID);
  });

  it('blocks invalid sheet key and whitespace-only structure names', () => {
    setInput('[data-testid="matrix-structure-sheet-key"]', 'Python Core');
    setInput('[data-testid="matrix-structure-sheet-ru"]', 'Питон');
    setInput('[data-testid="matrix-structure-sheet-en"]', 'Python');
    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-structure-add-sheet"]')
      ?.click();

    expect(service.createSheet).not.toHaveBeenCalled();

    setInput('[data-testid="matrix-structure-sheet-key"]', 'python-core');
    setInput('[data-testid="matrix-structure-sheet-ru"]', '   ');
    setInput('[data-testid="matrix-structure-sheet-en"]', 'Python');
    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-structure-add-sheet"]')
      ?.click();

    expect(service.createSheet).not.toHaveBeenCalled();
  });

  it.each<MatrixStructureValidationCase>([
    {
      description: 'sheet key pattern',
      selector: '[data-testid="matrix-structure-sheet-key"]',
      addButtonSelector: '[data-testid="matrix-structure-add-sheet"]',
      expectedMessage: 'Используйте строчные латинские буквы, цифры и одинарные дефисы.',
      prepare: () => {
        setInput('[data-testid="matrix-structure-sheet-key"]', 'Python Core');
        setInput('[data-testid="matrix-structure-sheet-ru"]', 'Питон');
        setInput('[data-testid="matrix-structure-sheet-en"]', 'Python');
      },
    },
    {
      description: 'sheet RU name required',
      selector: '[data-testid="matrix-structure-sheet-ru"]',
      addButtonSelector: '[data-testid="matrix-structure-add-sheet"]',
      expectedMessage: 'Заполните поле.',
      prepare: () => {
        setInput('[data-testid="matrix-structure-sheet-key"]', 'python-core');
        setInput('[data-testid="matrix-structure-sheet-ru"]', '   ');
        setInput('[data-testid="matrix-structure-sheet-en"]', 'Python');
      },
    },
    {
      description: 'sheet EN name max length',
      selector: '[data-testid="matrix-structure-sheet-en"]',
      addButtonSelector: '[data-testid="matrix-structure-add-sheet"]',
      expectedMessage: 'Максимум 255 символов.',
      prepare: () => {
        setInput('[data-testid="matrix-structure-sheet-key"]', 'python-core');
        setInput('[data-testid="matrix-structure-sheet-ru"]', 'Питон');
        setInput('[data-testid="matrix-structure-sheet-en"]', INVALID_SHORT_TEXT);
      },
    },
    {
      description: 'section RU name required',
      selector: '[data-testid="matrix-structure-section-ru"]',
      addButtonSelector: '[data-testid="matrix-structure-add-section"]',
      expectedMessage: 'Заполните поле.',
      prepare: () => {
        choose(select('[data-testid="matrix-structure-sheet"]'), SHEET_ID);
        fixture.detectChanges();
        setInput('[data-testid="matrix-structure-section-ru"]', '   ');
        setInput('[data-testid="matrix-structure-section-en"]', 'Core');
      },
    },
    {
      description: 'section EN name max length',
      selector: '[data-testid="matrix-structure-section-en"]',
      addButtonSelector: '[data-testid="matrix-structure-add-section"]',
      expectedMessage: 'Максимум 255 символов.',
      prepare: () => {
        choose(select('[data-testid="matrix-structure-sheet"]'), SHEET_ID);
        fixture.detectChanges();
        setInput('[data-testid="matrix-structure-section-ru"]', 'Основы');
        setInput('[data-testid="matrix-structure-section-en"]', INVALID_SHORT_TEXT);
      },
    },
    {
      description: 'subsection RU name required',
      selector: '[data-testid="matrix-structure-subsection-ru"]',
      addButtonSelector: '[data-testid="matrix-structure-add-subsection"]',
      expectedMessage: 'Заполните поле.',
      prepare: () => {
        selectExistingSection();
        setInput('[data-testid="matrix-structure-subsection-ru"]', '   ');
        setInput('[data-testid="matrix-structure-subsection-en"]', 'Typing');
      },
    },
    {
      description: 'subsection EN name max length',
      selector: '[data-testid="matrix-structure-subsection-en"]',
      addButtonSelector: '[data-testid="matrix-structure-add-subsection"]',
      expectedMessage: 'Максимум 255 символов.',
      prepare: () => {
        selectExistingSection();
        setInput('[data-testid="matrix-structure-subsection-ru"]', 'Типизация');
        setInput('[data-testid="matrix-structure-subsection-en"]', INVALID_SHORT_TEXT);
      },
    },
  ])('shows invalid styling and localized feedback for $description', (validationCase) => {
    validationCase.prepare();
    const addButton = fixture.nativeElement.querySelector<HTMLButtonElement>(
      validationCase.addButtonSelector,
    );

    expect(addButton?.disabled).toBe(false);
    addButton?.click();
    fixture.detectChanges();

    expect(service.createSheet).not.toHaveBeenCalled();
    expect(service.createSection).not.toHaveBeenCalled();
    expect(service.createSubsection).not.toHaveBeenCalled();
    expectInvalidControl(validationCase.selector, validationCase.expectedMessage);
  });

  it('reloads structure and emits newly created subsection', () => {
    const updatedStructure: AdminMatrixStructure = {
      sheets: [
        {
          ...initialStructure.sheets[0],
          sections: [
            {
              ...initialStructure.sheets[0].sections[0],
              subsections: [
                ...initialStructure.sheets[0].sections[0].subsections,
                {
                  id: NEW_SUBSECTION_ID,
                  name: 'Типизация',
                  priority: 2,
                  translations: { ru: { name: 'Типизация' }, en: { name: 'Typing' } },
                },
              ],
            },
          ],
        },
      ],
    };
    service.getStructure
      .mockReturnValueOnce(of(initialStructure))
      .mockReturnValueOnce(of(updatedStructure));
    service.createSubsection.mockReturnValue(
      of({
        id: NEW_SUBSECTION_ID,
        name: 'Типизация',
        priority: 2,
        translations: { ru: { name: 'Типизация' }, en: { name: 'Typing' } },
      }),
    );
    fixture = TestBed.createComponent(MatrixStructurePickerComponent);
    fixture.componentRef.setInput('language', 'ru');
    fixture.componentRef.setInput('selectedSubsectionId', null);
    fixture.componentRef.setInput('preferredSheetKey', null);
    fixture.componentRef.setInput('unsavedChangesScope', unsavedChangesScope);
    fixture.detectChanges();
    const emit = jest.spyOn(fixture.componentInstance.selectedSubsectionIdChange, 'emit');
    choose(select('[data-testid="matrix-structure-sheet"]'), SHEET_ID);
    fixture.detectChanges();
    choose(select('[data-testid="matrix-structure-section"]'), SECTION_ID);
    fixture.detectChanges();
    setInput('[data-testid="matrix-structure-subsection-ru"]', 'Типизация');
    setInput('[data-testid="matrix-structure-subsection-en"]', 'Typing');
    fixture.detectChanges();

    fixture.nativeElement
      .querySelector<HTMLButtonElement>('[data-testid="matrix-structure-add-subsection"]')
      ?.click();
    fixture.detectChanges();

    expect(service.createSubsection).toHaveBeenCalledWith(
      SECTION_ID,
      {
        translations: { ru: { name: 'Типизация' }, en: { name: 'Typing' } },
      },
      'ru',
    );
    expect(emit).toHaveBeenLastCalledWith(NEW_SUBSECTION_ID);
    expect(fixture.nativeElement.textContent).toContain('Типизация');
  });

  function select(selector: string): HTMLButtonElement {
    return fixture.nativeElement.querySelector(selector) as HTMLButtonElement;
  }

  function choose(element: HTMLButtonElement, value: string): void {
    chooseSiteSelectOption(fixture, `#${element.id}`, value);
  }

  function setInput(selector: string, value: string): void {
    const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function inputValue(selector: string): string {
    const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement | null;
    if (input === null) {
      throw new Error(`Missing matrix structure input: ${selector}`);
    }
    return input.value;
  }

  function selectExistingSection(): void {
    choose(select('[data-testid="matrix-structure-sheet"]'), SHEET_ID);
    fixture.detectChanges();
    choose(select('[data-testid="matrix-structure-section"]'), SECTION_ID);
    fixture.detectChanges();
  }

  function expectInvalidControl(selector: string, expectedMessage: string): void {
    const element = fixture.nativeElement.querySelector(selector) as HTMLElement | null;
    expect(element).not.toBeNull();
    expect(element?.classList).toContain('is-invalid');
    expect(element?.getAttribute('aria-invalid')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain(expectedMessage);
  }
});
