import {TestBed} from '@angular/core/testing';

import {TeamNameGuard} from './team-name.guard';

describe('TeamNameGuard', () => {
  let guard: TeamNameGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    guard = TestBed.inject(TeamNameGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });
});
