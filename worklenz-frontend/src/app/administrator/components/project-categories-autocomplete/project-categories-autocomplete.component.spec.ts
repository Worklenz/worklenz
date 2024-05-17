import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ProjectCategoriesAutocompleteComponent} from './project-categories-autocomplete.component';

describe('ProjectCategoriesAutocompleteComponent', () => {
  let component: ProjectCategoriesAutocompleteComponent;
  let fixture: ComponentFixture<ProjectCategoriesAutocompleteComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProjectCategoriesAutocompleteComponent]
    });
    fixture = TestBed.createComponent(ProjectCategoriesAutocompleteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
