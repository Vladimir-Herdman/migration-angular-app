import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TabDashboardPage } from './tab-dashboard.page';

describe('TabDashboardPage', () => {
  let component: TabDashboardPage;
  let fixture: ComponentFixture<TabDashboardPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TabDashboardPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
