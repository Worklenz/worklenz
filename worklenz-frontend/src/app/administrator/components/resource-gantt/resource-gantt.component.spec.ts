import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ResourceGanttComponent} from './resource-gantt.component';

describe('ResourceGanttComponent', () => {
  let component: ResourceGanttComponent;
  let fixture: ComponentFixture<ResourceGanttComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ResourceGanttComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(ResourceGanttComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
