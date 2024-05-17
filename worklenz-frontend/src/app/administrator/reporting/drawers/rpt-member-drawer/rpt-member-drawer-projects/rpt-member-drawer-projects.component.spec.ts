import {ComponentFixture, TestBed} from '@angular/core/testing';

import {RptMemberDrawerProjectsComponent} from './rpt-member-drawer-projects.component';

describe('RptMemberDrawerProjectsComponent', () => {
  let component: RptMemberDrawerProjectsComponent;
  let fixture: ComponentFixture<RptMemberDrawerProjectsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptMemberDrawerProjectsComponent]
    });
    fixture = TestBed.createComponent(RptMemberDrawerProjectsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
