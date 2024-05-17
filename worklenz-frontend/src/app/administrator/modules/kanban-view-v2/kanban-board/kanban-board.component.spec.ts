import {ComponentFixture, TestBed} from '@angular/core/testing';

import {KanbanBoardComponent} from './kanban-board.component';

describe('KanbanBoardComponent', () => {
  let component: KanbanBoardComponent;
  let fixture: ComponentFixture<KanbanBoardComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [KanbanBoardComponent]
    });
    fixture = TestBed.createComponent(KanbanBoardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
