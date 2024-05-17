import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MigrateProjectPhasesComponent } from './migrate-project-phases.component';

describe('MigrateProjectPhasesComponent', () => {
  let component: MigrateProjectPhasesComponent;
  let fixture: ComponentFixture<MigrateProjectPhasesComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [MigrateProjectPhasesComponent]
    });
    fixture = TestBed.createComponent(MigrateProjectPhasesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
