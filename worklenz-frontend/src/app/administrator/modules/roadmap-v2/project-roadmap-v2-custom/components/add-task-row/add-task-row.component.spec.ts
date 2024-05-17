import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddTaskRowComponent } from './add-task-row.component';

describe('AddTaskRowComponent', () => {
  let component: AddTaskRowComponent;
  let fixture: ComponentFixture<AddTaskRowComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [AddTaskRowComponent]
    });
    fixture = TestBed.createComponent(AddTaskRowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
