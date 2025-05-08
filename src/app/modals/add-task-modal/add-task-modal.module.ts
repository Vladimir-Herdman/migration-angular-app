import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { AddTaskModalPageRoutingModule } from './add-task-modal-routing.module';

import { AddTaskModalPage } from './add-task-modal.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    AddTaskModalPageRoutingModule
  ],
})
export class AddTaskModalPageModule {}
