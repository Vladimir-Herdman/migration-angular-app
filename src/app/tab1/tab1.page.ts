import { Component } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { FormDataService } from './form-data.service';


@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})

export class Tab1Page {
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

  constructor(private toastController: ToastController, private formDataService: FormDataService) {}

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
  }

}
