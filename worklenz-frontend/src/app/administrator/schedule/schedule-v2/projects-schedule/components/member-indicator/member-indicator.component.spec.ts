import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemberIndicatorComponent } from './member-indicator.component';

describe('MemberIndicatorComponent', () => {
  let component: MemberIndicatorComponent;
  let fixture: ComponentFixture<MemberIndicatorComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [MemberIndicatorComponent]
    });
    fixture = TestBed.createComponent(MemberIndicatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
