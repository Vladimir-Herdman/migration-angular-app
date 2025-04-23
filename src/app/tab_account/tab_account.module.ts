import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabAccountPage } from './tab_account.page';
import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';

import { TabAccountPageRoutingModule } from './tab_account-routing.module';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    ExploreContainerComponentModule,
    TabAccountPageRoutingModule
  ],
  declarations: [TabAccountPage]
})
export class TabAccountPageModule {}
