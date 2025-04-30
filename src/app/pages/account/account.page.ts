import { Component } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { ToastController, AlertController } from '@ionic/angular';
import { Auth, onAuthStateChanged, deleteUser } from '@angular/fire/auth';
import { EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail } from 'firebase/auth';

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
  user: any = null;

  constructor(
    private toastController: ToastController,
    private alertController: AlertController,
    private auth: Auth,
    private location: Location,
    private router: Router
  ) {}

  authUnsubscribe: (() => void) | null = null;

  ionViewWillEnter() {
    this.authUnsubscribe = onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.user = user;
        this.form.info.email = user.email ?? '';
        this.form.settings.notifications = false; // WIP: settings should push to DB
      }
      this.oldForm = JSON.parse(JSON.stringify(this.form));
    });
  }
  
  ionViewWillLeave() {
    if (this.authUnsubscribe) {
      this.authUnsubscribe();
      this.authUnsubscribe = null;
    }
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

  async showToast(message: string, color: string = 'success') {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: 'top'
    });
    await toast.present();
  }  

  async submitForm() {
    console.log(this.form);

    if (this.form.info.email !== this.oldForm.info.email) {
      await this.changeEmail(this.form.info.email);
      return;
    }

    this.oldForm = JSON.parse(JSON.stringify(this.form));
    this.showToast('Account saved successfully!');
  }

  async changeEmail(newEmail: string) {
    if (!this.user || !this.user.email) {
      this.showToast('No user is signed in.', 'danger');
      return;
    }

    const alert = await this.alertController.create({
      header: 'Re-authentication Required',
      inputs: [
        {
          name: 'password',
          type: 'password',
          placeholder: 'Enter your current password'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Confirm',
          handler: async (data) => {
            const password = data.password;
  
            if (!password) {
              this.showToast('Password is required.', 'danger');
              return false;
            }
  
            try {
              const credential = EmailAuthProvider.credential(this.user.email, password);
              await reauthenticateWithCredential(this.user, credential);
              await verifyBeforeUpdateEmail(this.user, newEmail);
            
              this.showToast('Verification email sent. Please check your inbox.');
            } catch (error: any) {
              console.error('Error changing email:', error);
              let msg = 'Failed to change email.';
              if (error.code === 'auth/email-already-in-use') {
                msg = 'That email is already in use.';
              } else if (error.code === 'auth/wrong-password') {
                msg = 'Incorrect password.';
              } else if (error.code === 'auth/requires-recent-login') {
                msg = 'Please re-login to change your email.';
              } else if (error.code === 'auth/missing-password') {
                msg = 'Password cannot be empty.';
              }
              this.showToast(msg, 'danger');
            }            

            return true;
          }
        }
      ]
    });
  
    await alert.present();
  }

  async logout() {
    const alert = await this.alertController.create({
      header: 'Confirm Logout',
      message: 'Are you sure you want to log out?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Log Out',
          role: 'destructive',
          handler: async () => {
            await this.auth.signOut();
            this.router.navigateByUrl('/', { replaceUrl: true });
          }
        }
      ]
    });
  
    await alert.present();
  }  

  async deleteAccount() {
    const alert = await this.alertController.create({
      header: 'Delete Account',
      message: 'Are you sure you want to permanently delete your account? This cannot be undone.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            try {
              const user = this.auth.currentUser;

              if (user) {
                await deleteUser(user);
                this.showToast('Account deleted successfully.');
                this.router.navigateByUrl('/', { replaceUrl: true });
              }
            } catch (error: any) {
              console.error('Error deleting user:', error);
            
              let message = 'Failed to delete account. Please try again.';
            
              if (error.code === 'auth/requires-recent-login') {
                message = 'Please re-login before deleting your account for security reasons.';
              }
            
              this.showToast(message, 'danger');
            }
          }
        }
      ]
    });
  
    await alert.present();
  }
}
