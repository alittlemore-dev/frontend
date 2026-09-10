import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SeoService } from '../../../../core/seo/seo.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { NotFoundPageComponent } from './not-found-page.component';

describe('NotFoundPageComponent', () => {
  let fixture: ComponentFixture<NotFoundPageComponent>;
  let seoService: { setTranslatedMeta: jest.Mock };

  beforeEach(async () => {
    seoService = {
      setTranslatedMeta: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [NotFoundPageComponent],
      providers: [
        provideRouter([]),
        provideI18nTesting(),
        { provide: SeoService, useValue: seoService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotFoundPageComponent);
    fixture.detectChanges();
  });

  it('links back to the localized public home', () => {
    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement | null;

    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('/ru/how-this-site-is-built');
    expect(link?.textContent?.trim()).toBe('Вернуться на главную');
  });

  it('sets translated no-content SEO metadata', () => {
    expect(seoService.setTranslatedMeta).toHaveBeenCalledWith({
      titleKey: 'notFound.seo.title',
      descriptionKey: 'notFound.seo.description',
    });
  });
});
