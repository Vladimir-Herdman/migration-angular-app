import { Component } from '@angular/core';
import { ToastController } from '@ionic/angular';

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
      partner: false,
      children: false,
      childrenAges: '',
      dependents: false,
      pets: false,
      petTypes: ''
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

  constructor(private toastController: ToastController) {}

  async submitForm() {
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
