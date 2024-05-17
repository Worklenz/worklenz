import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemberTaskAddContainerComponent } from './member-task-add-container.component';

describe('MemberTaskAddContainerComponent', () => {
  let component: MemberTaskAddContainerComponent;
  let fixture: ComponentFixture<MemberTaskAddContainerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [MemberTaskAddContainerComponent]
    });
    fixture = TestBed.createComponent(MemberTaskAddContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
