import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormDataService } from 'src/app/components/quiz/form-data.service';

@Component({
  selector: 'app-tab_dashboard',
  templateUrl: './tab-dashboard.page.html',
  styleUrls: ['./tab-dashboard.page.scss'],
  standalone: false,
})
export class TabDashboardPage implements OnInit {

  constructor(private router: Router, private formDataService: FormDataService) { }

  ngOnInit() {
  }

  async goToRelocation() {
    const form = await this.formDataService.getForm();
    let quizDone = this.formDataService.isFilled(form);
    let nextTab = quizDone ? 'checklist' : 'quiz';
    this.router.navigateByUrl(`/tabs/tab_${nextTab}`, { replaceUrl: false });
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
