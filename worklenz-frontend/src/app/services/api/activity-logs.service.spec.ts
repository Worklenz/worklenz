import {TestBed} from '@angular/core/testing';

import {ActivityLogsService} from './activity-logs.service';

describe('ActivityLogsService', () => {
  let service: ActivityLogsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ActivityLogsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
