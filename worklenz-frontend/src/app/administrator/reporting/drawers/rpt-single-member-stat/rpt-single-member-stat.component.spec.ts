import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RptSingleMemberStatComponent } from './rpt-single-member-stat.component';

describe('RptSingleMemberStatComponent', () => {
  let component: RptSingleMemberStatComponent;
  let fixture: ComponentFixture<RptSingleMemberStatComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptSingleMemberStatComponent]
    });
    fixture = TestBed.createComponent(RptSingleMemberStatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
