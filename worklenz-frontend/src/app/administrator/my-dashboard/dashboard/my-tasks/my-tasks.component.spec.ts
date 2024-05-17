import {ComponentFixture, TestBed} from '@angular/core/testing';

import {MyTasksComponent} from './my-tasks.component';

describe('MyTasksComponent', () => {
  let component: MyTasksComponent;
  let fixture: ComponentFixture<MyTasksComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MyTasksComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(MyTasksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
