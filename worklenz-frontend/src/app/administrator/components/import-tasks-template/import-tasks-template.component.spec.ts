import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ImportTasksTemplateComponent} from './import-tasks-template.component';

describe('ImportTasksTemplateComponent', () => {
  let component: ImportTasksTemplateComponent;
  let fixture: ComponentFixture<ImportTasksTemplateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ImportTasksTemplateComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(ImportTasksTemplateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
