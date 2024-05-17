import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ProjectFoldersAutocompleteComponent} from './project-folders-autocomplete.component';

describe('ProjectFoldersAutocompleteComponent', () => {
  let component: ProjectFoldersAutocompleteComponent;
  let fixture: ComponentFixture<ProjectFoldersAutocompleteComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProjectFoldersAutocompleteComponent]
    });
    fixture = TestBed.createComponent(ProjectFoldersAutocompleteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
