import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IonicModule, LoadingController, AlertController, ViewWillEnter } from '@ionic/angular';
import { FormGroup, FormBuilder, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';
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
    loginForm!: FormGroup;
    email: string | null = null;
    password: string | null = null;
    emailError: string = "Invalid email";
    passwordError: string = "6 character minimum";

  constructor(
      private router: Router,
      private formBuilder: FormBuilder,
      private loadingController: LoadingController,
      private alertController: AlertController,
      private auth: Auth,
      private authService: AuthService,
      private databaseService: DatabaseService
  ) {
      this.loginForm = this.formBuilder.group({
          email: ['', [Validators.required, Validators.email]],
          password: ['', [Validators.required, Validators.minLength(6)]]
      });
  }

  ngOnInit() {
      // If already signed in, skip the login page
      onAuthStateChanged(this.auth, (user) => {
        if (user) this.skip();
      });
  }

  public forgot_email_password() {
      this.router.navigateByUrl('/forgotpassword')
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
      this.router.navigateByUrl('/register', { replaceUrl: false });
  }

	private async postLoginFlow(userCredentials: any) {
      const userUid = userCredentials.user.uid;
      this.databaseService.userUid = userUid;
      await this.databaseService.getUserData();
      this.skip();
  }

  private async showAlert(header: string, message: string) {
      const alert = await this.alertController.create({
          header,
          message,
          buttons: ['OK']
      });
      await alert.present();
  }

  async google_signin() {
      const google = await this.authService.loginGoogle();
      if (google?.user) {
          this.router.navigateByUrl('/tabs', { replaceUrl: true });
      } else {
          console.error("Google did not through - frontend");
      }
  }

  skip() {
      this.router.navigateByUrl('/tabs', { replaceUrl: true });
  }

}
