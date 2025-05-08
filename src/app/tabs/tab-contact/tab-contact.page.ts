import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ToastController } from '@ionic/angular';
import { Auth } from '@angular/fire/auth'
import { Router } from '@angular/router'

@Component({
  selector: 'app-tab-contact',
  templateUrl: './tab-contact.page.html',
  styleUrls: ['./tab-contact.page.scss'],
  standalone: false,
})
export class TabContactPage implements OnInit {
  contactForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private toastCtrl: ToastController,
    private auth: Auth, 
    private router: Router
  ) {}

  ngOnInit() {
    this.contactForm = this.fb.group({
      name: ['', Validators.required],
      subject: ['', Validators.required],
      message: ['', Validators.required],
    });
  }

  async submitForm() {
    if (this.contactForm.valid) {
      const { name, subject, message } = this.contactForm.value;
      const email = this.auth.currentUser?.email;

      // Code to send email will go here

      const toast = await this.toastCtrl.create({
        message: 'Email sent!',
        duration: 2000,
        color: 'success',
        position: 'top'
      });
      toast.present();

      this.contactForm.reset();

      this.router.navigateByUrl('/tabs/tab-dashboard', { replaceUrl: false });
    }
  }
}
