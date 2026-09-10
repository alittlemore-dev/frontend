import { TestBed } from '@angular/core/testing';
import { DOCUMENT } from '@angular/common';
import { AnonymousReactionService } from './anonymous-reaction.service';

describe('AnonymousReactionService', () => {
  let service: AnonymousReactionService;
  let randomUuid: jest.Mock<string, []>;

  beforeEach(() => {
    localStorage.clear();
    randomUuid = jest.fn().mockReturnValue('generated-token');
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: randomUuid,
    });
    TestBed.configureTestingModule({ providers: [AnonymousReactionService] });
    service = TestBed.inject(AnonymousReactionService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it('creates client token lazily and reuses it', () => {
    expect(localStorage.getItem('articleReactionClientToken')).toBeNull();

    expect(service.getOrCreateClientToken()).toBe('generated-token');
    expect(service.getOrCreateClientToken()).toBe('generated-token');

    expect(randomUuid).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('articleReactionClientToken')).toBe('generated-token');
  });

  it('persists and clears article-scoped reaction selection', () => {
    service.setReaction('typed-articles', 'poop');

    expect(service.getReaction('typed-articles')).toBe('poop');

    service.setReaction('typed-articles', null);

    expect(service.getReaction('typed-articles')).toBeNull();
  });

  it('does not use localStorage or crypto when a server document has no defaultView', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage is not available on the server');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('localStorage is not available on the server');
    });
    randomUuid.mockImplementation(() => {
      throw new Error('crypto is not available on the server');
    });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        AnonymousReactionService,
        {
          provide: DOCUMENT,
          useValue: {
            defaultView: null,
          },
        },
      ],
    });

    const serverService = TestBed.inject(AnonymousReactionService);

    expect(serverService.getOrCreateClientToken()).toBeNull();
    expect(serverService.getReaction('typed-articles')).toBeNull();
    serverService.setReaction('typed-articles', 'poop');
  });
});
