import {ComponentFixture, TestBed} from '@angular/core/testing';

import {RptProjectDrawerMembersComponent} from './rpt-project-drawer-members.component';

describe('RptProjectDrawerMembersComponent', () => {
  let component: RptProjectDrawerMembersComponent;
  let fixture: ComponentFixture<RptProjectDrawerMembersComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptProjectDrawerMembersComponent]
    });
    fixture = TestBed.createComponent(RptProjectDrawerMembersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
