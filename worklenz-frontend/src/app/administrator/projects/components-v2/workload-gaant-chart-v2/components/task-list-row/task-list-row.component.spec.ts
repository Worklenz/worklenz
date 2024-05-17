import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WLTaskListRowComponent } from './task-list-row.component';

describe('TaskListRowComponent', () => {
  let component: WLTaskListRowComponent;
  let fixture: ComponentFixture<WLTaskListRowComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [WLTaskListRowComponent]
    });
    fixture = TestBed.createComponent(WLTaskListRowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
