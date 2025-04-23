import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';

@Injectable({
  providedIn: 'root'
})
export class FormDataService {
  private _storage: Storage | null = null;

  constructor(private storage: Storage) {
    this.init();
  }

  async init() {
    this._storage = await this.storage.create();
  }

  async setForm(data: any) {
    await this._storage?.set('formData', data);
  }

  async getForm(): Promise<any> {
    return await this._storage?.get('formData');
  }
}

