import {ComponentFixture, TestBed} from '@angular/core/testing';

import {PersonalTodoListComponent} from './personal-todo-list.component';

describe('PersonalTodoListComponent', () => {
  let component: PersonalTodoListComponent;
  let fixture: ComponentFixture<PersonalTodoListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PersonalTodoListComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(PersonalTodoListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
