import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ProjectsAutocompleteComponent} from './projects-autocomplete.component';

describe('ProjectsAutocompleteComponent', () => {
  let component: ProjectsAutocompleteComponent;
  let fixture: ComponentFixture<ProjectsAutocompleteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProjectsAutocompleteComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(ProjectsAutocompleteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
