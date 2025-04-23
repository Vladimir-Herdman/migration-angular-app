import { Component } from '@angular/core';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-tab_account',
  templateUrl: 'tab_account.page.html',
  styleUrls: ['tab_account.page.scss'],
  standalone: false,
})
export class TabAccountPage {
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
