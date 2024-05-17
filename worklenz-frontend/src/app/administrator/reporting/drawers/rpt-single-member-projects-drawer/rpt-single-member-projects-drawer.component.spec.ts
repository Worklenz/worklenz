import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RptSingleMemberProjectsDrawerComponent } from './rpt-single-member-projects-drawer.component';

describe('RptSingleMemberProjectsDrawerComponent', () => {
  let component: RptSingleMemberProjectsDrawerComponent;
  let fixture: ComponentFixture<RptSingleMemberProjectsDrawerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptSingleMemberProjectsDrawerComponent]
    });
    fixture = TestBed.createComponent(RptSingleMemberProjectsDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
