import {ComponentFixture, TestBed} from '@angular/core/testing';

import {RptMemberDrawerComponent} from './rpt-member-drawer.component';

describe('RptMemberDrawerComponent', () => {
  let component: RptMemberDrawerComponent;
  let fixture: ComponentFixture<RptMemberDrawerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [RptMemberDrawerComponent]
    });
    fixture = TestBed.createComponent(RptMemberDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
