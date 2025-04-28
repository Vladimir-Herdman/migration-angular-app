import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'tab_quiz',
        loadChildren: () => import('./tab_quiz/tab_quiz.module').then(m => m.TabQuizPageModule)
      },
      {
        path: 'tab_checklist',
        loadChildren: () => import('./tab_checklist/tab_checklist.module').then(m => m.TabChecklistPageModule)
      },
      {
        path: 'tab_chatbot',
        loadChildren: () => import('./tab_chatbot/tab_chatbot.module').then(m => m.TabChatBotPageModule)
      },
      {
        path: '',
        redirectTo: 'tab_quiz',
        pathMatch: 'full'
      }
    ]
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TabsPageRoutingModule {}
