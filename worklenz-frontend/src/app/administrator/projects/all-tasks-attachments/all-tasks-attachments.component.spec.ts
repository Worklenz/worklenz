import {ComponentFixture, TestBed} from '@angular/core/testing';

import {AllTasksAttachmentsComponent} from './all-tasks-attachments.component';

describe('AllTasksAttachmentsComponent', () => {
  let component: AllTasksAttachmentsComponent;
  let fixture: ComponentFixture<AllTasksAttachmentsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AllTasksAttachmentsComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(AllTasksAttachmentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
