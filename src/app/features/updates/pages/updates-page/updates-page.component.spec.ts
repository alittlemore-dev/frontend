import { ComponentFixture, TestBed } from '@angular/core/testing';
import { I18nService } from '../../../../core/i18n/i18n.service';
import { SeoService } from '../../../../core/seo/seo.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { UpdatesPageComponent } from './updates-page.component';

describe('UpdatesPageComponent', () => {
  let fixture: ComponentFixture<UpdatesPageComponent>;
  let i18n: I18nService;
  let seoService: { setTranslatedMeta: jest.Mock };

  beforeEach(async () => {
    seoService = {
      setTranslatedMeta: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [UpdatesPageComponent],
      providers: [
        provideI18nTesting({
          'updates.seo.title': 'Обновления',
          'updates.seo.description': 'Публичный журнал изменений сайта.',
          'updates.hero.kicker': 'Журнал изменений',
          'updates.hero.title': 'Обновления сайта',
          'updates.hero.lead':
            'Крупные изменения сайта-портфолио и раздела статей, сгруппированные по месяцам.',
          'updates.tag.backend': 'Backend',
          'updates.tag.frontend': 'Frontend',
          'updates.tag.content': 'Контент',
          'updates.tag.seo': 'SEO',
          'updates.tag.analytics': 'Аналитика',
          'updates.tag.matrix': 'Матрица',
          'updates.tag.infra': 'Инфраструктура',
          'updates.tag.admin': 'Админка',
          'updates.tag.auth': 'Auth',
          'updates.tag.localization': 'Локализация',
          'updates.tag.quality': 'Качество',
          'updates.tag.security': 'Безопасность',
          'updates.tag.delivery': 'Доставка',
        }),
        { provide: SeoService, useValue: seoService },
      ],
    }).compileComponents();

    i18n = TestBed.inject(I18nService);
    fixture = TestBed.createComponent(UpdatesPageComponent);
    fixture.detectChanges();
  });

  it('sets localized SEO metadata with canonical alternates', () => {
    expect(seoService.setTranslatedMeta).toHaveBeenCalledWith({
      titleKey: 'updates.seo.title',
      descriptionKey: 'updates.seo.description',
      canonicalPath: '/ru/updates',
      alternates: [
        { language: 'ru', path: '/ru/updates' },
        { language: 'en', path: '/en/updates' },
      ],
    });
  });

  it('renders localized public update entries grouped by month', () => {
    const text = fixture.nativeElement.textContent as string;
    const months = fixture.nativeElement.querySelectorAll('.updates-page__month');
    const entries = fixture.nativeElement.querySelectorAll('.updates-page__entry');
    const monthLabel = fixture.nativeElement.querySelector('time');
    const entryTitle = fixture.nativeElement.querySelector('.updates-page__entry h3');
    const badges = fixture.nativeElement.querySelectorAll('.badge');

    expect(text).toContain('Обновления сайта');
    expect(text).toContain('Крупные изменения сайта-портфолио и раздела статей');
    expect(months.length).toBeGreaterThan(0);
    expect(entries.length).toBeGreaterThan(0);
    expect(monthLabel?.getAttribute('datetime')).toMatch(/^\d{4}-\d{2}$/);
    expect(monthLabel?.textContent?.trim()).toBeTruthy();
    expect(entryTitle?.textContent?.trim()).toBeTruthy();
    expect(badges.length).toBeGreaterThan(0);
  });

  it('recomputes authored update content when the language changes', () => {
    const russianMonth = fixture.nativeElement.querySelector('time')?.textContent?.trim();
    const russianTitle = fixture.nativeElement
      .querySelector('.updates-page__entry h3')
      ?.textContent?.trim();

    i18n.switchLanguage('en').subscribe();
    fixture.detectChanges();

    const englishMonth = fixture.nativeElement.querySelector('time')?.textContent?.trim();
    const englishTitle = fixture.nativeElement
      .querySelector('.updates-page__entry h3')
      ?.textContent?.trim();

    expect(englishMonth).toBeTruthy();
    expect(englishTitle).toBeTruthy();
    expect(englishMonth).not.toBe(russianMonth);
    expect(englishTitle).not.toBe(russianTitle);
  });
});
