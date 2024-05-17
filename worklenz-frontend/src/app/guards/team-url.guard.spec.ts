import {TestBed} from '@angular/core/testing';

import {TeamUrlGuard} from './team-url.guard';

describe('TeamUrlGuard', () => {
  let guard: TeamUrlGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    guard = TestBed.inject(TeamUrlGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });
});
