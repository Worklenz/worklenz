import {ComponentFixture, TestBed} from '@angular/core/testing';

import {RptGroupedTaskListComponent} from './rpt-grouped-task-list.component';

describe('RptGroupedTaskListComponent', () => {
  let component: RptGroupedTaskListComponent;
  let fixture: ComponentFixture<RptGroupedTaskListComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptGroupedTaskListComponent]
    });
    fixture = TestBed.createComponent(RptGroupedTaskListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
