import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MigrateMemberAllocationsComponent } from './migrate-member-allocations.component';

describe('MigrateMemberAllocationsComponent', () => {
  let component: MigrateMemberAllocationsComponent;
  let fixture: ComponentFixture<MigrateMemberAllocationsComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [MigrateMemberAllocationsComponent]
    });
    fixture = TestBed.createComponent(MigrateMemberAllocationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
