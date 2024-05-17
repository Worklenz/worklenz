import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RptSingleMemberDrawerComponent } from './rpt-single-member-drawer.component';

describe('RptSingleMemberDrawerComponent', () => {
  let component: RptSingleMemberDrawerComponent;
  let fixture: ComponentFixture<RptSingleMemberDrawerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptSingleMemberDrawerComponent]
    });
    fixture = TestBed.createComponent(RptSingleMemberDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
