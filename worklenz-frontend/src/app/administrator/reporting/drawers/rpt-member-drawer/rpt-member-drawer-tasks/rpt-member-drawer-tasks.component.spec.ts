import {ComponentFixture, TestBed} from '@angular/core/testing';

import {RptMemberDrawerTasksComponent} from './rpt-member-drawer-tasks.component';

describe('RptMemberDrawerTasksComponent', () => {
  let component: RptMemberDrawerTasksComponent;
  let fixture: ComponentFixture<RptMemberDrawerTasksComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptMemberDrawerTasksComponent]
    });
    fixture = TestBed.createComponent(RptMemberDrawerTasksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
