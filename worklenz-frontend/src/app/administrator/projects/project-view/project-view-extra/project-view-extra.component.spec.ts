import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ProjectViewExtraComponent} from './project-view-extra.component';

describe('ProjectViewExtraComponent', () => {
  let component: ProjectViewExtraComponent;
  let fixture: ComponentFixture<ProjectViewExtraComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProjectViewExtraComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(ProjectViewExtraComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
