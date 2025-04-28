import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IonicModule, LoadingController, AlertController } from '@ionic/angular';
import { FormGroup, FormBuilder, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from 'src/app/services/auth.service';
import { DatabaseService } from 'src/app/services/database.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule, ReactiveFormsModule],
})

export class LoginPage implements OnInit {
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
      private databaseService: DatabaseService
  ) {
      this.loginForm = this.formBuilder.group({
          email: ['', [Validators.required, Validators.email]],
          password: ['', [Validators.required, Validators.minLength(6)]]
      });
  }

  ngOnInit() {
      //TODO: Implement already signed in check
      // This OnInit function is used on startup to pull up data and use it in
      // the rest of the page.  Essentially, this is where we should check if
      // the user has already signed in before
  }

  public forgot_email_password() {
      //TODO: Implement in AuthService forgot email/password from firebase
      console.log("forgot email-password pressed");
  }

  public async login() {
      /*
       * this.email, this.password -> class variables pointing to input form value, updated at login button press
       * this.emailError, this.passwordError -> binded property from html, links value there with error message we set here
       * this.loginForm[...].valid -> Input validation check to see if current input valid or not
       * this.loginForm[...].setErrors -> Sets an input into error state or not, for custom styling with our errors
       */
        // Good article for this firebase implementation: https://devdactic.com/ionic-firebase-auth-upload
      this.email = this.loginForm.get("email")?.value;
      this.password = this.loginForm.get("password")?.value;

        // NON-PRODUCTION: If email and password are empty, skip authentication
        if (!environment.production && this.email == "" && this.password == "") {
            this.router.navigateByUrl('/tabs', { replaceUrl: true });
        }
      
      // This is purely to make password say 'Invalid password' on incorrect login
      if (this.loginForm.get("email")?.valid) {
          this.loginForm.get("email")?.setErrors(null);
          this.loginForm.get("password")?.setErrors(null);
      }
        
      // Here, input validation for correct style of email (@ symbol with letter after)
      // TODO: Make password length above 6
      if (this.loginForm.valid && this.loginForm.get("password")?.value.length >= 6 ){
          const loading = await this.loadingController.create();
          await loading.present();

          const userCredentials = await this.authService.login(this.loginForm.value);
          await loading.dismiss();

          if (userCredentials) {
            await this.postLoginFlow(userCredentials);
					} else {
            this.showAlert('Login failed', 'Please try again!');
					}

      } else {
          this.emailError = "Invalid email";
          this.passwordError = "6 character minimum";
          this.loginForm.markAllAsTouched();
          this.loginForm.get("password")?.setErrors({ customError: true });
      }
  }

  public async register() {
      const loading = await this.loadingController.create();
      await loading.present();

      const user = await this.authService.register(this.loginForm.value);
      await loading.dismiss();

      if (user) {
				await this.postLoginFlow(user);
			} else {
        this.showAlert('Registration failed', 'Please try again!');
			}		
  }

	private async postLoginFlow(userCredentials: any) {
      const userUid = userCredentials.user.uid;
      this.databaseService.userUid = userUid;
      await this.databaseService.getUserData();
      const firstTimeSignIn = this.databaseService.userData?.firstTimeSignIn;

      if (firstTimeSignIn) {
        this.router.navigateByUrl('/legal-popup', { replaceUrl: true });
      } else {
        this.router.navigateByUrl('/tabs', { replaceUrl: true });
      }
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
