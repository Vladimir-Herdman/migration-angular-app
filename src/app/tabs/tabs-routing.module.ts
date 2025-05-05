import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'tab_dashboard',
        loadChildren: () => import('./tab_dashboard/tab_dashboard.module').then( m => m.TabDashboardPageModule)
      },
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
        path: 'tab-services',
        loadChildren: () => import('./tab-services/tab-services.module').then( m => m.TabServicesPageModule)
      },
      {
        path: 'tab-holiday',
        loadChildren: () => import('./tab-holiday/tab-holiday.module').then( m => m.TabHolidayPageModule)
      },
      {
        path: 'tab-contact',
        loadChildren: () => import('./tab-contact/tab-contact.module').then( m => m.TabContactPageModule)
      },
      {
        path: '',
        redirectTo: 'tab_dashboard',
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
