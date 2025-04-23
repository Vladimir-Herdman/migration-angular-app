import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabAccountPage } from './tab_account.page';

const routes: Routes = [
  {
    path: '',
    component: TabAccountPage,
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TabAccountPageRoutingModule {}
