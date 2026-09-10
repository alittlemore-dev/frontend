import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { of, throwError } from 'rxjs';
import { NotificationService } from '../../../../core/notifications/notification.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { ArticleFolder } from '../../models/article-workspace.model';
import { ArticleWorkspaceService } from '../../services/article-workspace.service';
import { ArticleFoldersPageComponent } from './article-folders-page.component';

describe('ArticleFoldersPageComponent', () => {
  let fixture: ComponentFixture<ArticleFoldersPageComponent>;
  let articlesService: {
    getFolders: jest.Mock;
    createFolder: jest.Mock;
    updateFolderPriorities: jest.Mock;
  };
  let notifications: {
    success: jest.Mock;
    error: jest.Mock;
  };

  beforeEach(async () => {
    articlesService = {
      getFolders: jest.fn().mockReturnValue(of([folder('folder-1', 'Engineering', 1)])),
      createFolder: jest.fn().mockReturnValue(of(folder('folder-2', 'Architecture', 2))),
      updateFolderPriorities: jest.fn().mockReturnValue(of(undefined)),
    };
    notifications = {
      success: jest.fn(),
      error: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ArticleFoldersPageComponent],
      providers: [
        { provide: ArticleWorkspaceService, useValue: articlesService },
        { provide: NotificationService, useValue: notifications },
        provideI18nTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ArticleFoldersPageComponent);
    fixture.detectChanges();
  });

  it('renders loaded folders', () => {
    expect(articlesService.getFolders).toHaveBeenCalledWith('ru');
    expect(fixture.nativeElement.textContent).toContain('Engineering');
    expect(fixture.nativeElement.textContent).toContain('engineering');
  });

  it('reorders folders and saves ordered ids', () => {
    articlesService.getFolders.mockReturnValue(
      of([folder('folder-1', 'Engineering', 1), folder('folder-2', 'Architecture', 2)]),
    );
    fixture.componentInstance.loadFolders();
    fixture.detectChanges();

    fixture.componentInstance.dropFolders(dropEvent(1, 0));
    fixture.detectChanges();

    expect(articlesService.updateFolderPriorities).toHaveBeenCalledWith(['folder-2', 'folder-1']);
    expect(
      fixture.componentInstance.folders().map((item) => `${item.id}:${item.priority}`),
    ).toEqual(['folder-2:1', 'folder-1:2']);
    expect(notifications.success).toHaveBeenCalledWith('Порядок папок сохранён.');
  });

  it('rolls back and reloads when reorder fails', () => {
    articlesService.getFolders.mockReturnValue(
      of([folder('folder-1', 'Engineering', 1), folder('folder-2', 'Architecture', 2)]),
    );
    articlesService.updateFolderPriorities.mockReturnValue(throwError(() => new Error('Nope')));
    fixture.componentInstance.loadFolders();
    fixture.detectChanges();

    fixture.componentInstance.dropFolders(dropEvent(1, 0));
    fixture.detectChanges();

    expect(fixture.componentInstance.folders().map((item) => item.id)).toEqual([
      'folder-1',
      'folder-2',
    ]);
    expect(notifications.error).toHaveBeenCalledWith('Не удалось сохранить порядок папок.');
    expect(articlesService.getFolders).toHaveBeenCalledTimes(3);
  });

  it('creates a folder from the modal and reloads the list', () => {
    articlesService.getFolders.mockReturnValueOnce(
      of([folder('folder-1', 'Engineering', 1), folder('folder-2', 'Architecture', 2)]),
    );

    click('[data-testid="article-folders-open-create"]');
    setInput('[data-testid="article-folders-create-key"]', ' architecture ');
    setInput('[data-testid="article-folders-create-name-ru"]', ' Архитектура ');
    setInput('[data-testid="article-folders-create-name-en"]', ' Architecture ');
    submit('[data-testid="article-folders-create-form"]');
    fixture.detectChanges();

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
    expect(articlesService.getFolders).toHaveBeenCalledTimes(2);
    expect(
      fixture.nativeElement.querySelector('[data-testid="article-folders-create-dialog"]'),
    ).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Architecture');
    expect(notifications.success).toHaveBeenCalledWith('Папка создана.');
  });

  it('keeps the create modal open and reports validation errors', () => {
    click('[data-testid="article-folders-open-create"]');

    submit('[data-testid="article-folders-create-form"]');
    fixture.detectChanges();

    expect(articlesService.createFolder).not.toHaveBeenCalled();
    expect(
      fixture.nativeElement.querySelector('[data-testid="article-folders-create-dialog"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Заполните поле.');
    expect(notifications.error).toHaveBeenCalledWith('Проверьте поля папки.');
  });

  it('keeps the create modal open when folder creation fails', () => {
    articlesService.createFolder.mockReturnValue(throwError(() => new Error('Nope')));

    click('[data-testid="article-folders-open-create"]');
    setInput('[data-testid="article-folders-create-key"]', 'architecture');
    setInput('[data-testid="article-folders-create-name-ru"]', 'Архитектура');
    setInput('[data-testid="article-folders-create-name-en"]', 'Architecture');
    submit('[data-testid="article-folders-create-form"]');
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="article-folders-create-dialog"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-error-message')).toBeTruthy();
    expect(notifications.error).toHaveBeenCalledWith('Не удалось создать папку.');
  });

  it('keeps a changed create modal open when discarding is rejected', () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    click('[data-testid="article-folders-open-create"]');
    setInput('[data-testid="article-folders-create-key"]', 'architecture');

    fixture.componentInstance.closeCreateDialog();
    fixture.detectChanges();

    expect(confirm).toHaveBeenCalled();
    expect(
      fixture.nativeElement.querySelector('[data-testid="article-folders-create-dialog"]'),
    ).not.toBeNull();
  });

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

function dropEvent(previousIndex: number, currentIndex: number): CdkDragDrop<ArticleFolder[]> {
  return { previousIndex, currentIndex } as CdkDragDrop<ArticleFolder[]>;
}

function folder(id: string, name: string, priority: number): ArticleFolder {
  return {
    id,
    key: name.toLowerCase(),
    name,
    priority,
    translations: {
      ru: { name },
      en: { name },
    },
  };
}
