import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiClient } from '../../../core/http/api-client.service';
import { HealthcheckService } from './healthcheck.service';

import { healthcheckDto } from '../models/healthcheck.fixture';

describe('HealthcheckService', () => {
  let service: HealthcheckService;
  let get: jest.Mock;

  beforeEach(() => {
    get = jest.fn(() => of(healthcheckDto()));
    TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: { get } }] });
    service = TestBed.inject(HealthcheckService);
  });

  it('requests the protected same-origin endpoint and maps snake_case details', () => {
    service.getHealthcheck().subscribe((overview) => {
      expect(overview.checkedAt).toBe('2026-10-11T12:05:00Z');
      expect(overview.systems[0].backup?.lastSuccessAt).toBe('2026-10-11T12:04:00Z');
      expect(overview.systems[0].backup?.destinations[0].retainedSets).toEqual([
        {
          runId: 'fixture',
          completedAt: '2026-10-11T12:04:00Z',
          roles: ['latest', 'weekly_current'],
          totalBytes: 1024,
        },
      ]);
    });
    expect(get).toHaveBeenCalledWith('/api/infra/healthcheck');
  });

  it.each([
    { schema_version: 2 },
    {
      systems: [
        { id: 'backups', kind: 'unknown', status: 'healthy', backup: null, observed_at: null },
      ],
    },
    {
      systems: [
        { id: 'backups', kind: 'backups', status: 'unknown', backup: null, observed_at: null },
      ],
    },
    { checked_at: 'yesterday' },
  ])('rejects an unsupported or invalid response', (override) => {
    get.mockReturnValue(of({ ...healthcheckDto(), ...override }));
    const error = jest.fn();
    const next = jest.fn();
    service.getHealthcheck().subscribe({ next, error });
    expect(next).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
  });

  it('maps an initializing reader with no projection without pretending it is healthy', () => {
    get.mockReturnValue(
      of({
        ...healthcheckDto(),
        systems: [
          {
            id: 'backups',
            kind: 'backups',
            status: 'initializing',
            backup: null,
            observed_at: null,
          },
        ],
      }),
    );
    service.getHealthcheck().subscribe((overview) => {
      expect(overview.systems[0].status).toBe('initializing');
      expect(overview.systems[0].backup).toBeNull();
    });
  });
});
