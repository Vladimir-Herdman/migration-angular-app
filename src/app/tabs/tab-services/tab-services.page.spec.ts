import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TabServicesPage } from './tab-services.page';

describe('TabServicesPage', () => {
  let component: TabServicesPage;
  let fixture: ComponentFixture<TabServicesPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TabServicesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
