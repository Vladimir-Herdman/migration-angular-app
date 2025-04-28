import { Component } from '@angular/core';
import { Location } from '@angular/common';
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
  user = this.auth.currentUser;

  constructor(
    private toastController: ToastController,
    private alertController: AlertController,
    private auth: Auth,
    private location: Location
  ) {}

  ionViewWillEnter() {
    if (this.user) {
      this.form.info.email = this.user.email ?? '';
      this.form.info.phone = this.user.phoneNumber ?? '';
      this.form.settings.notifications = false; // WIP: settings should push to DB
    }
    this.oldForm = JSON.parse(JSON.stringify(this.form));
  }


  async handleBack() {
    if (JSON.stringify(this.form) !== JSON.stringify(this.oldForm)) {
      const alert = await this.alertController.create({
        header: 'Unsaved Changes',
        message: 'You have unsaved changes. Are you sure you want to leave?',
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel'
          },
          {
            text: 'Leave',
            role: 'confirm',
            handler: () => {
              this.location.back(); // Go back if confirmed
            }
          }
        ]
      });
  
      await alert.present();
    } else {
      this.location.back(); // No unsaved changes, just go back
    }
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
}
