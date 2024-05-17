import {ComponentFixture, TestBed} from '@angular/core/testing';

import {RptProjectDrawerTasksComponent} from './rpt-project-drawer-tasks.component';

describe('RptProjectDrawerTasksComponent', () => {
  let component: RptProjectDrawerTasksComponent;
  let fixture: ComponentFixture<RptProjectDrawerTasksComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptProjectDrawerTasksComponent]
    });
    fixture = TestBed.createComponent(RptProjectDrawerTasksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
