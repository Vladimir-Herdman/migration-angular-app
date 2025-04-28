import { Component } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Auth } from '@angular/fire/auth';

@Component({
  selector: 'app-tab_account',
  templateUrl: 'tab_account.page.html',
  styleUrls: ['tab_account.page.scss'],
  standalone: false,
})
export class TabAccountPage {
  form: any = {
    info: {
      email: '',
      phone: ''
    },
    settings: {
      notifications: false
    }
  }

  constructor(
    private toastController: ToastController,
    private auth: Auth
  ) {}

  ionViewWillEnter() {
    const user = this.auth.currentUser;
    if (user) {
      this.form.info.email = user.email ?? '';
      this.form.info.phone = user.phoneNumber ?? '';
    }
  }

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
