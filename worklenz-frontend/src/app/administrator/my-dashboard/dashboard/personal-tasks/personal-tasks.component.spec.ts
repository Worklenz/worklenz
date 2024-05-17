import {ComponentFixture, TestBed} from '@angular/core/testing';

import {PersonalTasksComponent} from './personal-tasks.component';

describe('PersonalTasksComponent', () => {
  let component: PersonalTasksComponent;
  let fixture: ComponentFixture<PersonalTasksComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [PersonalTasksComponent]
    });
    fixture = TestBed.createComponent(PersonalTasksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
