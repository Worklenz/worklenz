import {TestBed} from '@angular/core/testing';

import {GanttApiService} from './gantt-api.service';

describe('GanttApiService', () => {
  let service: GanttApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GanttApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
