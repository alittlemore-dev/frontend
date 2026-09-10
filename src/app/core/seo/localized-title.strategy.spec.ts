import { Component, signal } from '@angular/core';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter, Router, TitleStrategy } from '@angular/router';
import { I18nService } from '../i18n/i18n.service';
import { LocalizedTitleStrategy } from './localized-title.strategy';

@Component({ template: '' })
class BlankPageComponent {}

describe('LocalizedTitleStrategy', () => {
  const language = signal<'ru' | 'en'>('ru');
  const messages: Record<'ru' | 'en', Record<string, string>> = {
    ru: { 'adminPanel.title': 'Админ-панель' },
    en: { 'adminPanel.title': 'Admin panel' },
  };

  let router: Router;
  let title: Title;

  beforeEach(() => {
    language.set('ru');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'admin', title: 'adminPanel.title', component: BlankPageComponent },
          { path: 'public', component: BlankPageComponent },
        ]),
        {
          provide: I18nService,
          useValue: {
            language,
            translate: (key: string) => messages[language()][key] ?? key,
          },
        },
        { provide: TitleStrategy, useClass: LocalizedTitleStrategy },
      ],
    });
    router = TestBed.inject(Router);
    title = TestBed.inject(Title);
  });

  it('translates the active route title and updates it when the language changes', fakeAsync(() => {
    void router.navigateByUrl('/admin');
    tick();

    expect(title.getTitle()).toBe('Админ-панель');

    language.set('en');
    TestBed.flushEffects();

    expect(title.getTitle()).toBe('Admin panel');
  }));

  it('does not overwrite a public SEO title when the active route has no title', fakeAsync(() => {
    void router.navigateByUrl('/admin');
    tick();
    void router.navigateByUrl('/public');
    tick();
    title.setTitle('Public SEO title');

    language.set('en');
    TestBed.flushEffects();

    expect(title.getTitle()).toBe('Public SEO title');
  }));
});
