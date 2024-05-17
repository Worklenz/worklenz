import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ProjectsListViewComponent} from './projects-list-view.component';

describe('ProjectsListViewComponent', () => {
  let component: ProjectsListViewComponent;
  let fixture: ComponentFixture<ProjectsListViewComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ProjectsListViewComponent]
    });
    fixture = TestBed.createComponent(ProjectsListViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
