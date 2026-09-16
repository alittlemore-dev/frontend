import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { workspaceRoutes } from './workspace.routes';
import { UnsavedChangesService } from '../../core/unsaved-changes/unsaved-changes.service';

@Component({ standalone: true, imports: [RouterOutlet], template: '<router-outlet />' })
class RouterHostComponent {}

@Component({ standalone: true, template: '' })
class EmptyRouteComponent {}

describe('workspaceRoutes', () => {
  let confirmDiscard: jest.Mock;
  let router: Router;

  beforeEach(() => {
    confirmDiscard = jest.fn(() => true);
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routesWithTestComponents()),
        {
          provide: UnsavedChangesService,
          useValue: { confirmDiscard },
        },
      ],
    });
    router = TestBed.inject(Router);
  });

  it('opens the dashboard directly at the workspace root', async () => {
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl('/personal-workspace');
    expect(router.url).toBe('/personal-workspace');
  });

  it('navigates to every retained knowledge and resume workspace', async () => {
    const harness = await RouterTestingHarness.create();
    const destinations = [
      '/personal-workspace/knowledge/people',
      '/personal-workspace/knowledge/people/person-1',
      '/personal-workspace/knowledge/dates',
      '/personal-workspace/knowledge/dates/date-1',
      '/personal-workspace/resumes',
      '/personal-workspace/resumes/resume-1',
    ];

    for (const destination of destinations) {
      await harness.navigateByUrl(destination);
      expect(router.url).toBe(destination);
    }
  });

  it('cancels navigation away from a retained workspace when discard is rejected', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/personal-workspace/knowledge/people');
    confirmDiscard.mockReturnValue(false);

    const navigated = await router.navigateByUrl('/personal-workspace/knowledge/dates');

    expect(navigated).toBe(false);
    expect(router.url).toBe('/personal-workspace/knowledge/people');
    expect(confirmDiscard).toHaveBeenCalledTimes(1);
  });
});

function routesWithTestComponents(): Routes {
  const workspaceRoute = workspaceRoutes[0];
  if (workspaceRoute === undefined) {
    throw new Error('Workspace route is missing.');
  }

  return [
    {
      path: 'personal-workspace',
      children: [
        {
          ...workspaceRoute,
          component: RouterHostComponent,
          loadComponent: undefined,
          children: (workspaceRoute.children ?? []).map((route) =>
            route.redirectTo === undefined
              ? { ...route, component: EmptyRouteComponent, loadComponent: undefined }
              : route,
          ),
        },
      ],
    },
  ];
}
