import {TestBed} from '@angular/core/testing';

import {ProjectCategoriesApiService} from './project-categories-api.service';

describe('ProjectCategoriesService', () => {
  let service: ProjectCategoriesApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ProjectCategoriesApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
