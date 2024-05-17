import {TestBed} from '@angular/core/testing';

import {LoginCheckGuard} from './login-check.guard';

describe('LoginCheckGuard', () => {
  let guard: LoginCheckGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    guard = TestBed.inject(LoginCheckGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });
});
