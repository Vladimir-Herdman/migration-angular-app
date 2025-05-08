import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TabHolidayPage } from './tab-holiday.page';

describe('TabHolidayPage', () => {
  let component: TabHolidayPage;
  let fixture: ComponentFixture<TabHolidayPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TabHolidayPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
