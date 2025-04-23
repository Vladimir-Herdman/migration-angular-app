import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FormDataService {
  private _storage: Storage | null = null;

  private formDataSubject = new BehaviorSubject<any>(null);
  formData$ = this.formDataSubject.asObservable();  

  constructor(private storage: Storage) {
    this.init();
  }

  async init() {
    this._storage = await this.storage.create();
    const savedForm = await this._storage.get('formData');
    if (savedForm) {
      this.formDataSubject.next(savedForm);
    }

  }

  async setForm(data: any) {
    await this._storage?.set('formData', data);
    this.formDataSubject.next(data);
  }

  async getForm(): Promise<any> {
    return await this._storage?.get('formData');
  }
}

