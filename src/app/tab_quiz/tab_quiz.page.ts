import { Component } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { FormDataService } from './form-data.service';
import { Router } from '@angular/router';


@Component({
  selector: 'app-tab_quiz',
  templateUrl: 'tab_quiz.page.html',
  styleUrls: ['tab_quiz.page.scss'],
  standalone: false,
})

export class TabQuizPage {
  form: any = {
    moveType: '',
    destination: '',
    moveDate: '',
    hasHousing: false,
    family: {
      children: false,
      pets: false,
    },
    vehicle: '',
    currentHousing: '',
    newHousing: '',
    services: {
      internet: false,
      utilities: false,
      healthInsurance: false,
      homeInsurance: false,
      carInsurance: false
    },
    hasJob: false
  };

  constructor(private toastController: ToastController, private formDataService: FormDataService, private router: Router) {}

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
