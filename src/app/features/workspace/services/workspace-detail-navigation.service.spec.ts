import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { WorkspaceDetailNavigationService } from './workspace-detail-navigation.service';

@Component({ standalone: true, template: '' })
class DetailRouteComponent {}

describe('WorkspaceDetailNavigationService', () => {
  let router: Router;
  let canLeave: boolean;
  let navigation: WorkspaceDetailNavigationService;

  beforeEach(() => {
    canLeave = true;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'personal-workspace/knowledge/people/:id',
            component: DetailRouteComponent,
            canDeactivate: [() => canLeave],
          },
          { path: '**', component: DetailRouteComponent },
        ]),
      ],
    });
    router = TestBed.inject(Router);
    navigation = TestBed.inject(WorkspaceDetailNavigationService);
  });

  it('returns to the previous list with its filters and scroll anchor', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/personal-workspace/knowledge/people?search=Ivan#person-1');
    await harness.navigateByUrl('/personal-workspace/knowledge/people/person-1');

    navigation.back('/personal-workspace/knowledge/people');
    await harness.fixture.whenStable();

    expect(router.url).toBe('/personal-workspace/knowledge/people?search=Ivan#person-1');
  });

  it('returns from a linked date to the person that opened it', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/personal-workspace/knowledge/people/person-1');
    await harness.navigateByUrl('/personal-workspace/knowledge/dates/date-1');

    navigation.back('/personal-workspace/knowledge/dates');
    await harness.fixture.whenStable();

    expect(router.url).toBe('/personal-workspace/knowledge/people/person-1');
    navigation.back('/personal-workspace/knowledge/people');
    await harness.fixture.whenStable();
    expect(router.url).toBe('/personal-workspace/knowledge/people');
  });

  it.each([null, '/admin-panel', '/personal-workspace-other'])(
    'uses the owning list on direct entry or after %s',
    async (previous) => {
      const harness = await RouterTestingHarness.create();
      if (previous !== null) await harness.navigateByUrl(previous);
      await harness.navigateByUrl('/personal-workspace/resumes/resume-1?sort=updated');

      navigation.back('/personal-workspace/resumes');
      await harness.fixture.whenStable();

      expect(router.url).toBe('/personal-workspace/resumes?sort=updated');
    },
  );

  it('keeps the detail open when its unsaved-changes guard rejects leaving', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/personal-workspace');
    await harness.navigateByUrl('/personal-workspace/knowledge/people/person-1');
    canLeave = false;

    navigation.back('/personal-workspace/knowledge/people');
    await harness.fixture.whenStable();

    expect(router.url).toBe('/personal-workspace/knowledge/people/person-1');
  });
});
