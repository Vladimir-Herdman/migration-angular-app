// src/app/tabs/tab_chatbot/tab_chatbot-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabChatBotPage } from './tab_chatbot.page';

const routes: Routes = [
  {
    path: '',
    component: TabChatBotPage,
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TabChatBotPageRoutingModule {}