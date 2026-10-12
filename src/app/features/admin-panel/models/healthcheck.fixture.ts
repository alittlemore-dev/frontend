export function healthcheckDto(): Record<string, unknown> {
  return {
    schema_version: 1,
    checked_at: '2026-10-11T12:05:00Z',
    systems: [
      {
        id: 'backups',
        kind: 'backups',
        status: 'healthy',
        observed_at: '2026-10-11T12:04:00Z',
        backup: {
          last_attempt_at: '2026-10-11T12:00:00Z',
          last_success_at: '2026-10-11T12:04:00Z',
          next_due_at: '2026-10-11T18:00:00Z',
          freshness_threshold_seconds: 25200,
          run_state: 'idle',
          current_run: null,
          last_error: null,
          last_restore_verified_at: null,
          destinations: [
            {
              id: 'internal',
              required: true,
              last_success_at: '2026-10-11T12:04:00Z',
              pending_count: 0,
              delivery_gap_count: 0,
              last_error: null,
              cleanup_error: null,
              retained_sets: [
                {
                  run_id: 'fixture',
                  completed_at: '2026-10-11T12:04:00Z',
                  roles: ['latest', 'weekly_current'],
                  complete: true,
                  total_bytes: 1024,
                },
              ],
            },
          ],
        },
      },
    ],
  };
}

// Captured from the isolated backup → authenticated reader smoke.
export const backupSmokeDto: unknown = {
  schema_version: 1,
  checked_at: '2026-10-05T00:00:01Z',
  systems: [
    {
      id: 'backups',
      kind: 'backups',
      status: 'healthy',
      observed_at: '2026-10-05T00:00:01Z',
      backup: {
        schema_version: 1,
        generated_at: '2026-10-05T00:00:01Z',
        worker_heartbeat_at: '2026-10-05T00:00:01Z',
        last_attempt_at: '2026-10-05T00:00:01Z',
        last_success_at: '2026-10-05T00:00:01Z',
        next_due_at: '2026-10-05T06:00:01Z',
        last_restore_verified_at: null,
        freshness_threshold_seconds: 25200,
        heartbeat_threshold_seconds: 120,
        run_state: 'idle',
        current_run: null,
        last_error: null,
        sources: [
          {
            id: 'database-0',
            complete: true,
            error: null,
          },
          {
            id: 'database-1',
            complete: true,
            error: null,
          },
          {
            id: 'database-2',
            complete: true,
            error: null,
          },
          {
            id: 'cache-0',
            complete: true,
            error: null,
          },
          {
            id: 'cache-1',
            complete: true,
            error: null,
          },
          {
            id: 'cache-2',
            complete: true,
            error: null,
          },
          {
            id: 'cache-3',
            complete: true,
            error: null,
          },
          {
            id: 'media',
            complete: true,
            error: null,
          },
          {
            id: 'knowledge-private',
            complete: true,
            error: null,
          },
          {
            id: 'resume-private',
            complete: true,
            error: null,
          },
          {
            id: 'auth-avatars',
            complete: true,
            error: null,
          },
          {
            id: 'recovery',
            complete: true,
            error: null,
          },
        ],
        destinations: [
          {
            id: 'internal',
            required: true,
            retained_sets: [
              {
                run_id: '20260928T000000Z-06444e9cdcfb',
                roles: ['weekly_previous'],
                completed_at: '2026-09-28T00:00:00Z',
                total_bytes: 15968,
                complete: true,
              },
              {
                run_id: '20261005T000000Z-8dd8416b2454',
                roles: ['weekly_current'],
                completed_at: '2026-10-05T00:00:00Z',
                total_bytes: 15970,
                complete: true,
              },
              {
                run_id: '20261005T000001Z-931072c038e2',
                roles: ['latest'],
                completed_at: '2026-10-05T00:00:01Z',
                total_bytes: 15972,
                complete: true,
              },
            ],
            last_success_at: '2026-10-05T00:00:01Z',
            pending_count: 0,
            delivery_gap_count: 0,
            last_error: null,
            cleanup_error: null,
          },
          {
            id: 'external',
            required: false,
            retained_sets: [
              {
                run_id: '20260928T000000Z-06444e9cdcfb',
                roles: ['weekly_previous'],
                completed_at: '2026-09-28T00:00:00Z',
                total_bytes: 15968,
                complete: true,
              },
              {
                run_id: '20261005T000000Z-8dd8416b2454',
                roles: ['weekly_current'],
                completed_at: '2026-10-05T00:00:00Z',
                total_bytes: 15970,
                complete: true,
              },
              {
                run_id: '20261005T000001Z-931072c038e2',
                roles: ['latest'],
                completed_at: '2026-10-05T00:00:01Z',
                total_bytes: 15972,
                complete: true,
              },
            ],
            last_success_at: '2026-10-05T00:00:01Z',
            pending_count: 0,
            delivery_gap_count: 0,
            last_error: null,
            cleanup_error: null,
          },
        ],
      },
    },
  ],
};
