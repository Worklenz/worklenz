import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemberLogsBreakdownComponent } from './member-logs-breakdown.component';

describe('MemberLogsBreakdownComponent', () => {
  let component: MemberLogsBreakdownComponent;
  let fixture: ComponentFixture<MemberLogsBreakdownComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [MemberLogsBreakdownComponent]
    });
    fixture = TestBed.createComponent(MemberLogsBreakdownComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
