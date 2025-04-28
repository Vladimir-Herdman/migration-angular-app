import { Component } from '@angular/core';
import { ToastController, AlertController } from '@ionic/angular';
import { Auth } from '@angular/fire/auth';

@Component({
  selector: 'app-account',
  templateUrl: 'account.page.html',
  styleUrls: ['account.page.scss'],
  standalone: false,
})
export class AccountPage {
  form: any = {
    info: {
      email: '',
      phone: ''
    },
    settings: {
      notifications: false
    }
  }
  oldForm: any = {};

  constructor(
    private toastController: ToastController,
    private alertController: AlertController,
    private auth: Auth
  ) {}

  ionViewWillEnter() {
    const user = this.auth.currentUser;
    if (user) {
      this.form.info.email = user.email ?? '';
      this.form.info.phone = user.phoneNumber ?? '';
      this.form.settings.notifications = false; // WIP: settings should push to DB
    }
    this.oldForm = JSON.parse(JSON.stringify(this.form));
  }

  async ionViewCanLeave() {
    if (JSON.stringify(this.form) != JSON.stringify(this.oldForm)) {
      return this.confirmLeave();
    }
    return true;
  }

  async submitForm() {
    console.log(this.form);
    this.oldForm = JSON.parse(JSON.stringify(this.form));
    const toast = await this.toastController.create({
      message: 'Account saved successfully!',
      duration: 2000,
      color: 'success',
      position: 'middle'
    });
    await toast.present();
  }

  async confirmLeave(): Promise<boolean> {
    return new Promise(async (resolve) => {
      const alert = await this.alertController.create({
        header: 'Unsaved Changes',
        message: 'You have unsaved changes. Are you sure you want to leave?',
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => {
              resolve(false);
            }
          },
          {
            text: 'Leave',
            role: 'confirm',
            handler: () => {
              resolve(true);
            }
          }
        ]
      });
  
      await alert.present();
    });
  }  
}
