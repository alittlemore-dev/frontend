import { ErrorHandler, Injectable, isDevMode } from '@angular/core';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    if (isDevMode()) {
      console.error('[GlobalErrorHandler]', error);
    } else {
      // TODO: replace with Sentry.captureException(error) when Sentry is wired up
      console.error('[GlobalErrorHandler]', error);
    }
  }
}
