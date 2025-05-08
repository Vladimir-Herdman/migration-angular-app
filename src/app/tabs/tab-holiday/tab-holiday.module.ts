import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { TabHolidayPageRoutingModule } from './tab-holiday-routing.module';

import { TabHolidayPage } from './tab-holiday.page';

import { AccountButtonComponent } from 'src/app/components/account-button/account-button.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TabHolidayPageRoutingModule,
    AccountButtonComponent
  ],
  declarations: [TabHolidayPage]
})
export class TabHolidayPageModule {}
