import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TabChecklistPage } from './tab_checklist.page';
import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';

import { TabChecklistPageRoutingModule } from './tab_checklist-routing.module';
import { HttpClientModule } from '@angular/common/http';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    ExploreContainerComponentModule,
    TabChecklistPageRoutingModule,
    FormsModule,
    HttpClientModule
  ],
  declarations: [TabChecklistPage]
})
export class TabChecklistPageModule { }