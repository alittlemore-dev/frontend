import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { AdminMatrixStructure } from '../../models/matrix-question-workspace.model';
import { MatrixQuestionWorkspaceService } from '../../services/matrix-question-workspace.service';
import { MatrixStructurePageComponent } from './matrix-structure-page.component';

const PYTHON_SHEET_ID = '00000000000000000000000000000001';
const SQL_SHEET_ID = '00000000000000000000000000000002';
const BASICS_SECTION_ID = '00000000000000000000000000000003';
const ADVANCED_SECTION_ID = '00000000000000000000000000000004';
const STYLE_SUBSECTION_ID = '00000000000000000000000000000005';
const TYPING_SUBSECTION_ID = '00000000000000000000000000000006';
const GO_SHEET_ID = '00000000000000000000000000000007';
const TESTING_SECTION_ID = '00000000000000000000000000000008';
const UNIT_SUBSECTION_ID = '00000000000000000000000000000009';

describe('MatrixStructurePageComponent', () => {
  let fixture: ComponentFixture<MatrixStructurePageComponent>;
  let service: jest.Mocked<MatrixQuestionWorkspaceService>;
  let notifications: { success: jest.Mock; error: jest.Mock };
  let routeQueryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let router: Router;

  beforeEach(async () => {
    service = {
      getStructure: jest.fn().mockReturnValue(of(matrixStructure())),
      createSheet: jest.fn(),
      createSection: jest.fn(),
      createSubsection: jest.fn(),
      updateSheetPriorities: jest.fn().mockReturnValue(of(undefined)),
      updateSectionPriorities: jest.fn().mockReturnValue(of(undefined)),
      updateSubsectionPriorities: jest.fn().mockReturnValue(of(undefined)),
    } as unknown as jest.Mocked<MatrixQuestionWorkspaceService>;
    notifications = {
      success: jest.fn(),
      error: jest.fn(),
    };
    routeQueryParams = new BehaviorSubject(convertToParamMap({}));

    await TestBed.configureTestingModule({
      imports: [MatrixStructurePageComponent],
      providers: [
        provideRouter([]),
        provideI18nTesting(),
        { provide: MatrixQuestionWorkspaceService, useValue: service },
        { provide: NotificationService, useValue: notifications },
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: routeQueryParams.asObservable() },
        },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  it('renders loading and then the loaded structure', () => {
    const structure = new Subject<AdminMatrixStructure>();
    service.getStructure.mockReturnValue(structure.asObservable());

    createComponent();

    const loadingSpinner = fixture.nativeElement.querySelector('app-loading-spinner');
    expect(loadingSpinner).toBeTruthy();

    structure.next(matrixStructure());
    structure.complete();
    fixture.detectChanges();

    expect(service.getStructure).toHaveBeenCalledWith('ru');
    expect(fixture.nativeElement.textContent).toContain('Питон');
    expect(fixture.nativeElement.textContent).toContain('Основы');
    expect(fixture.nativeElement.textContent).toContain('Стиль');
  });

  it('restores the selected sheet by stable key and writes sheet changes to the URL', () => {
    routeQueryParams.next(convertToParamMap({ sheet: 'sql' }));
    createComponent();

    expect(fixture.componentInstance.selectedSheetId()).toBe(SQL_SHEET_ID);
    jest.mocked(router.navigate).mockClear();

    fixture.componentInstance.selectSheet(PYTHON_SHEET_ID);

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: { sheet: 'python' },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      }),
    );
  });

  it('uses the visible blocks as drag targets without priority action buttons', () => {
    createComponent();

    expect(
      fixture.nativeElement.querySelector('.matrix-structure-sheet-item.cdk-drag'),
    ).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.matrix-structure-section.cdk-drag')).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('.matrix-structure-subsection.cdk-drag'),
    ).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.matrix-structure-icon-button')).toBeNull();
    expect(fixture.nativeElement.querySelector('[title="Перетащить"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[title="Переместить выше"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[title="Переместить ниже"]')).toBeNull();
  });

  it('autosaves sheet drag-drop reorder optimistically', () => {
    createComponent();

    fixture.componentInstance.dropSheets(dropEvent(0, 1));
    fixture.detectChanges();

    expect(service.updateSheetPriorities).toHaveBeenCalledWith([SQL_SHEET_ID, PYTHON_SHEET_ID]);
    expect(notifications.success).toHaveBeenCalledWith('Порядок структуры сохранён.');
    const tabs = sheetTabs();
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual(['SQL', 'Питон']);
  });

  it('keeps optimistic reorder dirty only while its save request is pending', () => {
    const request = new Subject<void>();
    service.updateSheetPriorities.mockReturnValue(request.asObservable());
    createComponent();

    fixture.componentInstance.dropSheets(dropEvent(0, 1));

    expect(fixture.componentInstance.unsavedChangesScope.hasChanges()).toBe(true);
    request.next();
    request.complete();
    expect(fixture.componentInstance.unsavedChangesScope.hasChanges()).toBe(false);
  });

  it('keeps a changed create dialog open when discarding is cancelled', () => {
    createComponent();
    fixture.componentInstance.openSheetCreateDialog();
    fixture.componentInstance.sheetCreateForm.controls.nameRu.setValue('Черновик');
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);

    fixture.componentInstance.closeCreateDialog();

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.createDialog()?.kind).toBe('sheet');
    expect(fixture.componentInstance.sheetCreateForm.controls.nameRu.value).toBe('Черновик');
  });

  it('does not autosave same-position drops', () => {
    createComponent();

    fixture.componentInstance.dropSheets(dropEvent(0, 0));

    expect(service.updateSheetPriorities).not.toHaveBeenCalled();
  });

  it('rolls back and reloads structure when autosave fails', () => {
    service.updateSheetPriorities.mockReturnValue(throwError(() => ({ message: 'Failed' })));
    createComponent();

    fixture.componentInstance.dropSheets(dropEvent(0, 1));
    fixture.detectChanges();

    expect(notifications.error).toHaveBeenCalledWith('Не удалось сохранить порядок структуры.');
    expect(service.getStructure).toHaveBeenCalledTimes(2);
    expect(sheetTabs().map((tab) => tab.textContent?.trim())).toEqual(['Питон', 'SQL']);
  });

  it('autosaves nested section and subsection reorders', () => {
    createComponent();
    const sheet = fixture.componentInstance.structure().sheets[0];
    const section = sheet.sections[0];

    fixture.componentInstance.dropSections(dropEvent(0, 1), sheet);
    fixture.componentInstance.dropSubsections(dropEvent(0, 1), section);

    expect(service.updateSectionPriorities).toHaveBeenCalledWith(PYTHON_SHEET_ID, [
      ADVANCED_SECTION_ID,
      BASICS_SECTION_ID,
    ]);
    expect(service.updateSubsectionPriorities).toHaveBeenCalledWith(BASICS_SECTION_ID, [
      TYPING_SUBSECTION_ID,
      STYLE_SUBSECTION_ID,
    ]);
  });

  it('creates a sheet from the modal and selects it after reload', () => {
    const createdSheet = {
      id: GO_SHEET_ID,
      key: 'go',
      name: 'Go',
      priority: 3,
      translations: { ru: { name: 'Го' }, en: { name: 'Go' } },
      sections: [],
    };
    service.createSheet.mockReturnValue(of(createdSheet));
    service.getStructure
      .mockReturnValueOnce(of(matrixStructure()))
      .mockReturnValueOnce(of(matrixStructureWith({ sheets: [createdSheet] })));
    createComponent();

    click('[data-testid="matrix-structure-open-sheet-create"]');
    setInput('[data-testid="matrix-structure-create-sheet-key"]', ' go ');
    setInput('[data-testid="matrix-structure-create-sheet-ru"]', ' Го ');
    setInput('[data-testid="matrix-structure-create-sheet-en"]', ' Go ');
    submit('[data-testid="matrix-structure-create-sheet-form"]');
    fixture.detectChanges();

    expect(service.createSheet).toHaveBeenCalledWith(
      {
        key: 'go',
        translations: { ru: { name: 'Го' }, en: { name: 'Go' } },
      },
      'ru',
    );
    expect(service.getStructure).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.selectedSheetId()).toBe(GO_SHEET_ID);
    expect(
      fixture.nativeElement.querySelector('[data-testid="matrix-structure-create-dialog"]'),
    ).toBeNull();
    expect(notifications.success).toHaveBeenCalledWith('Лист создан.');
  });

  it('keeps the section create modal open and shows validation before submit', () => {
    createComponent();

    click('[data-testid="matrix-structure-open-section-create"]');
    submit('[data-testid="matrix-structure-create-section-form"]');
    fixture.detectChanges();

    expect(service.createSection).not.toHaveBeenCalled();
    expect(
      fixture.nativeElement.querySelector('[data-testid="matrix-structure-create-dialog"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Заполните поле.');
    expect(notifications.error).toHaveBeenCalledWith('Проверьте поля элемента структуры.');
  });

  it('creates a section for the selected sheet and selects it after reload', () => {
    const createdSection = {
      id: TESTING_SECTION_ID,
      name: 'Тестирование',
      priority: 3,
      translations: { ru: { name: 'Тестирование' }, en: { name: 'Testing' } },
      subsections: [],
    };
    service.createSection.mockReturnValue(of(createdSection));
    service.getStructure
      .mockReturnValueOnce(of(matrixStructure()))
      .mockReturnValueOnce(of(matrixStructureWith({ sections: [createdSection] })));
    createComponent();

    click('[data-testid="matrix-structure-open-section-create"]');
    setInput('[data-testid="matrix-structure-create-name-ru"]', ' Тестирование ');
    setInput('[data-testid="matrix-structure-create-name-en"]', ' Testing ');
    submit('[data-testid="matrix-structure-create-section-form"]');
    fixture.detectChanges();

    expect(service.createSection).toHaveBeenCalledWith(
      PYTHON_SHEET_ID,
      { translations: { ru: { name: 'Тестирование' }, en: { name: 'Testing' } } },
      'ru',
    );
    expect(fixture.componentInstance.selectedSheet()?.sections.at(-1)?.id).toBe(TESTING_SECTION_ID);
    expect(notifications.success).toHaveBeenCalledWith('Раздел создан.');
  });

  it('creates a subsection for the chosen section after reload', () => {
    const createdSubsection = {
      id: UNIT_SUBSECTION_ID,
      name: 'Юнит-тесты',
      priority: 3,
      translations: { ru: { name: 'Юнит-тесты' }, en: { name: 'Unit tests' } },
    };
    service.createSubsection.mockReturnValue(of(createdSubsection));
    service.getStructure
      .mockReturnValueOnce(of(matrixStructure()))
      .mockReturnValueOnce(of(matrixStructureWith({ subsections: [createdSubsection] })));
    createComponent();

    click('[data-testid="matrix-structure-open-subsection-create"]');
    setInput('[data-testid="matrix-structure-create-name-ru"]', ' Юнит-тесты ');
    setInput('[data-testid="matrix-structure-create-name-en"]', ' Unit tests ');
    submit('[data-testid="matrix-structure-create-subsection-form"]');
    fixture.detectChanges();

    expect(service.createSubsection).toHaveBeenCalledWith(
      BASICS_SECTION_ID,
      { translations: { ru: { name: 'Юнит-тесты' }, en: { name: 'Unit tests' } } },
      'ru',
    );
    expect(fixture.componentInstance.selectedSheet()?.sections[0].subsections.at(-1)?.id).toBe(
      UNIT_SUBSECTION_ID,
    );
    expect(notifications.success).toHaveBeenCalledWith('Подраздел создан.');
  });

  it('keeps the create modal open when the API request fails', () => {
    service.createSheet.mockReturnValue(throwError(() => ({ message: 'Failed' })));
    createComponent();

    click('[data-testid="matrix-structure-open-sheet-create"]');
    setInput('[data-testid="matrix-structure-create-sheet-key"]', 'go');
    setInput('[data-testid="matrix-structure-create-sheet-ru"]', 'Го');
    setInput('[data-testid="matrix-structure-create-sheet-en"]', 'Go');
    submit('[data-testid="matrix-structure-create-sheet-form"]');
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="matrix-structure-create-dialog"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-error-message')).toBeTruthy();
    expect(notifications.error).toHaveBeenCalledWith(
      'Не удалось создать элемент структуры матрицы.',
    );
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(MatrixStructurePageComponent);
    fixture.detectChanges();
  }

  function sheetTabs(): HTMLButtonElement[] {
    return Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="matrix-structure-sheet-tab"]'),
    );
  }

  function click(selector: string): void {
    const element = fixture.nativeElement.querySelector(selector) as HTMLButtonElement | null;
    expect(element).not.toBeNull();
    element?.click();
    fixture.detectChanges();
  }

  function submit(selector: string): void {
    const form = fixture.nativeElement.querySelector(selector) as HTMLFormElement | null;
    expect(form).not.toBeNull();
    form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }

  function setInput(selector: string, value: string): void {
    const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement | null;
    expect(input).not.toBeNull();
    if (input === null) return;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }
});

function dropEvent<T>(previousIndex: number, currentIndex: number): CdkDragDrop<T> {
  return { previousIndex, currentIndex } as CdkDragDrop<T>;
}

function matrixStructure(): AdminMatrixStructure {
  return {
    sheets: [
      {
        id: PYTHON_SHEET_ID,
        key: 'python',
        name: 'Питон',
        priority: 1,
        translations: { ru: { name: 'Питон' }, en: { name: 'Python' } },
        sections: [
          {
            id: BASICS_SECTION_ID,
            name: 'Основы',
            priority: 1,
            translations: { ru: { name: 'Основы' }, en: { name: 'Core' } },
            subsections: [
              {
                id: STYLE_SUBSECTION_ID,
                name: 'Стиль',
                priority: 1,
                translations: { ru: { name: 'Стиль' }, en: { name: 'Style' } },
              },
              {
                id: TYPING_SUBSECTION_ID,
                name: 'Типизация',
                priority: 2,
                translations: { ru: { name: 'Типизация' }, en: { name: 'Typing' } },
              },
            ],
          },
          {
            id: ADVANCED_SECTION_ID,
            name: 'Продвинутое',
            priority: 2,
            translations: { ru: { name: 'Продвинутое' }, en: { name: 'Advanced' } },
            subsections: [],
          },
        ],
      },
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
}

function matrixStructureWith(options: {
  sheets?: AdminMatrixStructure['sheets'];
  sections?: AdminMatrixStructure['sheets'][number]['sections'];
  subsections?: AdminMatrixStructure['sheets'][number]['sections'][number]['subsections'];
}): AdminMatrixStructure {
  const structure = matrixStructure();
  return {
    sheets: [
      {
        ...structure.sheets[0],
        sections: [
          {
            ...structure.sheets[0].sections[0],
            subsections: [
              ...structure.sheets[0].sections[0].subsections,
              ...(options.subsections ?? []),
            ],
          },
          ...structure.sheets[0].sections.slice(1),
          ...(options.sections ?? []),
        ],
      },
      ...structure.sheets.slice(1),
      ...(options.sheets ?? []),
    ],
  };
}
