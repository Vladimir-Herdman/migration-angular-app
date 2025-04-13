import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';

import { TabChatBotPage } from './tab_chatbot.page';

describe('TabChatBotPage', () => {
  let component: TabChatBotPage;
  let fixture: ComponentFixture<TabChatBotPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TabChatBotPage],
      imports: [IonicModule.forRoot(), ExploreContainerComponentModule]
    }).compileComponents();

    fixture = TestBed.createComponent(TabChatBotPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
