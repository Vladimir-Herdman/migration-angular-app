import { Component, OnInit, ViewChild } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { ToastController, AlertController } from '@ionic/angular';
import { Auth, onAuthStateChanged, deleteUser, EmailAuthProvider, reauthenticateWithCredential } from '@angular/fire/auth';
import { FormDataService } from 'src/app/components/quiz/form-data.service';
import { QuizComponent } from 'src/app/components/quiz/quiz.component';

@Component({
  selector: 'app-account',
  templateUrl: 'account.page.html',
  styleUrls: ['account.page.scss'],
  standalone: false,
})
export class AccountPage implements OnInit {
  @ViewChild(QuizComponent)
  quizComponent!: QuizComponent;
  
  account: any = {
    info: {
      email: '',
      phone: ''
    },
    settings: {
      notifications: false
    },
    quiz: this.formDataService.getDefaultForm()
  }
  oldForm: any = {};
  user: any = null;
  canShowQuiz: boolean = false;

  constructor(
    private toastController: ToastController,
    private alertController: AlertController,
    private auth: Auth,
    private location: Location,
    private router: Router,
    private formDataService: FormDataService
  ) {}

  authUnsubscribe: (() => void) | null = null;

  async ngOnInit() {
    const form = await this.formDataService.getForm();
    this.canShowQuiz = this.formDataService.isFilled(form);
    this.account.quiz = await this.quizComponent.updateForm();
    this.authUnsubscribe = onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.user = user;
        this.account.info.email = user.email ?? '';
        this.account.settings.notifications = false; // WIP: settings should push to DB
      }
      this.oldForm = JSON.parse(JSON.stringify(this.account));
    });
  }
  
  ionViewWillLeave() {
    if (this.authUnsubscribe) {
      this.authUnsubscribe();
      this.authUnsubscribe = null;
    }
  }

  async handleBack() {
    if (JSON.stringify(this.account) !== JSON.stringify(this.oldForm)) {
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
    await this.formDataService.setForm(this.account.quiz); // Store questionnaire answers

    console.log(this.account);
    this.oldForm = JSON.parse(JSON.stringify(this.account));
    this.showToast('Account saved successfully!');
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

  async handleDelete() {
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
            this.deleteAccount()
          }
        }
      ]
    });
    await alert.present();
  }

  async deleteAccount() {
    try {
      const user = this.auth.currentUser;
      if (user) {
        await deleteUser(user);
        this.showToast('Account deleted successfully.');
        this.router.navigateByUrl('/', { replaceUrl: true });
      }
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        this.reauth();
      } else {
        this.showToast('Failed to delete account. Please try again.', 'danger');
      }
    }
  }

  async reauth() {
    const alert = await this.alertController.create({
      header: 'Re-authenticate',
      inputs: [
        { name: 'password', type: 'password', placeholder: 'Password' }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Confirm',
          handler: async (data) => {
            try {
              const user = this.auth.currentUser;
              if (user && data.password) {
                const credential = EmailAuthProvider.credential(user.email!, data.password);
                await reauthenticateWithCredential(user, credential);
                this.deleteAccount();
              } else {
                this.showToast('Missing password', 'danger');
              }
            } catch (err: any) {
              console.error('Re-authentication failed:', err);
              this.showToast('Re-authentication failed. Please try again.', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }
}
