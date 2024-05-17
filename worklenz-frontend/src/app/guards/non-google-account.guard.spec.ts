import {TestBed} from '@angular/core/testing';

import {NonGoogleAccountGuard} from './non-google-account.guard';

describe('NonGoogleAccountGuard', () => {
  let guard: NonGoogleAccountGuard;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    guard = TestBed.inject(NonGoogleAccountGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });
});
