import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ScrollStrategyOptions } from '@angular/cdk/overlay';
import { ModalPageScrollLockService } from './modal-page-scroll-lock.service';

describe('ModalPageScrollLockService', () => {
  let block: jest.Mock;
  let enable: jest.Mock;
  let disable: jest.Mock;

  beforeEach(() => {
    enable = jest.fn();
    disable = jest.fn();
    block = jest.fn(() => ({ attach: jest.fn(), enable, disable }));
    TestBed.configureTestingModule({
      providers: [{ provide: ScrollStrategyOptions, useValue: { block } }],
    });
  });

  it('keeps page scrolling blocked until the final modal releases it', () => {
    const service = TestBed.inject(ModalPageScrollLockService);

    const releaseFirst = service.acquire();
    const releaseSecond = service.acquire();

    expect(block).toHaveBeenCalledTimes(1);
    expect(enable).toHaveBeenCalledTimes(1);

    releaseFirst();
    expect(disable).not.toHaveBeenCalled();

    releaseSecond();
    expect(disable).toHaveBeenCalledTimes(1);
  });

  it('ignores repeated releases from the same modal', () => {
    const service = TestBed.inject(ModalPageScrollLockService);
    const release = service.acquire();

    release();
    release();

    expect(disable).toHaveBeenCalledTimes(1);
  });

  it('does not access the browser scroll strategy during server rendering', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: ScrollStrategyOptions, useValue: { block } },
      ],
    });

    const release = TestBed.inject(ModalPageScrollLockService).acquire();
    release();

    expect(block).not.toHaveBeenCalled();
    expect(enable).not.toHaveBeenCalled();
    expect(disable).not.toHaveBeenCalled();
  });
});
