import {TestBed} from '@angular/core/testing';

import {TeamMemberGuard} from './team-member.guard';

describe('TeamMemberGuard', () => {
  let guard: TeamMemberGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    guard = TestBed.inject(TeamMemberGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });
});
