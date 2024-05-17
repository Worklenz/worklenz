import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TemplateNameComponent } from './template-name.component';

describe('TemplateNameComponent', () => {
  let component: TemplateNameComponent;
  let fixture: ComponentFixture<TemplateNameComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [TemplateNameComponent]
    });
    fixture = TestBed.createComponent(TemplateNameComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
