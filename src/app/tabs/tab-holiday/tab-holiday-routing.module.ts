import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { TabHolidayPage } from './tab-holiday.page';

const routes: Routes = [
  {
    path: '',
    component: TabHolidayPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TabHolidayPageRoutingModule {}
