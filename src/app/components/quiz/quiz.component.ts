import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ToastController, PopoverController } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { FormDataService } from '../../components/quiz/form-data.service';
import { CountrySelectComponent } from '@wlucha/ng-country-select';

@Component({
  selector: 'app-quiz',
  templateUrl: './quiz.component.html',
  styleUrls: ['./quiz.component.scss'],
  imports: [CommonModule, IonicModule, FormsModule, CountrySelectComponent]
})
export class QuizComponent implements OnInit {

  @Input() form: any;
  private autoSaveTimeout: any;

  constructor(
    private formDataService: FormDataService,
    private toastController: ToastController,
    private popoverController: PopoverController
  ) { }

  ngOnInit() {
    // Set up change detection for auto-save
    this.setupFormChangeDetection();
  }

  async updateForm() {
    this.form = (await this.formDataService.getForm()) ?? this.formDataService.getDefaultForm(); // If first time, use the default empty form
    this.setupFormChangeDetection();
    return this.form;
  }

  public handleSelection(event: any) {
    const country = event.translations.en;
    this.form.destination = country;
    this.triggerAutoSave();
  }

  private setupFormChangeDetection() {
    // Using a Proxy to detect deep changes would be ideal,
    // but for simplicity, we'll use individual change handlers in the component
    // This is already happening with ngModel and we just need to add change handlers
  }

  /**
   * Triggers auto-save with debounce to prevent too many saves
   */
  triggerAutoSave() {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }
    
    this.autoSaveTimeout = setTimeout(async () => {
      await this.formDataService.setForm(this.form);
      // Optional: Show a subtle indication that auto-save happened
      this.showSavedToast();
    }, 1500); // 1.5 second debounce
  }

  async showSavedToast() {
    const toast = await this.toastController.create({
      message: 'Changes saved',
      duration: 1000,
      position: 'bottom',
      color: 'success',
      cssClass: 'auto-save-toast',
      buttons: [
        {
          icon: 'checkmark',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }

  public showTooltip(event: Event, section: string) {
    event.stopPropagation(); // Prevent accordion toggle
    
    let message = '';
    
    switch(section) {
      case 'services':
        message = 'Select which services you need help setting up at your new location. This helps us create tailored checklists for your move.';
        break;
      default:
        message = 'This section helps personalize your moving experience.';
    }
    
    this.presentTooltip(message, event);
  }
  
  async presentTooltip(message: string, ev: Event) {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      position: 'middle',
      cssClass: 'info-tooltip',
      buttons: [
        {
          icon: 'close',
          role: 'cancel'
        }
      ]
    });
    
    await toast.present();
  }

}
