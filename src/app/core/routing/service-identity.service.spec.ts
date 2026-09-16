import { DOCUMENT } from '@angular/common';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ServiceIdentityService, serviceFromUrl } from './service-identity.service';

@Component({ standalone: true, template: '' })
class EmptyPage {}

describe('Service identity', () => {
  it.each([
    ['/personal-workspace/knowledge/people/42', 'workspace'],
    ['/personal-workspace-other', 'site'],
    ['/admin-panel/team', 'admin'],
    ['/en/competency/articles/a', 'articles'],
    ['/ru/competency/matrix', 'matrix'],
    ['/ru/how-this-site-is-built', 'site'],
  ] as const)('identifies %s without crossing path boundaries', (url, expected) => {
    expect(serviceFromUrl(url)).toBe(expected);
  });
  it('updates the shared favicon when entering and leaving a service', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', component: EmptyPage }])],
    });
    const document = TestBed.inject(DOCUMENT);
    const icon = document.createElement('link');
    icon.id = 'service-favicon';
    icon.rel = 'icon';
    document.head.append(icon);
    TestBed.inject(ServiceIdentityService);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/admin-panel');
    TestBed.tick();
    expect(icon.getAttribute('href')).toBe('/brand/admin-frame-64.png');
    expect(icon.type).toBe('image/png');
    await router.navigateByUrl('/personal-workspace');
    TestBed.tick();
    expect(icon.getAttribute('href')).toBe('/brand/workspace-favicon.ico');
    expect(icon.type).toBe('image/x-icon');
    await router.navigateByUrl('/ru/how-this-site-is-built');
    TestBed.tick();
    expect(icon.getAttribute('href')).toBe('/favicon.ico');
    icon.remove();
  });
});
