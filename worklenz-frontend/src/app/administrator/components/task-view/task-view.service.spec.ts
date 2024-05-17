import {TestBed} from '@angular/core/testing';

import {TaskViewService} from './task-view.service';

describe('TaskViewService', () => {
  let service: TaskViewService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TaskViewService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
