import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { NavigationPreferencesService } from './navigation-preferences.service';

describe('NavigationPreferencesService', () => {
  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });
  it('persists independent choices for workspace and admin navigation', () => {
    const service = TestBed.inject(NavigationPreferencesService);
    service.setCollapsed('workspace', true);
    expect(service.collapsed('workspace')).toBe(true);
    expect(service.collapsed('admin')).toBe(false);
    service.setCollapsed('workspace', false);
    expect(service.collapsed('workspace')).toBe(false);
  });
  it('does not access storage on a server-like document', () => {
    const read = jest.spyOn(Storage.prototype, 'getItem');
    const write = jest.spyOn(Storage.prototype, 'setItem');
    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: { defaultView: null } }],
    });
    const service = TestBed.inject(NavigationPreferencesService);
    expect(service.collapsed('workspace')).toBe(false);
    service.setCollapsed('workspace', true);
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });
  it('remains usable when browser storage is denied', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Denied');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Denied');
    });
    const service = TestBed.inject(NavigationPreferencesService);
    expect(service.collapsed('admin')).toBe(false);
    expect(() => service.setCollapsed('admin', true)).not.toThrow();
  });
});
