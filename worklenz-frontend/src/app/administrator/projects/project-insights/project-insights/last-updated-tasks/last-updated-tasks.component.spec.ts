import {ComponentFixture, TestBed} from '@angular/core/testing';

import {LastUpdatedTasksComponent} from './last-updated-tasks.component';

describe('LastUpdatedTasksComponent', () => {
  let component: LastUpdatedTasksComponent;
  let fixture: ComponentFixture<LastUpdatedTasksComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [LastUpdatedTasksComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(LastUpdatedTasksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
