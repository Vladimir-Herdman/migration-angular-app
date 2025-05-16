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
    // Ensure quizComponent is available before calling updateForm
    if (this.quizComponent) {
      this.account.quiz = await this.quizComponent.updateForm();
    } else if (form) { // Fallback if ViewChild not ready, use stored form
      this.account.quiz = form;
    } else {
      this.account.quiz = this.formDataService.getDefaultForm();
    }
    
    this.authUnsubscribe = onAuthStateChanged(this.auth, (user) => {
      if (user) {
        this.user = user;
        this.authService.email_key = user.email ?? 'noEmailDetected';
        this.account.info.email = user.email ?? '';
        // TODO: Load settings from a persistent store (e.g., Firestore or local storage)
        // For now, notifications default to false or last known state if any.
        // this.account.settings.notifications = await this.loadNotificationSetting(); 
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
        message: 'You have unsaved changes. Are you sure you want to leave without saving?',
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            cssClass: 'alert-button-cancel'
          },
          {
            text: 'Leave',
            role: 'destructive',
            cssClass: 'alert-button-destructive',
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
    position: "top" | "bottom" | "middle" | undefined = "bottom" // Changed default to bottom
  ) {
    const toast = await this.toastController.create({
      message,
      duration,
      color,
      position,
      cssClass: 'custom-toast' // Add a custom class for styling if needed
    });
    await toast.present();
  }  

  async submitForm() {
    if (this.account.info.email !== this.oldForm.info.email) {
      await this.changeEmail(this.account.info.email);
      // If email change initiated, it will likely sign out or require verification.
      // Further saves should happen after that process or be conditional.
      // For now, we return to avoid saving other data if email change is the primary action.
      return;
    }

    await this.formDataService.setForm(this.account.quiz); // Store questionnaire answers
    // TODO: Save other settings (e.g., this.account.settings.notifications)
    // await this.saveNotificationSetting(this.account.settings.notifications);

    this.oldForm = JSON.parse(JSON.stringify(this.account));
    this.showToast('Account settings saved successfully!');
  }

  async changeEmail(newEmail: string) {
    if (!this.user || !this.user.email) {
      this.showToast('No user is signed in.', 'danger');
      return;
    }
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      this.showToast('Please enter a valid email address.', 'danger');
      return;
    }


    const reauthSuccess = await this.reauth('update your email');
    if (!reauthSuccess) return; 

    try {
      await verifyBeforeUpdateEmail(this.user, newEmail);
      this.showToast(`Verification email sent to ${newEmail}. Please check your inbox. You will be signed out.`, 'warning', 5000);
      await this.logout();
    } catch (error: any) {
      console.error('Error changing email:', error);
      let msg = 'Failed to initiate email change.';
      if (error.code === 'auth/email-already-in-use') {
        msg = 'This email address is already in use by another account.';
      } else if (error.code === 'auth/invalid-email') {
        msg = 'The new email address is not valid.';
      } else {
        msg = error.message || msg;
      }
      this.showToast(msg, 'danger', 3000);
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
          placeholder: 'New Password (min. 6 characters)'
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
          role: 'cancel',
          cssClass: 'alert-button-cancel'
        },
        {
          text: 'Update',
          cssClass: 'alert-button-confirm',
          handler: async (data) => {
            const { currentPassword, newPassword, confirmPassword } = data;

            if (!currentPassword || !newPassword || !confirmPassword) {
              this.showToast('All fields are required.', 'danger');
              return false; // Prevent alert from closing
            }
            if (newPassword !== confirmPassword) {
              this.showToast('New passwords do not match.', 'danger');
              return false;
            }
            if (newPassword.length < 6) {
              this.showToast('New password must be at least 6 characters long.', 'danger');
              return false;
            }

            try {
              const user = this.auth.currentUser;
              if (!user || !user.email) {
                this.showToast('User not signed in.', 'danger');
                return false;
              }

              const credential = EmailAuthProvider.credential(user.email, currentPassword);
              await reauthenticateWithCredential(user, credential); // Re-authenticate first
              await updatePassword(user, newPassword); // Then update
              this.showToast('Password updated successfully.', 'success');
              return true; // Allow alert to close
            } catch (err: any) {
              console.error('Password update error:', err);
              let msg = 'Failed to change password.';
              if (err.code === 'auth/wrong-password') {
                msg = 'Incorrect current password.';
              } else if (err.code === 'auth/weak-password') {
                msg = 'The new password is too weak.';
              } else if (err.code === 'auth/requires-recent-login') {
                msg = 'This operation is sensitive and requires recent authentication. Please log out and log back in to change your password.';
              }
              this.showToast(msg, 'danger', 3000);
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
          role: 'cancel',
          cssClass: 'alert-button-cancel'
        },
        {
          text: 'Log Out',
          role: 'destructive',
          cssClass: 'alert-button-destructive',
          handler: async () => {
            await this.logout();
          }
        }
      ]
    });
    await alert.present();
  }

  async logout() {
    try {
      await this.auth.signOut();
      this.router.navigateByUrl('/login', { replaceUrl: true }); // Navigate to login page
      this.showToast('You have been logged out.', 'primary');
    } catch (error) {
      console.error('Logout error:', error);
      this.showToast('Failed to log out. Please try again.', 'danger');
    }
  }

  async handleDelete() {
    const alert = await this.alertController.create({
      header: 'Delete Account',
      message: 'This action is permanent and cannot be undone. Are you sure you want to delete your account?',
      subHeader: 'You will need to re-enter your password to confirm.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          cssClass: 'alert-button-cancel'
        },
        {
          text: 'Delete',
          role: 'destructive',
          cssClass: 'alert-button-destructive',
          handler: async () => {
            // Re-authenticate before actual deletion
            const reauthSuccess = await this.reauth('delete your account');
            if (reauthSuccess) {
              this.confirmFinalDelete();
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async confirmFinalDelete() {
    const finalConfirmAlert = await this.alertController.create({
        header: 'Final Confirmation',
        message: 'All your data will be erased. This is your last chance to cancel.',
        buttons: [
            { text: 'Cancel', role: 'cancel', cssClass: 'alert-button-cancel' },
            {
                text: 'Yes, Delete My Account',
                role: 'destructive',
                cssClass: 'alert-button-destructive',
                handler: async () => {
                    await this.deleteAccount();
                }
            }
        ]
    });
    await finalConfirmAlert.present();
  }


  async deleteAccount() {
    try {
      const user = this.auth.currentUser;
      if (user) {
        await deleteUser(user);
        this.showToast('Account deleted successfully.', 'success');
        // TODO: Clear any user-specific local storage/cache beyond what Firebase handles
        await this.storage.remove(`${this.authService.email_key}_formData`);
        await this.storage.remove(`${this.authService.email_key}_${this.formDataService.getDefaultForm()}`); // Example, adjust actual keys
        
        this.router.navigateByUrl('/login', { replaceUrl: true });
      } else {
        this.showToast('No user found to delete.', 'warning');
      }
    } catch (error: any) {
      // Re-authentication should have been handled by `handleDelete` calling `reauth`
      console.error('Error deleting account:', error);
      let msg = 'Failed to delete account. Please try again.';
      if (error.code === 'auth/requires-recent-login') {
         msg = 'This operation is sensitive and requires recent authentication. Please log out and log back in to delete your account.';
      }
      this.showToast(msg, 'danger', 3000);
    }
  }

  public async clear_cache(all_cache: boolean = false) {
    const header = all_cache ? 'Confirm Clear All Device Cache' : 'Confirm Clear Your Cache';
    const message = all_cache ?
        'Are you sure you want to clear ALL cached data for ALL users on this device? This action cannot be undone and may affect other users if this device is shared.' :
        'Are you sure you want to clear your personalized checklist and questionnaire data? This action cannot be undone.';
    const confirmButtonText = all_cache ? 'Clear All Cache' : 'Clear My Cache';

    const alert = await this.alertController.create({
        header: header,
        message: message,
        buttons: [
            {
                text: 'Cancel',
                role: 'cancel',
                cssClass: 'alert-button-cancel'
            },
            {
                text: confirmButtonText,
                role: 'destructive', // Use destructive role for clarity
                cssClass: 'alert-button-destructive',
                handler: async () => {
                    try {
                        if (all_cache) {
                            await this.storage.clear(); // Clears all Ionic Storage
                            this.showToast('All device cache cleared successfully.', 'success');
                        } else {
                            const userEmailPrefix = this.authService.email_key.replace(/[^a-zA-Z0-9]/g, '_') || 'default_user';
                            // Specific keys to remove for the current user
                            const checklist_key = `${userEmailPrefix}_cachedChecklist_v3`; // From checklist page
                            const form_data_key = `${userEmailPrefix}_cachedFormDataForChecklist_v3`; // From checklist page
                            const quiz_form_key = `${userEmailPrefix}_formData`; // From form-data.service
                            
                            await this.storage.remove(checklist_key);
                            await this.storage.remove(form_data_key);
                            await this.storage.remove(quiz_form_key);
                            
                            this.showToast('Your cached data has been cleared.', 'success');
                            // Optionally, reload or reset parts of the app state
                            this.account.quiz = this.formDataService.getDefaultForm();
                            if (this.quizComponent) {
                                await this.quizComponent.updateForm();
                            }
                        }
                    } catch (e) {
                        console.error("Error clearing cache: ", e);
                        this.showToast('Failed to clear cache.', 'danger');
                    }
                }
            }
        ]
    });
    await alert.present();
  }

  async reauth(action: string = 'perform this sensitive action'): Promise<boolean> {
    return new Promise<boolean>(async (resolve) => {
      if (!this.auth.currentUser || !this.auth.currentUser.email) {
        this.showToast('User not properly signed in for re-authentication.', 'danger');
        resolve(false);
        return;
      }
      const alert = await this.alertController.create({
        header: 'Re-authenticate',
        message: `For your security, please enter your password to ${action}.`,
        inputs: [
          { name: 'password', type: 'password', placeholder: 'Password' }
        ],
        backdropDismiss: false, // Prevent dismissing by clicking outside
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            cssClass: 'alert-button-cancel',
            handler: () => resolve(false)
          },
          {
            text: 'Confirm',
            cssClass: 'alert-button-confirm',
            handler: async (data) => {
              if (!data.password) {
                this.showToast('Password is required.', 'danger');
                // To re-present the alert or handle differently, you might need more complex logic
                // For now, we resolve false and the user has to initiate the action again.
                resolve(false); 
                return;
              }
              try {
                const user = this.auth.currentUser;
                // Ensure user.email is not null before using it. Already checked above but good practice.
                const credential = EmailAuthProvider.credential(user!.email!, data.password);
                await reauthenticateWithCredential(user!, credential);
                this.showToast('Re-authentication successful.', 'success');
                resolve(true);
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