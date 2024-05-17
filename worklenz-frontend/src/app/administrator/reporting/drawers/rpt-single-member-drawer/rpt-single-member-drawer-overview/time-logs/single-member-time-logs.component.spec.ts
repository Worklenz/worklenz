import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SingleMemberTimeLogsComponent } from './single-member-time-logs.component';

describe('SingleMemberTimeLogsComponent', () => {
  let component: SingleMemberTimeLogsComponent;
  let fixture: ComponentFixture<SingleMemberTimeLogsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [SingleMemberTimeLogsComponent]
    });
    fixture = TestBed.createComponent(SingleMemberTimeLogsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
