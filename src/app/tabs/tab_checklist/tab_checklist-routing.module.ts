import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabChecklistPage } from './tab_checklist.page';

const routes: Routes = [
  {
    path: '',
    component: TabChecklistPage,
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TabChecklistPageRoutingModule {}
