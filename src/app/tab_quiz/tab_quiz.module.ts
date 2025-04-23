import { IonicModule } from '@ionic/angular';
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TabQuizPage } from './tab_quiz.page';
import { ExploreContainerComponentModule } from '../explore-container/explore-container.module';

import { TabQuizPageRoutingModule } from './tab_quiz-routing.module';

@NgModule({
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    ExploreContainerComponentModule,
    TabQuizPageRoutingModule
  ],
  declarations: [TabQuizPage]
})
export class TabQuizPageModule {}
