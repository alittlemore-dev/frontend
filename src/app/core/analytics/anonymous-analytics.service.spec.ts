import { DOCUMENT } from '@angular/common';
import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { ApiClient } from '../http/api-client.service';
import { AuthService } from '../auth/auth.service';
import { ConsentService } from '../privacy/consent.service';
import { AnonymousAnalyticsService, publicPage } from './anonymous-analytics.service';

describe('AnonymousAnalyticsService', () => {
  let service: AnonymousAnalyticsService;
  let events: Subject<NavigationEnd | NavigationStart>;
  let post: jest.Mock;
  let manager: ReturnType<typeof signal<boolean>>;
  let visible: string;
  let dnt: string;
  const referrer = Object.getOwnPropertyDescriptor(document, 'referrer');
  const visibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
  const tracking = Object.getOwnPropertyDescriptor(window.navigator, 'doNotTrack');

  beforeEach(() => {
    jest.useFakeTimers();
    events = new Subject();
    post = jest.fn(() => of(undefined));
    manager = signal(false);
    visible = 'visible';
    dnt = '0';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visible });
    Object.defineProperty(document, 'referrer', {
      configurable: true,
      value: 'https://www.google.com/search?q=private-query',
    });
    Object.defineProperty(window.navigator, 'doNotTrack', { configurable: true, get: () => dnt });
    window.localStorage.clear();
    window.sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { events } },
        { provide: ApiClient, useValue: { post } },
        { provide: AuthService, useValue: { canManageContent: manager } },
        { provide: ConsentService, useValue: { cookieConsentAccepted: signal(false) } },
      ],
    });
    service = TestBed.inject(AnonymousAnalyticsService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    jest.useRealTimers();
    for (const [object, key, descriptor] of [
      [document, 'referrer', referrer],
      [document, 'visibilityState', visibility],
      [window.navigator, 'doNotTrack', tracking],
    ] as const) {
      if (descriptor === undefined) Reflect.deleteProperty(object, key);
      else Object.defineProperty(object, key, descriptor);
    }
  });

  it('records bounded page categories, keeps the original source and ignores protected routes', () => {
    service.start();
    service.start();
    events.next(
      new NavigationEnd(1, '/en/articles/a?email=private', '/en/articles/a?email=private'),
    );
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][1]).toMatchObject({
      kind: 'Site',
      targetId: 'articles',
      source: 'Search',
      event: 'View',
    });
    expect(JSON.stringify(post.mock.calls)).not.toContain('private');
    expect(service.source()).toBe('Search');
    events.next(new NavigationEnd(2, '/en/competency/matrix', '/en/competency/matrix'));
    expect(post.mock.calls[1][1].source).toBe('Internal');
    expect(post.mock.calls[1][1].visitorToken).toBe(post.mock.calls[0][1].visitorToken);
    expect(post.mock.calls[1][1].visitToken).not.toBe(post.mock.calls[0][1].visitToken);
    events.next(new NavigationEnd(3, '/admin-panel', '/admin-panel'));
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('counts engagement once after 15 visible seconds and stops when the question closes', () => {
    service.start();
    service.startMatrix('python/context-managers');
    jest.advanceTimersByTime(10000);
    visible = 'hidden';
    jest.advanceTimersByTime(30000);
    expect(post).toHaveBeenCalledTimes(1);
    visible = 'visible';
    jest.advanceTimersByTime(5000);
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1][1]).toMatchObject({
      targetId: 'python/context-managers',
      event: 'Engaged',
      visitToken: post.mock.calls[0][1].visitToken,
    });
    jest.advanceTimersByTime(30000);
    expect(post).toHaveBeenCalledTimes(2);
    service.startMatrix('python/another-question');
    service.stopMatrix();
    jest.advanceTimersByTime(30000);
    expect(post).toHaveBeenCalledTimes(3);
  });

  it('does not track managers or browsers with Do Not Track', () => {
    manager.set(true);
    service.startMatrix('python/private');
    expect(post).not.toHaveBeenCalled();
    manager.set(false);
    dnt = '1';
    service.startMatrix('python/public');
    expect(post).not.toHaveBeenCalled();
  });

  it('keeps a synchronously loaded question active after navigation ends', () => {
    service.start();
    events.next(new NavigationEnd(1, '/en/articles', '/en/articles'));
    const url = '/en/competency/matrix/questions/python/context-managers';
    events.next(new NavigationStart(2, url));
    service.startMatrix('python/context-managers');
    expect(post.mock.calls[1][1].source).toBe('Internal');
    events.next(new NavigationEnd(2, url, url));
    jest.advanceTimersByTime(15000);
    expect(post.mock.calls.map((call) => call[1])).toContainEqual(
      expect.objectContaining({ kind: 'Matrix', event: 'Engaged' }),
    );
  });

  it('does not access storage, timers or HTTP during SSR', () => {
    TestBed.resetTestingModule();
    const storage = jest.fn(() => {
      throw new Error('SSR storage access');
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        {
          provide: DOCUMENT,
          useValue: {
            get defaultView() {
              return null;
            },
            get localStorage() {
              return storage();
            },
          },
        },
        { provide: Router, useValue: { events } },
        { provide: ApiClient, useValue: { post } },
        { provide: AuthService, useValue: { canManageContent: manager } },
        { provide: ConsentService, useValue: { cookieConsentAccepted: signal(false) } },
      ],
    });
    service = TestBed.inject(AnonymousAnalyticsService);
    service.start();
    service.startMatrix('python/public');
    expect(post).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('keeps private and unrelated paths outside the tracking categories', () => {
    expect(publicPage('/ru/competency/articles/topic?secret=value')).toBe('articles');
    expect(publicPage('/workspace/finance')).toBeNull();
    expect(publicPage('/en/account')).toBeNull();
    expect(publicPage('/en/articles-secret')).toBeNull();
  });
});
