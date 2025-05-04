import { Component, AfterViewInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IonicModule, IonContent, ToastController } from '@ionic/angular';
import { AuthService } from 'src/app/services/auth.service';
import { DatabaseService } from 'src/app/services/database.service';

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
    private databaseService: DatabaseService,
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
      // falsify the firstTimeSignIn so don't see legal page on subsequent sign in's
      const userUid = this.databaseService.userUid;
      await this.authService.falsifyFirstTimeSignIn(userUid);
        
      // Navigate away
      this.router.navigateByUrl('/tabs', { replaceUrl: true });
  }

  public async declineClick() {
      const toast = await this.toastController.create({
        message: 'You must accept the terms to continue. Login again to accept.',
        duration: 5000,
        color: 'warning',
        position: 'top'
      });
    
      await toast.present();

      this.router.navigate(['/']);
  }

}
