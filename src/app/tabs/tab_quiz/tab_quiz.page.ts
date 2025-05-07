import { Component, ViewChild } from '@angular/core';
import { ToastController, ViewWillEnter } from '@ionic/angular';
import { FormDataService } from '../../components/quiz/form-data.service';
import { QuizComponent } from 'src/app/components/quiz/quiz.component';
import { Router } from '@angular/router';


@Component({
  selector: 'app-tab_quiz',
  templateUrl: 'tab_quiz.page.html',
  styleUrls: ['tab_quiz.page.scss'],
  standalone: false,
})

export class TabQuizPage implements ViewWillEnter {
  @ViewChild(QuizComponent)
  quizComponent!: QuizComponent;
  form = this.formDataService.getDefaultForm();

  constructor(private toastController: ToastController, private formDataService: FormDataService, private router: Router) {}

  async ionViewWillEnter() {
    this.form = await this.quizComponent.updateForm();
  }

  async submitForm() {
    await this.formDataService.setForm(this.form);

    console.log(this.form);
    const toast = await this.toastController.create({
      message: 'Answers saved successfully!',
      duration: 2000,
      color: 'success',
      position: 'middle'
    });
    await toast.present();
    
    this.router.navigateByUrl('/tabs/tab_checklist', { replaceUrl: true });
  }

}
