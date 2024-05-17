import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TimeMembersComponent } from './time-members.component';

describe('TimeMembersComponent', () => {
  let component: TimeMembersComponent;
  let fixture: ComponentFixture<TimeMembersComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TimeMembersComponent]
    });
    fixture = TestBed.createComponent(TimeMembersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
