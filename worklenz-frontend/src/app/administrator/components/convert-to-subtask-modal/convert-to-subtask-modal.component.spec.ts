import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ConvertToSubtaskModalComponent} from './convert-to-subtask-modal.component';

describe('ConvertToSubtaskModalComponent', () => {
  let component: ConvertToSubtaskModalComponent;
  let fixture: ComponentFixture<ConvertToSubtaskModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ConvertToSubtaskModalComponent]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ConvertToSubtaskModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
