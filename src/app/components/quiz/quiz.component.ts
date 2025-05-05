import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-quiz',
  templateUrl: './quiz.component.html',
  styleUrls: ['./quiz.component.scss'],
  imports: [CommonModule, IonicModule, FormsModule]
})
export class QuizComponent  implements OnInit {

  @Input() form: any;

  constructor() { }

  ngOnInit() {}

}
