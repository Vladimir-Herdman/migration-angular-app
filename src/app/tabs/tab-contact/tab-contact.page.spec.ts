import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TabContactPage } from './tab-contact.page';

describe('TabContactPage', () => {
  let component: TabContactPage;
  let fixture: ComponentFixture<TabContactPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TabContactPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
