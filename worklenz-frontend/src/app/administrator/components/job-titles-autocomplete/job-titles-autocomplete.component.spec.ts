import {ComponentFixture, TestBed} from '@angular/core/testing';

import {JobTitlesAutocompleteComponent} from './job-titles-autocomplete.component';

describe('JobTitlesAutocompleteComponent', () => {
  let component: JobTitlesAutocompleteComponent;
  let fixture: ComponentFixture<JobTitlesAutocompleteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [JobTitlesAutocompleteComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(JobTitlesAutocompleteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
