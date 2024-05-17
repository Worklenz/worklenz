import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorklenzTemplateListComponent } from './worklenz-template-list.component';

describe('WorklenzTemplateListComponent', () => {
  let component: WorklenzTemplateListComponent;
  let fixture: ComponentFixture<WorklenzTemplateListComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [WorklenzTemplateListComponent]
    });
    fixture = TestBed.createComponent(WorklenzTemplateListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
