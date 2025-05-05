import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AccountPage } from './account.page';

import { QuizComponent } from 'src/app/components/quiz/quiz.component';

import { AccountPageRoutingModule } from './account-routing.module';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    QuizComponent,
    AccountPageRoutingModule,
  ],
  declarations: [AccountPage]
})
export class AccountPageModule {}
