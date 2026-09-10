import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatrixResourcePickerComponent } from './matrix-resource-picker.component';
import { MatrixResource } from '../../../../models/matrix-question.model';
import { provideI18nTesting } from '../../../../../../testing/i18n-testing';

const existingResource: MatrixResource = {
  id: '00000000000000000000000000000001',
  name: 'Python docs',
  url: 'https://docs.python.org',
  translations: {
    ru: { name: 'Документация Python' },
    en: { name: 'Python docs' },
  },
};

const existingResourceDraft = {
  ...existingResource,
  context: '',
  translations: {
    ru: { name: 'Документация Python', context: '' },
    en: { name: 'Python docs', context: '' },
  },
  isNew: false,
};

describe('MatrixResourcePickerComponent', () => {
  let fixture: ComponentFixture<MatrixResourcePickerComponent>;
  let component: MatrixResourcePickerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatrixResourcePickerComponent],
      providers: [
        provideI18nTesting({
          'matrix.resources.urlPlaceholder': 'Ссылка',
          'matrix.resources.contextRuLabel': 'Контекст RU',
          'matrix.resources.contextEnLabel': 'Контекст EN',
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MatrixResourcePickerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('resources', []);
    fixture.componentRef.setInput('searchResults', [existingResource]);
    fixture.componentRef.setInput('activeLanguage', 'ru');
    fixture.detectChanges();
  });

  it('emits search text as it changes', () => {
    const emitted: string[] = [];
    component.searchChange.subscribe((value) => emitted.push(value));

    component.setSearch('python');

    expect(emitted).toEqual(['python']);
  });

  it('renders localized url placeholder for new resources', () => {
    const urlInput = fixture.nativeElement.querySelector('input[type="url"]') as HTMLInputElement;

    expect(urlInput.placeholder).toBe('Ссылка');
  });

  it('shows visible localized labels for resource contexts', () => {
    fixture.componentRef.setInput('resources', [existingResourceDraft]);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Контекст RU');
    expect(text).toContain('Контекст EN');
  });

  it('attaches an existing resource once', () => {
    const emitted: unknown[] = [];
    component.resourcesChange.subscribe((resources) => emitted.push(resources));

    component.attach(existingResource);
    fixture.componentRef.setInput('resources', [existingResourceDraft]);
    component.attach(existingResource);

    expect(emitted).toEqual([[existingResourceDraft]]);
  });

  it('adds a new resource when name and url are present', () => {
    const emitted: unknown[] = [];
    component.resourcesChange.subscribe((resources) => emitted.push(resources));

    component.newNameRu.set('Документация');
    component.newNameEn.set('Docs');
    component.newUrl.set('https://example.com');
    component.addNew();

    expect(emitted).toEqual([
      [
        {
          id: -1,
          name: 'Документация',
          url: 'https://example.com',
          context: '',
          translations: {
            ru: { name: 'Документация', context: '' },
            en: { name: 'Docs', context: '' },
          },
          isNew: true,
        },
      ],
    ]);
    expect(component.newNameRu()).toBe('');
    expect(component.newNameEn()).toBe('');
    expect(component.newUrl()).toBe('');
  });

  it('uses sequential negative ids for new resources', () => {
    const emitted: unknown[] = [];
    component.resourcesChange.subscribe((resources) => emitted.push(resources));

    component.newNameRu.set('Первый');
    component.newNameEn.set('First');
    component.newUrl.set('https://first.example.com');
    component.addNew();

    fixture.componentRef.setInput('resources', [
      {
        id: -1,
        name: 'Первый',
        url: 'https://first.example.com',
        context: '',
        translations: {
          ru: { name: 'Первый', context: '' },
          en: { name: 'First', context: '' },
        },
        isNew: true,
      },
    ]);

    component.newNameRu.set('Второй');
    component.newNameEn.set('Second');
    component.newUrl.set('https://second.example.com');
    component.addNew();

    expect(emitted.at(-1)).toEqual([
      {
        id: -1,
        name: 'Первый',
        url: 'https://first.example.com',
        context: '',
        translations: {
          ru: { name: 'Первый', context: '' },
          en: { name: 'First', context: '' },
        },
        isNew: true,
      },
      {
        id: -2,
        name: 'Второй',
        url: 'https://second.example.com',
        context: '',
        translations: {
          ru: { name: 'Второй', context: '' },
          en: { name: 'Second', context: '' },
        },
        isNew: true,
      },
    ]);
  });

  it('updates context and detaches resources', () => {
    const emitted: unknown[] = [];
    component.resourcesChange.subscribe((resources) => emitted.push(resources));
    fixture.componentRef.setInput('resources', [existingResourceDraft]);

    component.updateContext(0, 'ru', 'Read first');
    component.detach(0);

    expect(emitted).toEqual([
      [
        {
          ...existingResourceDraft,
          context: 'Read first',
          translations: {
            ru: { name: 'Документация Python', context: 'Read first' },
            en: { name: 'Python docs', context: '' },
          },
        },
      ],
      [],
    ]);
  });
});
