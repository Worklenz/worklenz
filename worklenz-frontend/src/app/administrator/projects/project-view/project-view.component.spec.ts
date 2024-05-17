import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ProjectViewComponent} from './project-view.component';

describe('ProjectViewComponent', () => {
  let component: ProjectViewComponent;
  let fixture: ComponentFixture<ProjectViewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProjectViewComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(ProjectViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
