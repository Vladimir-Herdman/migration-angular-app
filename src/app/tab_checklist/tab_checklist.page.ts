import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy } from '@angular/core';
import { FormDataService } from 'src/app/tab_quiz/form-data.service';
import { Capacitor } from '@capacitor/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { LoadingController, ToastController } from '@ionic/angular';

// Define interfaces for the expected task structure from the backend
interface RelocationTask {
  task_description: string;
  priority: 'High' | 'Medium' | 'Low';
  due_date: string;
}

interface TaskListResponse {
  predeparture: RelocationTask[];
  departure: RelocationTask[];
  arrival: RelocationTask[];
}


@Component({
  selector: 'app-tab_checklist',
  templateUrl: 'tab_checklist.page.html',
  styleUrls: ['tab_checklist.page.scss'],
  standalone: false,
})

export class TabChecklistPage implements AfterViewInit, OnDestroy {
  formData : any;  // Are we just using any for testing purposes? - Ben
  selectedStage = "predeparture";
  page_list?: Array<ElementRef>
  @ViewChild('predeparture') predepDiv!: ElementRef;
  @ViewChild('departure') depDiv!: ElementRef;
  @ViewChild('arrival') arrDiv!: ElementRef;

  // Use the interface for the task lists
  preItemList: RelocationTask[] = [];
  depItemList: RelocationTask[] = [];
  arrItemList: RelocationTask[] = [];
  preCheckBoxes: boolean[] = [];
  depCheckBoxes: boolean[] = [];
  arrCheckBoxes: boolean[] = [];


  private formDataSubscription!: Subscription; // To manage the subscription

  // Define the backend API URL
  // TODO: Use a service to keep same backendURL, or just keep all backend logic and data needed
  //    Here, this is to connect android, look into apple connection for backend
  private backendUrl = this.getPlatformBackendUrl();

  constructor(
    private formDataService: FormDataService,
    private http: HttpClient,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {}

  async ngAfterViewInit() {
    this.depCheckBoxes.fill(false);
    // this.formData = await this.formDataService.getForm();
    this.page_list = [this.predepDiv, this.depDiv, this.arrDiv];
    this.updateViewPage();

    this.formDataSubscription = this.formDataService.formData$.subscribe(form => {
      if (form) {
        this.formData = form; // Update local formData
        this.generateChecklist(form); // Call function to generate checklist via backend
      }
    });

    // Also load existing form data on init if available
    const initialForm = await this.formDataService.getForm();
    if (initialForm) {
      this.formData = initialForm;
      this.generateChecklist(initialForm);
    }
  }

  ngOnDestroy() {
    // Unsubscribe to prevent memory leaks
    if (this.formDataSubscription) {
      this.formDataSubscription.unsubscribe();
    }
  }

  public async generateChecklist(form: any) {
    // Show loading indicator
    const loading = await this.loadingController.create({
      message: 'Generating your personalized checklist...',
      spinner: 'dots'
    });
    await loading.present();

    // Clear existing lists
    this.preItemList = [];
    this.depItemList = [];
    this.arrItemList = [];

    try {
      // Send quiz data to the backend
      const response = await this.http.post<TaskListResponse>(`${this.backendUrl}/generate_tasks`, form).toPromise();

      if (response) {
        // Populate lists with tasks from the backend response
        this.preItemList = response.predeparture;
        this.depItemList = response.departure;
        this.arrItemList = response.arrival;

        const toast = await this.toastController.create({
          message: 'Checklist generated successfully!',
          duration: 2000,
          color: 'success',
          position: 'middle'
        });
        await toast.present();

        } else {
          const toast = await this.toastController.create({
            message: 'Failed to generate checklist. Please try again.',
            duration: 3000,
            color: 'danger',
            position: 'middle'
          });
          await toast.present();
        }

    } catch (error) {
      console.error('Error generating checklist:', error);
        const toast = await this.toastController.create({
          message: 'Error connecting to backend. Is the Python server running?',
          duration: 5000,
          color: 'danger',
          position: 'middle'
      });
      await toast.present();
    } finally {
      this.depCheckBoxes = new Array(this.depItemList.length).fill(false);
      // Dismiss loading indicator
      await loading.dismiss();
    }
  }

  private getPlatformBackendUrl(): string {
      const device = Capacitor.getPlatform();
      switch (device) {
          case 'android':
              return 'http://10.0.2.2:8000';
          //The ios simulator can't access localhost or the android way, so
          //access local ip address, this is Vova's here at time of coding
              // Also use 'uvicorn main:app --reload --host 192.168.1.100 --port 8000'
              // if running for ios
          case 'ios': 
              return 'http://192.168.178.167:8000';
          default:
              return 'http://localhost:8000';
      }
  }

  // On departure select change, change the visible screen
  public handleChange() {
    this.updateViewPage();
  }

  private updateViewPage() {
    for (let page of this.page_list!) {
      // Use ElementRef to access the nativeElement and its id
      if (page.nativeElement.id === this.selectedStage) {
        page.nativeElement.style.display = "block";
      } else {
        page.nativeElement.style.display = "none";
      }
    }
  }

    // Kept remove functions, but they now remove from the generated lists
  removePre(item : RelocationTask){
    const index = this.preItemList.indexOf(item);
    if (index > -1) {
      this.preItemList.splice(index, 1);
      this.preCheckBoxes.splice(index,1);
    }
  }
  removeDep(item : RelocationTask){
    const index = this.depItemList.indexOf(item);
    if (index > -1) {
      this.depItemList.splice(index, 1);
      this.depCheckBoxes.splice(index,1);
    }
  }
  removeArr(item : RelocationTask){
    const index = this.arrItemList.indexOf(item);
    if (index > -1) {
      this.arrItemList.splice(index, 1);
      this.arrCheckBoxes.splice(index,1);
    }
  }

  markCheckPre(item : RelocationTask){
    const index = this.preItemList.indexOf(item);
    if(index > -1){
      this.preCheckBoxes[index] = !this.preCheckBoxes[index];
    }
  }
  markCheckDep(item : RelocationTask){
    const index = this.depItemList.indexOf(item);
    if(index > -1){
      this.depCheckBoxes[index] = !this.depCheckBoxes[index];
    }
  }
  markCheckArr(item : RelocationTask){
    const index = this.arrItemList.indexOf(item);
    if(index > -1){
      this.arrCheckBoxes[index] = !this.arrCheckBoxes[index];
    }
  }

  getCheckStatusPre(item : RelocationTask): boolean{
    const index = this.preItemList.indexOf(item);
    return index > -1 ? this.preCheckBoxes[index] : false;
  }
  getCheckStatusDep(item : RelocationTask): boolean{
    const index = this.depItemList.indexOf(item);
    return index > -1 ? this.depCheckBoxes[index] : false;
  }
  getCheckStatusArr(item : RelocationTask): boolean{
    const index = this.arrItemList.indexOf(item);
    return index > -1 ? this.arrCheckBoxes[index] : false;
  }
}