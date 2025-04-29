import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabChatBotPage } from './tab_chatbot.page';
import { ExploreContainerComponentModule } from '../../explore-container/explore-container.module';

import { AccountButtonComponent } from 'src/app/components/account-button/account-button.component';

import { TabChatBotPageRoutingModule } from './tab_chatbot-routing.module';
import { HttpClientModule } from '@angular/common/http';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    ExploreContainerComponentModule,
    AccountButtonComponent,
    TabChatBotPageRoutingModule,
    HttpClientModule
  ],
  declarations: [TabChatBotPage]
})
export class TabChatBotPageModule { }