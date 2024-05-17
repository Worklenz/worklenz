import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RptMemberProjectsListComponent } from './rpt-member-projects-list.component';

describe('RptMemberProjectsListComponent', () => {
  let component: RptMemberProjectsListComponent;
  let fixture: ComponentFixture<RptMemberProjectsListComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptMemberProjectsListComponent]
    });
    fixture = TestBed.createComponent(RptMemberProjectsListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
