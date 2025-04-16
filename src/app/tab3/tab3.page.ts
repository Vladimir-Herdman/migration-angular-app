import { Component } from '@angular/core';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: false,
})
export class Tab3Page {
  form: any = {
    info: {
      name: '',
      email: '',
      phone: ''
    },
    settings: {
      notifications: false
    }
  }

  constructor(private toastController: ToastController) {}

  async submitForm() {
    console.log(this.form);
    const toast = await this.toastController.create({
      message: 'Account saved successfully!',
      duration: 2000,
      color: 'success',
      position: 'middle'
    });
    await toast.present();
  }
}
