import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IonicModule, LoadingController, AlertController } from '@ionic/angular';
import { FormGroup, FormBuilder, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-forgotpassword',
  templateUrl: './forgotpassword.page.html',
  styleUrls: ['./forgotpassword.page.scss'],
  imports: [CommonModule, IonicModule, FormsModule, ReactiveFormsModule],
})
export class ForgotpasswordPage implements OnInit {
    loginForm!: FormGroup;
    email: string | null = null;
    emailError: string = "Invalid email";

  constructor(
      private router: Router,
      private formBuilder: FormBuilder,
      private loadingController: LoadingController,
      private alertController: AlertController,
      private authService: AuthService,
  ) {
      this.loginForm = this.formBuilder.group({
          email: ['', [Validators.required, Validators.email]]
      });
  }

  ngOnInit() {
  }

  async sendReset() {
    const loading = await this.loadingController.create();
    await loading.present();

    const noResetProblem = await this.authService.sendPasswordReset(this.loginForm.get('email')?.value);
    await loading.dismiss();

    // Email could still have been wrong if typed in incorrectly
    if (noResetProblem){
        this.router.navigateByUrl('/login', { replaceUrl: true });
    } else {
        this.showAlert('Registration failed', 'Please try again!');
    }
  }

  back() {
      this.router.navigateByUrl('/login', {replaceUrl: true});
  }

  private async showAlert(header: string, message: string) {
      const alert = await this.alertController.create({
          header,
          message,
          buttons: ['OK']
      });
      await alert.present();
  }
}
