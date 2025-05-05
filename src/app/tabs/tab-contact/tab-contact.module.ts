import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { TabContactPageRoutingModule } from './tab-contact-routing.module';

import { TabContactPage } from './tab-contact.page';

import { AccountButtonComponent } from 'src/app/components/account-button/account-button.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    TabContactPageRoutingModule,
    AccountButtonComponent
  ],
  declarations: [TabContactPage]
})
export class TabContactPageModule {}
