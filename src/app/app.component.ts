import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Auth, onAuthStateChanged } from '@angular/fire/auth';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  constructor(private auth: Auth, private router: Router) {
    onAuthStateChanged(this.auth, (user) => {
      if (!user) this.router.navigateByUrl('/', { replaceUrl: true });
    });
  }
}
