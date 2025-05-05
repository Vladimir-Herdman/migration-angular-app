import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-tab_dashboard',
  templateUrl: './tab-dashboard.page.html',
  styleUrls: ['./tab-dashboard.page.scss'],
  standalone: false,
})
export class TabDashboardPage implements OnInit {

  constructor(private router: Router) { }

  ngOnInit() {
  }

  goToRelocation() {
    this.router.navigateByUrl('/tabs/tab_checklist', { replaceUrl: false });
  }

  goToServices() {
    this.router.navigateByUrl('/tabs/tab-services', { replaceUrl: false });
  }

  goToHoliday() {
    this.router.navigateByUrl('/tabs/tab-holiday', { replaceUrl: false });
  }

  goToContact() {
    this.router.navigateByUrl('/tabs/tab-contact', { replaceUrl: false });
  }

}
