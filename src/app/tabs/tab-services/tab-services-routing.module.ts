import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { TabServicesPage } from './tab-services.page';

const routes: Routes = [
  {
    path: '',
    component: TabServicesPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TabServicesPageRoutingModule {}
