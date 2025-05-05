import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { TabDashboardPageRoutingModule } from './tab_dashboard-routing.module';

import { TabDashboardPage } from './tab_dashboard.page';

import { AccountButtonComponent } from 'src/app/components/account-button/account-button.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TabDashboardPageRoutingModule,
    AccountButtonComponent
  ],
  declarations: [TabDashboardPage]
})
export class TabDashboardPageModule {}
