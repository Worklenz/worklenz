import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ProjectsFolderFormDrawerComponent} from './projects-folder-form-drawer.component';

describe('ProjectsFolderFormDrawerComponent', () => {
  let component: ProjectsFolderFormDrawerComponent;
  let fixture: ComponentFixture<ProjectsFolderFormDrawerComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [ProjectsFolderFormDrawerComponent]
    });
    fixture = TestBed.createComponent(ProjectsFolderFormDrawerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
