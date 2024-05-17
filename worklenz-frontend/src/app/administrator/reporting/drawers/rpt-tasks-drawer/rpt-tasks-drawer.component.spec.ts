import {ComponentFixture, TestBed} from '@angular/core/testing';

import {RptTasksDrawerComponent} from './rpt-tasks-drawer.component';

describe('RptTasksDrawerComponent', () => {
  let component: RptTasksDrawerComponent;
  let fixture: ComponentFixture<RptTasksDrawerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptTasksDrawerComponent]
    });
    fixture = TestBed.createComponent(RptTasksDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
