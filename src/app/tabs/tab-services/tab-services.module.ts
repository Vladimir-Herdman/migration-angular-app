import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { TabServicesPageRoutingModule } from './tab-services-routing.module';

import { TabServicesPage } from './tab-services.page';

import { AccountButtonComponent } from 'src/app/components/account-button/account-button.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TabServicesPageRoutingModule,
    AccountButtonComponent
  ],
  declarations: [TabServicesPage]
})
export class TabServicesPageModule {}
