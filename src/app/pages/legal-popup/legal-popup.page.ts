import { Component, AfterViewInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IonicModule, IonContent, ToastController } from '@ionic/angular';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-legal-popup',
  templateUrl: './legal-popup.page.html',
  styleUrls: ['./legal-popup.page.scss'],
  imports: [CommonModule, IonicModule],
})
export class LegalPopupPage implements  AfterViewInit {
  @ViewChild(IonContent) scrollableContent!: IonContent;

  constructor(
    private router: Router,
    private authService: AuthService,
    private toastController: ToastController
  ) {}

  ngAfterViewInit() {
      let acceptButton = document.getElementById('accept-button');
      this.scrollableContent?.getScrollElement().then(sc => {
          sc.addEventListener('scroll', () => {
              if (this.isAtBottom(sc)) {
                  acceptButton?.removeAttribute('disabled');
              }
          });
      });
  }

  isAtBottom(scrollable_content: HTMLElement): boolean {
      if (!scrollable_content) {return false;}
      return scrollable_content.scrollHeight - scrollable_content.scrollTop <= scrollable_content.clientHeight + 10;
  }

  public async acceptClick() {
      // Return to register page to finish creating account
      this.authService.registration_info.agreedToLegal = true;
      this.router.navigateByUrl('/register', { replaceUrl: true });
  }

  public async declineClick() {
      const toast = await this.toastController.create({
        message: 'You must accept the terms to create an account.',
        duration: 5000,
        color: 'warning',
        position: 'top'
      });
    
      await toast.present();

      this.router.navigateByUrl('/register', { replaceUrl: true });
  }

}
