import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from 'src/app/services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class FormDataService {
  private _storage: Storage | null = null;
  private _email_key: string;

  private formDataSubject = new BehaviorSubject<any>(null);
  formData$ = this.formDataSubject.asObservable();  

  constructor(private storage: Storage, private authService: AuthService) {
    this.init();
    this._email_key = this.authService.email_key;
  }

  async init() {
    this._storage = await this.storage.create();
    const savedForm = await this._storage?.get(`${this._email_key}_formData`);
    if (savedForm) {
      this.formDataSubject.next(savedForm);
    }
  }

  isFilled(form: any): boolean {
    const isFilled_Boolean = !!(form && form.moveType && form.destination && form.moveDate);
    return isFilled_Boolean;
  }

  async setForm(data: any) {
    await this._storage?.set(`${this._email_key}_formData`, data);
    this.formDataSubject.next(data);
  }

  async getForm(): Promise<any> {
    // Hey, I don't know why, but authService email key is not properly initialized
    // if called from the constructor or init.  Setting _email_key here keeps it
    // up to date and working ¯\_(-_-)_/¯
    this._email_key = this.authService.email_key;
    return await this._storage?.get(`${this._email_key}_formData`);
  }

  public getDefaultForm() {
    return {
      moveType: '',
      destination: '',
      moveDate: '',
      family: {
        children: false,
        pets: false
      },
      currentHousing: '',
      hasHousing: false,
      newHousing: '',
      vehicle: '',
      services: {
        internet: false,
        utilities: false,
        healthInsurance: false,
        homeInsurance: false,
        carInsurance: false
      },
      hasJob: false
    };
  }
}

