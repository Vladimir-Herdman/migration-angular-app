// src/app/tabs/tab_checklist/tab_checklist.module.ts
import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
// TabChecklistPage is now standalone, remove from declarations
// import { TabChecklistPage } from './tab_checklist.page';
import { ExploreContainerComponentModule } from '../../explore-container/explore-container.module';
import { AccountButtonComponent } from 'src/app/components/account-button/account-button.component';
import { TabChecklistPageRoutingModule } from './tab_checklist-routing.module';
import { HttpClientModule } from '@angular/common/http';

@NgModule({
  imports: [
    IonicModule,
    // CommonModule, FormsModule, HttpClientModule are likely imported by the standalone page now
    ExploreContainerComponentModule, // Keep if used via module
    AccountButtonComponent, // Keep if used via module (ensure standalone/declared correctly)
    TabChecklistPageRoutingModule
  ],
  declarations: [ /* TabChecklistPage REMOVED FROM HERE */ ]
})
export class TabChecklistPageModule { }