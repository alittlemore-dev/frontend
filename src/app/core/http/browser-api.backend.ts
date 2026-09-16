import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { FetchBackend, HttpBackend, HttpEvent, HttpRequest } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable()
export class BrowserApiBackend implements HttpBackend {
  private readonly transport = inject(FetchBackend);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);

  handle(request: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    if (!isPlatformBrowser(this.platformId) || !request.url.startsWith('/api/')) {
      return this.transport.handle(request);
    }

    const explicitService = /^\/api\/(auth|personal-workspace|competency)(?:\/|\?|$)/.test(
      request.url,
    );
    const publicApiUrl = explicitService
      ? request.url
      : request.url.replace(/^\/api\//, '/api/competency/');
    return this.transport.handle(
      request.clone({ url: `${this.document.location.origin}${publicApiUrl}` }),
    );
  }
}
