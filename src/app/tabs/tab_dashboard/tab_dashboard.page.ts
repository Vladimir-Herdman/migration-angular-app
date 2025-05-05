import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-tab_dashboard',
  templateUrl: './tab_dashboard.page.html',
  styleUrls: ['./tab_dashboard.page.scss'],
  standalone: false,
})
export class TabDashboardPage implements OnInit {

  constructor(private router: Router) { }

  ngOnInit() {
  }

  goToRelocation() {
    this.router.navigateByUrl('/tabs/tab_checklist', { replaceUrl: false });
  }

  goToHoliday() {}
  goToServices() {}
  goToContact() {}

}
