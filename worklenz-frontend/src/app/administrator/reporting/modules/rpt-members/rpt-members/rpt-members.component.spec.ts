import {ComponentFixture, TestBed} from '@angular/core/testing';

import {RptMembersComponent} from './rpt-members.component';

describe('RptMembersComponent', () => {
  let component: RptMembersComponent;
  let fixture: ComponentFixture<RptMembersComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptMembersComponent]
    });
    fixture = TestBed.createComponent(RptMembersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
