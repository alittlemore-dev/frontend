import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideI18nTesting } from '../../../../../../testing/i18n-testing';
import { chooseSiteSelectOption } from '../../../../../../testing/site-select-testing';
import { ArticleWorkspaceService } from '../../../../services/article-workspace.service';
import { AdminUnsavedChangesScope } from '../../../../services/admin-unsaved-changes.service';
import { ArticleFolderPickerComponent } from './article-folder-picker.component';

describe('ArticleFolderPickerComponent', () => {
  let fixture: ComponentFixture<ArticleFolderPickerComponent>;
  let articlesService: {
    getFolders: jest.Mock;
    createFolder: jest.Mock;
  };

  beforeEach(async () => {
    articlesService = {
      getFolders: jest.fn().mockReturnValue(of([folder('folder-1', 'engineering', 1)])),
      createFolder: jest.fn().mockReturnValue(of(folder('folder-2', 'architecture', 2))),
    };

    await TestBed.configureTestingModule({
      imports: [ArticleFolderPickerComponent],
      providers: [
        { provide: ArticleWorkspaceService, useValue: articlesService },
        provideI18nTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ArticleFolderPickerComponent);
    fixture.componentRef.setInput(
      'unsavedChangesScope',
      new AdminUnsavedChangesScope(
        () => false,
        () => undefined,
      ),
    );
    fixture.componentRef.setInput('language', 'ru');
    fixture.componentRef.setInput('selectedFolderId', '');
    fixture.detectChanges();
  });

  it('loads folders and emits selected folder', () => {
    const selectedIds: string[] = [];
    const selectedNames: string[] = [];
    fixture.componentInstance.selectedFolderIdChange.subscribe((folderId) =>
      selectedIds.push(folderId),
    );
    fixture.componentInstance.selectedFolderChange.subscribe((folderValue) =>
      selectedNames.push(folderValue?.name ?? ''),
    );

    chooseSiteSelectOption(fixture, '#articleFolderId', 'folder-1');

    expect(articlesService.getFolders).toHaveBeenCalledWith('ru');
    expect(selectedIds).toEqual(['folder-1']);
    expect(selectedNames).toEqual(['Инженерия']);
  });

  it('creates a folder and selects it', () => {
    const selectedIds: string[] = [];
    fixture.componentInstance.selectedFolderIdChange.subscribe((folderId) =>
      selectedIds.push(folderId),
    );
    setInput('[data-testid="article-folder-key"]', 'architecture');
    setInput('[data-testid="article-folder-name-ru"]', 'Архитектура');
    setInput('[data-testid="article-folder-name-en"]', 'Architecture');

    click('[data-testid="article-folder-add"]');

    expect(articlesService.createFolder).toHaveBeenCalledWith(
      {
        key: 'architecture',
        translations: {
          ru: { name: 'Архитектура' },
          en: { name: 'Architecture' },
        },
      },
      'ru',
    );
    expect(selectedIds).toEqual(['folder-2']);
  });

  it('marks invalid inline create fields', () => {
    click('[data-testid="article-folder-add"]');

    expect(articlesService.createFolder).not.toHaveBeenCalled();
    expect(
      fixture.nativeElement.querySelector('[data-testid="article-folder-key"]').classList,
    ).toContain('is-invalid');
    expect(fixture.nativeElement.textContent).toContain('Заполните поле.');
  });

  function setInput(selector: string, value: string): void {
    const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function click(selector: string): void {
    const button = fixture.nativeElement.querySelector(selector) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
  }
});

function folder(id: string, key: string, priority: number): unknown {
  const name = key === 'engineering' ? 'Инженерия' : 'Архитектура';
  const nameEn = key === 'engineering' ? 'Engineering' : 'Architecture';
  return {
    id,
    key,
    name,
    priority,
    translations: {
      ru: { name },
      en: { name: nameEn },
    },
  };
}
