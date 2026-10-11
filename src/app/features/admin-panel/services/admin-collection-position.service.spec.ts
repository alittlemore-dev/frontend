import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { NavigationStart, Router, provideRouter } from '@angular/router';
import { AdminCollectionPositionService } from './admin-collection-position.service';

it('restores a collection position after rendering and ignores other URLs', async () => {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const router = TestBed.inject(Router);
  const url = jest.spyOn(router, 'url', 'get').mockReturnValue('/admin-panel/articles?page=2');
  const position = Object.getOwnPropertyDescriptor(window, 'scrollY');
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 520 });
  const scroll = jest.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  const service = TestBed.inject(AdminCollectionPositionService);
  (router.events as import('rxjs').Subject<unknown>).next(
    new NavigationStart(1, '/admin-panel/articles/example'),
  );
  service.restore();
  expect(scroll).not.toHaveBeenCalled();
  TestBed.tick();
  expect(scroll).toHaveBeenCalledWith({ top: 520, behavior: 'instant' });
  scroll.mockClear();
  url.mockReturnValue('/admin-panel/matrix-questions');
  service.restore();
  TestBed.tick();
  expect(scroll).not.toHaveBeenCalled();
  if (position) Object.defineProperty(window, 'scrollY', position);
});

it('does not access browser APIs with a server-like document', () => {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: DOCUMENT, useValue: { defaultView: null } }],
  });
  const router = TestBed.inject(Router);
  jest.spyOn(router, 'url', 'get').mockReturnValue('/admin-panel/articles');
  const service = TestBed.inject(AdminCollectionPositionService);
  expect(() =>
    (router.events as import('rxjs').Subject<unknown>).next(
      new NavigationStart(1, '/admin-panel/articles/example'),
    ),
  ).not.toThrow();
  expect(() => service.restore()).not.toThrow();
});
