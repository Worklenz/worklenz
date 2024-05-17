import {TestBed} from '@angular/core/testing';

import {TeamOwnerOrAdminGuard} from './team-owner-or-admin-guard.service';

describe('TeamOwnerGuard', () => {
  let guard: TeamOwnerOrAdminGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    guard = TestBed.inject(TeamOwnerOrAdminGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });
});
