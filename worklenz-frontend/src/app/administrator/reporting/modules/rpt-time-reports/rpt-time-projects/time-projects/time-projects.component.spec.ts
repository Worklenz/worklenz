import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TimeProjectsComponent } from './time-projects.component';

describe('TimeProjectsComponent', () => {
  let component: TimeProjectsComponent;
  let fixture: ComponentFixture<TimeProjectsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TimeProjectsComponent]
    });
    fixture = TestBed.createComponent(TimeProjectsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
