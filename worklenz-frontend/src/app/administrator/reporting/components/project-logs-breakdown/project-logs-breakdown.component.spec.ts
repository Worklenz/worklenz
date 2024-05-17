import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectLogsBreakdownComponent } from './project-logs-breakdown.component';

describe('ProjectLogsBreakdownComponent', () => {
  let component: ProjectLogsBreakdownComponent;
  let fixture: ComponentFixture<ProjectLogsBreakdownComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ProjectLogsBreakdownComponent]
    });
    fixture = TestBed.createComponent(ProjectLogsBreakdownComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
