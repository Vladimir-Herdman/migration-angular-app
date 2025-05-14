import { Component, ViewChild } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { ToastController, AlertController, ViewWillEnter } from '@ionic/angular';
import { Auth, onAuthStateChanged, deleteUser, EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail, updatePassword } from '@angular/fire/auth';
import { FormDataService } from 'src/app/components/quiz/form-data.service';
import { QuizComponent } from 'src/app/components/quiz/quiz.component';
import { AuthService } from 'src/app/services/auth.service';
import { Storage } from '@ionic/storage-angular';

@Component({
  selector: 'app-account',
  templateUrl: 'account.page.html',
  styleUrls: ['account.page.scss'],
  standalone: false,
})
export class AccountPage implements ViewWillEnter {
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
    private formDataService: FormDataService,
    private authService: AuthService,
    private storage: Storage,
  ) {}

  authUnsubscribe: (() => void) | null = null;

  async ionViewWillEnter() {
    const form = await this.formDataService.getForm();
    this.canShowQuiz = this.formDataService.isFilled(form);
    this.account.quiz = await this.quizComponent.updateForm();
    this.authUnsubscribe = onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.user = user;
        this.authService.email_key = user.email ?? 'noEmailDetected';
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

  async showToast(
    message: string,
    color: string = 'success',
    duration: number = 2000,
    position: "top" | "bottom" | "middle" | undefined = "top"
  ) {
    const toast = await this.toastController.create({
      message,
      duration,
      color,
      position
    });
    await toast.present();
  }  

  async submitForm() {
    if (this.account.info.email !== this.oldForm.info.email) {
      await this.changeEmail(this.account.info.email);
      return;
    }

    await this.formDataService.setForm(this.account.quiz); // Store questionnaire answers

    this.oldForm = JSON.parse(JSON.stringify(this.account));
    this.showToast('Account saved successfully!');
  }

  async changeEmail(newEmail: string) {
    if (!this.user || !this.user.email) {
      this.showToast('No user is signed in.', 'danger');
      return;
    }

    if (!(await this.reauth())) return; // Prompt user to re-authenticate

    try {
      await verifyBeforeUpdateEmail(this.user, newEmail);
      this.showToast(`Verification email sent to ${newEmail}. You will now be signed out.`, 'warning', 5000);
      await this.logout();
    } catch (error: any) {
      console.error('Error changing email:', error);
      let msg = 'Failed to change email.';
      if (error.code === 'auth/email-already-in-use') {
        msg = 'That email is already in use.';
      } else {
        msg = error.message || msg; // Already re-authenticated, so these are less likely
      }
      this.showToast(msg, 'danger');
    }
  }

  async changePassword() {
    const alert = await this.alertController.create({
      header: 'Change Password',
      inputs: [
        {
          name: 'currentPassword',
          type: 'password',
          placeholder: 'Current Password'
        },
        {
          name: 'newPassword',
          type: 'password',
          placeholder: 'New Password'
        },
        {
          name: 'confirmPassword',
          type: 'password',
          placeholder: 'Confirm New Password'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Update',
          handler: async (data) => {
            const { currentPassword, newPassword, confirmPassword } = data;

            if (!currentPassword || !newPassword || !confirmPassword) {
              this.showToast('All fields are required.', 'danger');
              return false;
            }

            if (newPassword !== confirmPassword) {
              this.showToast('Passwords do not match.', 'danger');
              return false;
            }

            if (newPassword.length < 6) {
              this.showToast('Password must be at least 6 characters.', 'danger');
              return false;
            }

            try {
              const user = this.auth.currentUser;
              if (!user || !user.email) throw new Error('User not signed in.');

              const credential = EmailAuthProvider.credential(user.email, currentPassword);
              await reauthenticateWithCredential(user, credential);
              await updatePassword(user, newPassword);
              this.showToast('Password updated successfully.', 'success');
              return true;
            } catch (err: any) {
              console.error('Password update error:', err);
              let msg = 'Failed to change password.';
              if (err.code === 'auth/wrong-password') msg = 'Incorrect current password.';
              else if (err.code === 'auth/weak-password') msg = 'Password is too weak.';
              else if (err.code === 'auth/requires-recent-login') msg = 'Please re-login to change your password.';
              this.showToast(msg, 'danger');
              return false;
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async handleLogout() {
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
            await this.logout();
          }
        }
      ]
    });
    await alert.present();
  }

  async logout() {
    await this.auth.signOut();
    this.router.navigateByUrl('/', { replaceUrl: true });
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
        if (await this.reauth()) {
          this.deleteAccount();
        };
      } else {
        this.showToast('Failed to delete account. Please try again.', 'danger');
      }
    }
  }

  public async clear_cache(all_cache: boolean = false) {
    const header = all_cache ? 'Confirm Clear All Cache' : 'Confirm Clear Cache';
    const message = all_cache ?
        'Are you sure you want to clear ALL cached data for ALL users on this device? This action cannot be undone and may affect other users if this device is shared.' :
        'Are you sure you want to clear your personalized checklist and questionnaire data? This action cannot be undone.';
    const confirmButtonText = all_cache ? 'Clear All' : 'Clear';

    const alert = await this.alertController.create({
        header: header,
        message: message,
        cssClass: 'custom-alert', // Need mobile styling probably
        buttons: [
            {
                text: 'Cancel',
                role: 'cancel',
                cssClass: 'alert-button-cancel'
            },
            {
                text: confirmButtonText,
                role: 'destructive',
                cssClass: 'alert-button-destructive',
                handler: async () => {
                    if (all_cache) {
                        await this.storage.clear();
                        this.showToast('Cache for all users cleared successfully.', 'success');
                    } else {
                        const userEmailPrefix = this.authService.email_key.replace(/[^a-zA-Z0-9]/g, '_') || 'default_user';
                        // Ensure these base keys are consistent with tab_checklist.page.ts
                        const checklist_base_key = 'cachedChecklist_v3';
                        const form_data_base_key = 'cachedFormDataForChecklist_v3';
                        
                        await this.storage.remove(`${userEmailPrefix}_${checklist_base_key}`);
                        await this.storage.remove(`${userEmailPrefix}_${form_data_base_key}`);
                        this.showToast('Your cached checklist and questionnaire data have been cleared.', 'success');
                    }
                }
            }
        ]
    });
    await alert.present();
  }

  async reauth(): Promise<boolean> {
    return new Promise<boolean>(async (resolve) => {
      const alert = await this.alertController.create({
        header: 'Re-authenticate',
        message: 'For your security, please enter your password to continue.',
        inputs: [
          { name: 'password', type: 'password', placeholder: 'Password' }
        ],
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => resolve(false)
          },
          {
            text: 'Confirm',
            handler: async (data) => {
              try {
                const user = this.auth.currentUser;
                if (user && data.password && user.email) { // Ensure user.email is not null
                  const credential = EmailAuthProvider.credential(user.email, data.password);
                  await reauthenticateWithCredential(user, credential);
                  resolve(true);
                } else {
                  this.showToast('Password is required.', 'danger');
                  resolve(false);
                }
              } catch (err: any) {
                console.error('Re-authentication failed:', err);
                this.showToast('Re-authentication failed. Incorrect password.', 'danger');
                resolve(false);
              }
            }
          }
        ]
      });
      await alert.present();
    });
  }
}
