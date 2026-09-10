import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';

import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;
  let document: Document;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
    document = TestBed.inject(DOCUMENT);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it('defaults to light theme when no preference stored', () => {
    expect(service.theme()).toBe('light');
  });

  it('reads stored theme on init', () => {
    localStorage.setItem('chosenTheme', 'dark');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    const freshService = TestBed.inject(ThemeService);
    expect(freshService.theme()).toBe('dark');
  });

  it('sets data-bs-theme attribute on document element', () => {
    service.setTheme('dark');
    expect(document.documentElement.getAttribute('data-bs-theme')).toBe('dark');
  });

  it('toggles theme', () => {
    service.setTheme('light');
    service.toggleTheme();
    expect(service.theme()).toBe('dark');
    service.toggleTheme();
    expect(service.theme()).toBe('light');
  });

  it('does not use localStorage when server document has no defaultView', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage is not available on the server');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('localStorage is not available on the server');
    });
    TestBed.resetTestingModule();
    const setAttribute = jest.fn();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: DOCUMENT,
          useValue: {
            defaultView: null,
            documentElement: { setAttribute },
          },
        },
      ],
    });

    const serverService = TestBed.inject(ThemeService);

    expect(serverService.theme()).toBe('light');
    serverService.setTheme('dark');
    expect(serverService.theme()).toBe('dark');
    expect(setAttribute).toHaveBeenLastCalledWith('data-bs-theme', 'dark');
  });
});
