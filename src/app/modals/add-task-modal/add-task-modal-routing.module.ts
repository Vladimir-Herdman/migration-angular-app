import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { AddTaskModalPage } from './add-task-modal.page';

const routes: Routes = [
  {
    path: '',
    component: AddTaskModalPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AddTaskModalPageRoutingModule {}
