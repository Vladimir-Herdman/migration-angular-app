import { Component, ElementRef, ViewChild, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormDataService } from 'src/app/components/quiz/form-data.service';
import { Capacitor } from '@capacitor/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { LoadingController, ToastController, AlertController } from '@ionic/angular';
import { DatabaseService } from 'src/app/services/database.service';
import { AuthService } from 'src/app/services/auth.service';
import { Storage } from '@ionic/storage-angular';

interface ServiceRecommendation {
  service_id: string;
  name: string;
  description: string;
  url: string;
}

interface RelocationTask {
  task_description: string;
  priority: 'High' | 'Medium' | 'Low';
  due_date: string;
  importance_explanation?: string;
  recommended_services: ServiceRecommendation[];
  isExpanded?: boolean;
  completed?: boolean;
}

interface TaskCategory {
  name: string;
  tasks: RelocationTask[];
  isExpanded?: boolean;
}

interface ChecklistByStageAndCategory {
  predeparture: TaskCategory[];
  departure: TaskCategory[];
  arrival: TaskCategory[];
}

@Component({
  selector: 'app-tab_checklist',
  templateUrl: 'tab_checklist.page.html',
  styleUrls: ['tab_checklist.page.scss'],
  standalone: false,
})
export class TabChecklistPage implements OnInit, AfterViewInit, OnDestroy {
  formData: any;
  selectedStage = "predeparture";

  checklistData: ChecklistByStageAndCategory = {
    predeparture: [],
    departure: [],
    arrival: []
  };

  private formDataSubscription!: Subscription;
  private backendUrl: string = '';

  isQuestionnaireFilled: boolean = false;
  isGeneratingChecklist: boolean = false;

  totalTasksToGenerate: number = 0;
  generatedTasksCount: number = 0;
  workingOnStage: string = '';
  stageProgress: { [key: string]: { current: number, total: number } } = {
    predeparture: { current: 0, total: 0 },
    departure: { current: 0, total: 0 },
    arrival: { current: 0, total: 0 }
  };

  predepartureLabel: string = 'Predeparture';
  departureLabel: string = 'Departure';
  arrivalLabel: string = 'Arrival';

  private cachedFormData: any = null;
  private readonly CACHED_CHECKLIST_KEY = `${this.authService.email_key}_cachedChecklist`;
  private readonly CACHED_FORM_DATA_KEY = `${this.authService.email_key}_cachedFormDataForChecklist`;

  currentSort: 'none' | 'priority' | 'dueDate' = 'none';


  constructor(
    private formDataService: FormDataService,
    private http: HttpClient,
    private toastController: ToastController,
    private alertController: AlertController,
    private databaseService: DatabaseService,
    private storage: Storage,
    private changeDetectorRef: ChangeDetectorRef,
    private authService: AuthService,
  ) {}

  async ngOnInit() {
    this.backendUrl = await this.databaseService.getPlatformBackendUrl();
    await this.storage.create();
  }

  async ngAfterViewInit() {
    this.formDataSubscription = this.formDataService.formData$.subscribe(form => {
      this.formData = form;
      const wasQuestionnaireFilled = this.isQuestionnaireFilled;
      this.isQuestionnaireFilled = this.checkIfQuestionnaireFilled(form);

      if (this.isQuestionnaireFilled) {
          if (!wasQuestionnaireFilled || JSON.stringify(form) !== JSON.stringify(this.cachedFormData)) {
               this.loadCachedChecklistOrGenerate(form);
          } else {
              console.log("Questionnaire filled, but data unchanged. Using current checklist.");
               Object.keys(this.checklistData).forEach(stageKey => {
                    const stage = this.checklistData[stageKey as keyof ChecklistByStageAndCategory];
                    this.stageProgress[stageKey].total = stage.reduce((sum, category) => sum + category.tasks.length, 0);
                    this.stageProgress[stageKey].current = stage.reduce((sum, category) => sum + category.tasks.filter(t => t.completed).length, 0);
               });
               this.totalTasksToGenerate = Object.values(this.stageProgress).reduce((sum, stage) => sum + stage.total, 0);
               this.generatedTasksCount = Object.values(this.stageProgress).reduce((sum, stage) => sum + stage.current, 0);
               this.updateStageLabels();
          }
      } else {
          this.clearChecklist();
          if (wasQuestionnaireFilled) {
             this.showToast('Please fill out the questionnaire to generate your personalized checklist.', 'warning');
          }
      }
    });

    const initialForm = await this.formDataService.getForm();
    if (initialForm) {
        this.formData = initialForm;
        this.isQuestionnaireFilled = this.checkIfQuestionnaireFilled(initialForm);
        if (this.isQuestionnaireFilled) {
            this.loadCachedChecklistOrGenerate(initialForm);
        } else {
             this.isQuestionnaireFilled = false;
             this.clearChecklist();
        }
    } else {
         this.isQuestionnaireFilled = false;
         this.clearChecklist();
    }
  }

  ngOnDestroy() {
    if (this.formDataSubscription) {
      this.formDataSubscription.unsubscribe();
    }
  }

  checkIfQuestionnaireFilled(form: any): boolean {
      return this.formDataService.isFilled(form);
  }

  async loadCachedChecklistOrGenerate(currentForm: any) {
      const cachedChecklist = await this.storage.get(this.CACHED_CHECKLIST_KEY);
      this.cachedFormData = await this.storage.get(this.CACHED_FORM_DATA_KEY);

      const formDataChanged = JSON.stringify(currentForm) !== JSON.stringify(this.cachedFormData);

      if (cachedChecklist && !formDataChanged) {
          console.log("Loading cached checklist.");
          this.checklistData = {
              predeparture: cachedChecklist.predeparture || [],
              departure: cachedChecklist.departure || [],
              arrival: cachedChecklist.arrival || []
          };

          Object.keys(this.checklistData).forEach(stageKey => {
             const stage = this.checklistData[stageKey as keyof ChecklistByStageAndCategory];
             this.stageProgress[stageKey].total = stage.reduce((sum, category) => sum + category.tasks.length, 0);
             this.stageProgress[stageKey].current = stage.reduce((sum, category) => sum + category.tasks.filter(t => t.completed).length, 0);
          });
           this.totalTasksToGenerate = Object.values(this.stageProgress).reduce((sum, stage) => sum + stage.total, 0);
           this.generatedTasksCount = Object.values(this.stageProgress).reduce((sum, stage) => sum + stage.current, 0);
           this.updateStageLabels();

           if (this.totalTasksToGenerate > 0) {
              this.showToast('Checklist loaded from cache.', 'success');
           }

      } else {
          console.log("Generating new checklist (questionnaire changed or no cache).");
          this.generateChecklist(currentForm);
      }
  }

  clearChecklist() {
    this.checklistData = { predeparture: [], departure: [], arrival: [] };
    this.totalTasksToGenerate = 0;
    this.generatedTasksCount = 0;
    this.workingOnStage = '';
    this.stageProgress = { predeparture: { current: 0, total: 0 }, departure: { current: 0, total: 0 }, arrival: { current: 0, total: 0 } };
    this.updateStageLabels();
  }

  public async generateChecklist(form: any) {
    this.isGeneratingChecklist = true;
    this.clearChecklist();
    this.updateStageLabels(); // Set initial labels during generation

    try {
      const response = await fetch(`${this.backendUrl}/generate_tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      if (!response.body) {
        this.showToast('Checklist generation failed: No response body.', 'danger');
        this.isGeneratingChecklist = false;
        this.updateStageLabels();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let partialData = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        partialData += decoder.decode(value, { stream: true });

        const lines = partialData.split('\n');
        partialData = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);

              // Check if this is the initial totals message
              if (data.total_tasks !== undefined && data.stage_totals !== undefined) {
                this.totalTasksToGenerate = data.total_tasks;
                // Initialize stage totals from the backend data
                Object.assign(this.stageProgress, {
                    predeparture: { current: 0, total: data.stage_totals.predeparture || 0 },
                    departure: { current: 0, total: data.stage_totals.departure || 0 },
                    arrival: { current: 0, total: data.stage_totals.arrival || 0 }
                });
                console.log(`Initialized totals: Overall=${this.totalTasksToGenerate}, Stages=`, this.stageProgress);
                this.updateStageLabels(); // Update labels with known totals immediately

              } else {
                // Process as a task item
                const taskData = data;
                const stage = taskData.stage;
                const categoryName = taskData.category || 'default';

                if (stage && this.checklistData[stage as keyof ChecklistByStageAndCategory]) {
                  let category = this.checklistData[stage as keyof ChecklistByStageAndCategory].find(cat => cat.name === categoryName);
                  const isNewCategory = !category;

                  if (isNewCategory) {
                    category = { name: categoryName, tasks: [], isExpanded: false }; // Categories start not expanded

                    // Add the new category using array spread to help change detection
                    this.checklistData[stage as keyof ChecklistByStageAndCategory] = [
                        ...this.checklistData[stage as keyof ChecklistByStageAndCategory],
                        category
                    ];
                    this.checklistData[stage as keyof ChecklistByStageAndCategory].sort((a, b) => a.name.localeCompare(b.name));
                    console.log(`Created new category: ${categoryName} in stage ${stage}`);
                  } else {
                      // If category already exists, use the found reference
                      category = this.checklistData[stage as keyof ChecklistByStageAndCategory].find(cat => cat.name === categoryName);
                  }


                  const newTask: RelocationTask = {
                      task_description: taskData.task_description,
                      priority: taskData.priority,
                      due_date: taskData.due_date,
                      importance_explanation: taskData.importance_explanation,
                      recommended_services: taskData.recommended_services,
                      isExpanded: false, // Task details are not expanded initially
                      completed: false
                  };
                  category!.tasks = [...category!.tasks, newTask]; // Create a new array reference

                  console.log(`Added task "${newTask.task_description}" to ${stage} - ${categoryName}. Category tasks count: ${category!.tasks.length}. Category expanded state: ${category!.isExpanded}`);


                  this.generatedTasksCount++;
                  this.workingOnStage = stage;

                  if (this.stageProgress[stage]) {
                      this.stageProgress[stage].current++; // Update current count per stage
                  }


                  this.updateStageLabels(); // Update labels as tasks are generated
                  this.changeDetectorRef.detectChanges(); // Explicitly trigger change detection
                } else {
                  console.warn(`Received task for unknown stage: ${stage}`);
                }
              }

            } catch (e) {
              console.error('Error parsing streamed JSON:', e, 'Line:', line);
            }
          }
        }
      }

      this.showToast('Checklist generation complete!', 'success');

    } catch (error) {
      console.error('Error generating checklist:', error);
      this.showToast('Error generating checklist. Please try again.', 'danger');
    } finally {
      this.isGeneratingChecklist = false;
      this.workingOnStage = '';
       // Final label update will show completed/total for each stage
      this.updateStageLabels();
      this.saveChecklistToCache();
    }
  }

    // New method to regenerate the checklist
    async regenerateChecklist() {
        if (this.isGeneratingChecklist || !this.isQuestionnaireFilled) {
            // Prevent regeneration if already generating or questionnaire not filled
            return;
        }
        // Use the injected AlertController instance
        const confirmationAlert = await this.alertController.create({
             header: 'Regenerate Checklist?',
             message: 'This will clear your current checklist and generate a new one based on your saved questionnaire answers. Any completed tasks will be lost.',
             buttons: [
                 {
                     text: 'Cancel',
                     role: 'cancel',
                     cssClass: 'secondary',
                     handler: () => {
                         console.log('Regeneration cancelled');
                         return false; // Indicate cancellation
                     }
                 },
                 {
                     text: 'Regenerate',
                     id: 'confirm-button',
                     handler: () => {
                         console.log('Regeneration confirmed');
                         return true; // Indicate confirmation
                     }
                 }
             ]
         });

         await confirmationAlert.present();
         const { role } = await confirmationAlert.onDidDismiss();

         // Check if confirmed (role is 'confirm' or if the confirm button was somehow clicked without a role)
         if (role === 'confirm' || (role === undefined && await confirmationAlert.querySelector('#confirm-button') !== null)) {
             const latestFormData = await this.formDataService.getForm();
             if (latestFormData) {
                 this.generateChecklist(latestFormData);
             } else {
                 this.showToast('Could not retrieve questionnaire data.', 'danger');
             }
         }
    }


  public handleChange() {
    // The view is now updated by iterating through checklistData with [hidden]
    // No need to manually update page display styles here.
  }

  toggleCategory(category: TaskCategory) {
    category.isExpanded = !category.isExpanded;
    this.changeDetectorRef.detectChanges();
  }

  showTaskDetails(item: RelocationTask) {
      let currentStageData: TaskCategory[] = this.checklistData[this.selectedStage as keyof ChecklistByStageAndCategory];

      currentStageData.forEach(category => {
          category.tasks.forEach(task => {
              if (task !== item && task.isExpanded) {
                  task.isExpanded = false;
              }
          });
      });

      item.isExpanded = !item.isExpanded;
      this.changeDetectorRef.detectChanges();
  }

  markCheck(item : RelocationTask, stage: string, categoryName: string){
      item.completed = !item.completed;
       const stageData = this.checklistData[stage as keyof ChecklistByStageAndCategory];
       if (stageData) {
           const category = stageData.find(cat => cat.name === categoryName);
           if (category) {
               if (item.completed) {
                   this.stageProgress[stage].current++;
               } else {
                   this.stageProgress[stage].current--;
               }
           }
       }
      this.updateStageLabels();
      this.saveChecklistToCache();
      this.changeDetectorRef.detectChanges();
  }

  getCheckStatus(item : RelocationTask): boolean{
      return item.completed || false;
  }

    async showToast(message: string, color: string = 'success', duration: number = 2000) {
        const toast = await this.toastController.create({
            message,
            duration,
            color,
            position: 'middle'
        });
        await toast.present();
    }

    removeItem(item : RelocationTask, stage: string, categoryName: string){
        const stageData = this.checklistData[stage as keyof ChecklistByStageAndCategory];
        if (stageData) {
            const category = stageData.find(cat => cat.name === categoryName);
            if (category) {
                const index = category.tasks.indexOf(item);
                if (index > -1) {
                    const removedTask = category.tasks.splice(index, 1)[0];
                     if (removedTask.completed) {
                         this.stageProgress[stage].current--;
                     }
                     this.stageProgress[stage].total--;
                     this.totalTasksToGenerate--;

                    if (category.tasks.length === 0 && category.name !== 'default') {
                         const categoryIndex = stageData.indexOf(category);
                         stageData.splice(categoryIndex, 1);
                    }

                    this.updateStageLabels();
                    this.saveChecklistToCache();
                     this.changeDetectorRef.detectChanges();
                }
            }
        }
    }

    sortTasks(sortBy: 'priority' | 'dueDate') {
      this.currentSort = sortBy;

      const currentStageData = this.checklistData[this.selectedStage as keyof ChecklistByStageAndCategory];

      if (!currentStageData) return;

      currentStageData.forEach(category => {
        if (sortBy === 'priority') {
          const priorityOrder: { [key: string]: number } = { 'High': 1, 'Medium': 2, 'Low': 3 };
          category.tasks.sort((a, b) => {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          });
        } else if (sortBy === 'dueDate') {
          category.tasks.sort((a, b) => {
            const dateA = new Date(a.due_date);
            const dateB = new Date(b.due_date);
            if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
            if (isNaN(dateA.getTime())) return 1;
            if (isNaN(dateB.getTime())) return -1;
            return dateA.getTime() - dateB.getTime();
          });
        }
      });

      this.changeDetectorRef.detectChanges();
    }

    async saveChecklistToCache() {
        const fullChecklistToCache = this.checklistData;
        await this.storage.set(this.CACHED_CHECKLIST_KEY, fullChecklistToCache);
        await this.storage.set(this.CACHED_FORM_DATA_KEY, this.formData);
        this.cachedFormData = this.formData;
    }

    updateStageLabels() {
        const stages: ('predeparture' | 'departure' | 'arrival')[] = ['predeparture', 'departure', 'arrival'];
        stages.forEach(stage => {
            const current = this.stageProgress[stage].current;
            const total = this.stageProgress[stage].total;
            const stageName = stage.charAt(0).toUpperCase() + stage.slice(1);

            const labelKey: 'predepartureLabel' | 'departureLabel' | 'arrivalLabel' = `${stage}Label` as 'predepartureLabel' | 'departureLabel' | 'arrivalLabel';

            // Only show fraction if total is known (i.e., after the initial totals message)
            if (this.isGeneratingChecklist && total > 0) {
                 this[labelKey] = `${stageName} ${current}/${total}`;
            } else if (this.isGeneratingChecklist && total === 0) {
                 // Before stage totals are known, just show name or generating indicator
                 this[labelKey] = `${stageName}...`; // Or simply = stageName;
            }
            else {
                 // After generation (isGeneratingChecklist is false), show completed/total
                 if (total > 0 && current === total) {
                      this[labelKey] = `${stageName} ${total}`;
                 } else if (total === 0) {
                     this[labelKey] = stageName;
                 } else {
                      this[labelKey] = `${stageName} ${current}/${total}`;
                 }
            }
        });
        this.changeDetectorRef.detectChanges();
    }
}
