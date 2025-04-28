import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabQuizPage } from './tab_quiz.page';

const routes: Routes = [
  {
    path: '',
    component: TabQuizPage,
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TabQuizPageRoutingModule {}
