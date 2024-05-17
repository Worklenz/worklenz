import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ProjectsFolderViewComponent} from './projects-folder-view.component';

describe('ProjectsFolderViewComponent', () => {
  let component: ProjectsFolderViewComponent;
  let fixture: ComponentFixture<ProjectsFolderViewComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ProjectsFolderViewComponent]
    });
    fixture = TestBed.createComponent(ProjectsFolderViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
