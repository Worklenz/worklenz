import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MigrateTemplatesComponent } from './migrate-templates.component';

describe('MigrateTemplatesComponent', () => {
  let component: MigrateTemplatesComponent;
  let fixture: ComponentFixture<MigrateTemplatesComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [MigrateTemplatesComponent]
    });
    fixture = TestBed.createComponent(MigrateTemplatesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
