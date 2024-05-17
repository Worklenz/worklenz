import {TestBed} from '@angular/core/testing';

import {NotificationSettingsService} from './notification-settings.service';

describe('NotificationSettingsService', () => {
  let service: NotificationSettingsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationSettingsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
