import {TestBed} from '@angular/core/testing';

import {ProjectFoldersApiService} from './project-folders-api.service';

describe('ProjectFoldersApiService', () => {
  let service: ProjectFoldersApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProjectFoldersApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
