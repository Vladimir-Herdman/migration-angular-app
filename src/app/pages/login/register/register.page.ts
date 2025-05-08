import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormGroup, FormBuilder, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule, LoadingController, AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  imports: [CommonModule, IonicModule, FormsModule, ReactiveFormsModule]
})
export class RegisterPage implements OnInit {
  loginForm: FormGroup;
  email: string | null = null;
  password: string | null = null;
  emailError: string = "Invalid email";
  passwordError: string = "6 character minimum";

  constructor(
      private router: Router,
      private formBuilder: FormBuilder,
      private loadingController: LoadingController,
      private alertController: AlertController,
      private authService: AuthService,
  ) {
      this.loginForm = this.formBuilder.group({
          email: ['', [Validators.required, Validators.email]],
          password: ['', [Validators.required, Validators.minLength(6)]]
      });
  }

  ngOnInit() {
      const form = this.authService.registration_info.form;
      if (form) {
        this.loginForm.setValue({
          email: form.email || '',
          password: form.password || ''
        });
      }
  }

  async ionViewWillEnter() {
      // If returning from legal page after agreeing, register and sign in the user
      if (this.authService.registration_info.agreedToLegal) {
        const loading = await this.loadingController.create();
        await loading.present();

        const user = await this.authService.register(this.authService.registration_info.form);
        await loading.dismiss();

        if (user) {
          this.router.navigateByUrl('/tabs', { replaceUrl: true });
        } else {
          this.showAlert('Registration failed', 'Please try again!');
        }
      }
  }

  async register() {
      // Save form to remember registration info after going to legal page
      this.authService.registration_info.form = this.loginForm.value;
      this.router.navigateByUrl('/legal-popup', { replaceUrl: true });
  }

  back() {
      this.router.navigateByUrl('/login', { replaceUrl: true });
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
