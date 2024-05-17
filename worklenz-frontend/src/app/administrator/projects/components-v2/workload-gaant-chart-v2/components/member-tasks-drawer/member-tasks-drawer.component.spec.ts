import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemberTasksDrawerComponent } from './member-tasks-drawer.component';

describe('MemberTasksDrawerComponent', () => {
  let component: MemberTasksDrawerComponent;
  let fixture: ComponentFixture<MemberTasksDrawerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [MemberTasksDrawerComponent]
    });
    fixture = TestBed.createComponent(MemberTasksDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
