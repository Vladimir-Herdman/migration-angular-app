import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { FormDataService } from '../../components/quiz/form-data.service';
import { CountrySelectComponent } from '@wlucha/ng-country-select';

@Component({
  selector: 'app-quiz',
  templateUrl: './quiz.component.html',
  styleUrls: ['./quiz.component.scss'],
  imports: [CommonModule, IonicModule, FormsModule, CountrySelectComponent]
})
export class QuizComponent  implements OnInit {

  @Input() form: any;

  constructor(private formDataService: FormDataService) { }

  ngOnInit() {}

  async updateForm() {
    this.form = (await this.formDataService.getForm()) ?? this.formDataService.getDefaultForm(); // If first time, use the default empty form
    return this.form;
  }

  public handleSelection(event: any) {
      const country = event.translations.en;
      this.form.destination = country;
  }

}
