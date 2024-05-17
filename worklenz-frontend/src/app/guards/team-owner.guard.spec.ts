import {TestBed} from '@angular/core/testing';

import {TeamOwnerGuard} from './team-owner.guard';

describe('TeamOwnerGuard', () => {
  let guard: TeamOwnerGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    guard = TestBed.inject(TeamOwnerGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });
});
