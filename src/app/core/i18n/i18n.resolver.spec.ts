import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { I18nBundle } from './i18n.model';
import { i18nBundleResolver } from './i18n.resolver';
import { I18nService } from './i18n.service';

describe('i18nBundleResolver', () => {
  it('activates the route-owned bundle', () => {
    const activateBundle = jest.fn(() => of(void 0));
    TestBed.configureTestingModule({
      providers: [{ provide: I18nService, useValue: { activateBundle } }],
    });

    TestBed.runInInjectionContext(() =>
      i18nBundleResolver(I18nBundle.HowThisSiteIsBuilt)({} as never, {} as never),
    );

    expect(activateBundle).toHaveBeenCalledWith(I18nBundle.HowThisSiteIsBuilt);
  });
});
