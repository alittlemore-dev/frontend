import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
  });

  it('adds success and error notifications', () => {
    service.success('Saved');
    service.error('Failed');

    expect(service.notifications()).toEqual([
      { id: 1, type: 'success', message: 'Saved' },
      { id: 2, type: 'danger', message: 'Failed' },
    ]);
  });

  it('dismisses notification by id with exit state before removal', fakeAsync(() => {
    service.success('Saved');
    service.error('Failed');

    service.dismiss(1);

    expect(service.notifications()).toEqual([
      { id: 1, type: 'success', message: 'Saved', dismissing: true },
      { id: 2, type: 'danger', message: 'Failed' },
    ]);

    tick(200);

    expect(service.notifications()).toEqual([{ id: 2, type: 'danger', message: 'Failed' }]);
  }));

  it('auto-dismisses success notifications after five seconds', fakeAsync(() => {
    service.success('Saved');

    tick(4999);
    expect(service.notifications()).toEqual([{ id: 1, type: 'success', message: 'Saved' }]);

    tick(1);
    expect(service.notifications()).toEqual([
      { id: 1, type: 'success', message: 'Saved', dismissing: true },
    ]);

    tick(200);
    expect(service.notifications()).toEqual([]);
  }));

  it('auto-dismisses error notifications after five seconds', fakeAsync(() => {
    service.error('Failed');

    tick(4999);
    expect(service.notifications()).toEqual([{ id: 1, type: 'danger', message: 'Failed' }]);

    tick(1);
    expect(service.notifications()).toEqual([
      { id: 1, type: 'danger', message: 'Failed', dismissing: true },
    ]);

    tick(200);
    expect(service.notifications()).toEqual([]);
  }));
});
