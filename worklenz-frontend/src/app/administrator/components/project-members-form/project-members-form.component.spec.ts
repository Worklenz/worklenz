import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ProjectMembersFormComponent} from './project-members-form.component';

describe('ProjectMembersFormComponent', () => {
  let component: ProjectMembersFormComponent;
  let fixture: ComponentFixture<ProjectMembersFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ProjectMembersFormComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(ProjectMembersFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
