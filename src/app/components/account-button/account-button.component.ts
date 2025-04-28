import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-account-button',
  imports: [IonicModule],
  templateUrl: './account-button.component.html',
  styleUrls: ['./account-button.component.scss'],
})
export class AccountButtonComponent  implements OnInit {

  constructor(private router: Router) { }

  ngOnInit() {}

  goToAccount() {
    this.router.navigate(['/account']);
  }

}
