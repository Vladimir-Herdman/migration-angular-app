import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TabAccountPage } from './tab_account.page';

describe('TabAccountPage', () => {
  let component: TabAccountPage;
  let fixture: ComponentFixture<TabAccountPage>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(TabAccountPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
