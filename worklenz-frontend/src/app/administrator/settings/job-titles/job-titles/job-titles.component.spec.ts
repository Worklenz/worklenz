import {ComponentFixture, TestBed} from '@angular/core/testing';

import {JobTitlesComponent} from './job-titles.component';

describe('JobTitlesComponent', () => {
  let component: JobTitlesComponent;
  let fixture: ComponentFixture<JobTitlesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [JobTitlesComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(JobTitlesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
