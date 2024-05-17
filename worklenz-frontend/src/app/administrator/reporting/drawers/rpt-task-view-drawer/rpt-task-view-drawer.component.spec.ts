import {ComponentFixture, TestBed} from '@angular/core/testing';

import {RptTaskViewDrawerComponent} from './rpt-task-view-drawer.component';

describe('RptTaskViewDrawerComponent', () => {
  let component: RptTaskViewDrawerComponent;
  let fixture: ComponentFixture<RptTaskViewDrawerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptTaskViewDrawerComponent]
    });
    fixture = TestBed.createComponent(RptTaskViewDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
