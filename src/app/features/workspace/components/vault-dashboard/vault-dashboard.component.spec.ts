import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { AccountSettingsService } from '../../../../core/auth/account-settings.service';
import { provideI18nTesting } from '../../../../testing/i18n-testing';
import { VaultRecent, VaultStatistics } from '../../models/vault.model';
import { VaultService } from '../../services/vault.service';
import { VaultDashboardComponent } from './vault-dashboard.component';

describe('VaultDashboardComponent', () => {
  const zero: VaultStatistics = {
    totalCount: 0,
    knowledgeCount: 0,
    resumeCount: 0,
    byKind: [],
    createdLast30DaysCount: 0,
    createdOrUpdatedLast30DaysCount: 0,
  };
  const service = { recent: jest.fn(), statistics: jest.fn() };
  beforeEach(() => {
    service.recent.mockReset().mockReturnValue(of({ items: [] }));
    service.statistics.mockReset().mockReturnValue(of(zero));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideI18nTesting({
          'workspaceDashboard.vault.kind.person': 'Люди',
          'workspaceDashboard.vault.kind.date': 'Памятные даты',
        }),
        { provide: VaultService, useValue: service },
        { provide: AccountSettingsService, useValue: { timeZone: signal('Asia/Yerevan') } },
      ],
    });
  });

  function create() {
    const fixture = TestBed.createComponent(VaultDashboardComponent);
    fixture.componentRef.setInput('recentExpanded', false);
    fixture.componentRef.setInput('statisticsExpanded', false);
    fixture.componentRef.setInput('refreshVersion', 0);
    fixture.detectChanges();
    return fixture;
  }

  it('loads each section on first expansion, preserves data on collapse and refreshes independently', () => {
    const fixture = create();
    expect(service.recent).not.toHaveBeenCalled();
    expect(service.statistics).not.toHaveBeenCalled();
    fixture.componentRef.setInput('recentExpanded', true);
    fixture.detectChanges();
    expect(service.recent).toHaveBeenCalledTimes(1);
    expect(service.statistics).not.toHaveBeenCalled();
    fixture.componentRef.setInput('recentExpanded', false);
    fixture.detectChanges();
    fixture.componentRef.setInput('recentExpanded', true);
    fixture.componentRef.setInput('statisticsExpanded', true);
    fixture.detectChanges();
    expect(service.recent).toHaveBeenCalledTimes(1);
    expect(service.statistics).toHaveBeenCalledTimes(1);
    expect(
      fixture.nativeElement.querySelectorAll('[data-testid="vault-statistics"] dd').length,
    ).toBe(5);
    fixture.componentRef.setInput('refreshVersion', 1);
    fixture.detectChanges();
    expect(service.recent).toHaveBeenCalledTimes(2);
    expect(service.statistics).toHaveBeenCalledTimes(2);
  });

  it('renders the newest eight links in reading order and formats the user time zone', () => {
    const items = Array.from({ length: 9 }, (_, index) => ({
      id: String(index),
      source: index === 0 ? 'resume' : 'knowledge',
      kind: index === 0 ? 'resume' : index === 1 ? 'date' : 'person',
      displayName: `Entry ${index}`,
      updatedAt: '2026-10-03T00:00:00Z',
    }));
    service.recent.mockReturnValue(of({ items }));
    const fixture = create();
    fixture.componentRef.setInput('recentExpanded', true);
    fixture.detectChanges();
    const links: HTMLAnchorElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="vault-recent"] a'),
    );
    expect(links.map((link) => link.querySelector('.fw-semibold')?.textContent?.trim())).toEqual(
      Array.from({ length: 8 }, (_, index) => `Entry ${index}`),
    );
    expect(links.slice(0, 3).map((link) => link.getAttribute('href'))).toEqual([
      '/personal-workspace/resumes/0',
      '/personal-workspace/knowledge/dates/1',
      '/personal-workspace/knowledge/people/2',
    ]);
    expect(fixture.nativeElement.querySelector('time').textContent).toContain('04:00');
  });

  it('keeps loading and retry states independent and ignores stale responses', () => {
    const first = new Subject<VaultRecent>();
    const second = new Subject<VaultRecent>();
    const statistics = new Subject<VaultStatistics>();
    service.recent
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second)
      .mockReturnValue(of({ items: [] }));
    service.statistics.mockReturnValue(statistics);
    const fixture = create();
    fixture.componentRef.setInput('recentExpanded', true);
    fixture.componentRef.setInput('statisticsExpanded', true);
    fixture.detectChanges();
    fixture.componentInstance.loadRecent();
    first.next({
      items: [
        {
          id: 'stale',
          source: 'resume',
          kind: 'resume',
          displayName: 'stale',
          updatedAt: '2026-10-03T00:00:00Z',
        },
      ],
    });
    expect(fixture.componentInstance.items()).toEqual([]);
    second.error({ message: 'failed' });
    expect(fixture.componentInstance.recentError()).toEqual({ message: 'failed' });
    expect(fixture.componentInstance.statisticsLoading()).toBe(true);
    fixture.componentInstance.loadRecent();
    expect(fixture.componentInstance.recentError()).toBeNull();
    statistics.next(zero);
    expect(fixture.componentInstance.statistics()).toEqual(zero);
  });

  it('pairs the storage totals, type breakdown and activity with their labels', () => {
    service.statistics.mockReturnValue(
      of({
        totalCount: 12,
        knowledgeCount: 9,
        resumeCount: 3,
        byKind: [
          { source: 'knowledge', kind: 'person', totalCount: 5 },
          { source: 'knowledge', kind: 'date', totalCount: 4 },
          { source: 'resume', kind: 'resume', totalCount: 3 },
        ],
        createdLast30DaysCount: 2,
        createdOrUpdatedLast30DaysCount: 7,
      }),
    );
    const fixture = create();
    fixture.componentRef.setInput('statisticsExpanded', true);
    fixture.detectChanges();
    const labels: HTMLElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('[data-testid="vault-statistics"] dt'),
    );
    expect(
      Object.fromEntries(
        labels.map((label) => [
          label.textContent?.trim(),
          label.nextElementSibling?.textContent?.trim(),
        ]),
      ),
    ).toEqual({
      'workspaceDashboard.vault.statistics.total': '12',
      'workspaceDashboard.vault.statistics.knowledge': '9',
      'workspaceDashboard.vault.kind.resume': '3',
      Люди: '5',
      'Памятные даты': '4',
      'workspaceDashboard.vault.statistics.created': '2',
      'workspaceDashboard.vault.statistics.active': '7',
    });
  });
});
