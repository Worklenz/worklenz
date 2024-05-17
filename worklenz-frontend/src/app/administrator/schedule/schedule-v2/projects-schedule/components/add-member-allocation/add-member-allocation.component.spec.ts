import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddMemberAllocationComponent } from './add-member-allocation.component';

describe('AddMemberAllocationComponent', () => {
  let component: AddMemberAllocationComponent;
  let fixture: ComponentFixture<AddMemberAllocationComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [AddMemberAllocationComponent]
    });
    fixture = TestBed.createComponent(AddMemberAllocationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
