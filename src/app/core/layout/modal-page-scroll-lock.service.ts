import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { BlockScrollStrategy, ScrollStrategyOptions } from '@angular/cdk/overlay';

@Injectable({ providedIn: 'root' })
export class ModalPageScrollLockService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly scrollStrategies = inject(ScrollStrategyOptions);
  private strategy: BlockScrollStrategy | null = null;
  private activeLocks = 0;

  acquire(): () => void {
    if (!isPlatformBrowser(this.platformId)) {
      return (): void => undefined;
    }

    this.activeLocks += 1;
    if (this.activeLocks === 1) {
      this.strategy ??= this.scrollStrategies.block();
      this.strategy.enable();
    }

    let released = false;
    return (): void => {
      if (released) return;
      released = true;
      this.activeLocks -= 1;
      if (this.activeLocks === 0) {
        this.strategy?.disable();
      }
    };
  }
}
