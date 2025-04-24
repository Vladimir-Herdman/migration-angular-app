import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabChatBotPage } from './tab_chatbot.page';
import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';

import { TabChatBotPageRoutingModule } from './tab_chatbot-routing.module';
import { HttpClientModule } from '@angular/common/http';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    ExploreContainerComponentModule,
    TabChatBotPageRoutingModule,
    HttpClientModule
  ],
  declarations: [TabChatBotPage]
})
export class TabChatBotPageModule { }