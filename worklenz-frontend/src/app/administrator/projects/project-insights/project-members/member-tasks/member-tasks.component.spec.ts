import {ComponentFixture, TestBed} from '@angular/core/testing';

import {MemberTasksComponent} from './member-tasks.component';

describe('MemberTasksComponent', () => {
  let component: MemberTasksComponent;
  let fixture: ComponentFixture<MemberTasksComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MemberTasksComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(MemberTasksComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
