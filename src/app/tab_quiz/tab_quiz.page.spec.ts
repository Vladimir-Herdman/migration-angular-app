import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';

import { TabQuizPage } from './tab_quiz.page';

describe('TabQuizPage', () => {
  let component: TabQuizPage;
  let fixture: ComponentFixture<TabQuizPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TabQuizPage],
      imports: [IonicModule.forRoot(), ExploreContainerComponentModule]
    }).compileComponents();

    fixture = TestBed.createComponent(TabQuizPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
