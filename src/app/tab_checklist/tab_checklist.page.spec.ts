import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';

import { TabChecklistPage } from './tab_checklist.page';

describe('TabChecklistPage', () => {
  let component: TabChecklistPage;
  let fixture: ComponentFixture<TabChecklistPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TabChecklistPage],
      imports: [IonicModule.forRoot(), ExploreContainerComponentModule]
    }).compileComponents();

    fixture = TestBed.createComponent(TabChecklistPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
