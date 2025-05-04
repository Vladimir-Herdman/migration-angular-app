import { Component, OnInit } from '@angular/core';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false,
})
export class TabsPage implements OnInit {

  constructor(
    private authService: AuthService
  ) {}

  ngOnInit(): void {
      this.authService.registration_info = {
          email: '',
          password: ''
      };
  }

}
