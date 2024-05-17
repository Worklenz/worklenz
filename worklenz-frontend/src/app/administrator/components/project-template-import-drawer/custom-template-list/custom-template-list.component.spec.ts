import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomTemplateListComponent } from './custom-template-list.component';

describe('CustomTemplateListComponent', () => {
  let component: CustomTemplateListComponent;
  let fixture: ComponentFixture<CustomTemplateListComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CustomTemplateListComponent]
    });
    fixture = TestBed.createComponent(CustomTemplateListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
