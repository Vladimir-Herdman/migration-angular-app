// src/app/tabs/tab_checklist/tab_checklist.page.ts
import { Component, ElementRef, ViewChild, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormDataService } from 'src/app/tabs/tab_quiz/form-data.service';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { LoadingController, ToastController, AlertController, ModalController, IonicModule } from '@ionic/angular';
import { DatabaseService } from 'src/app/services/database.service';
import { AuthService } from 'src/app/services/auth.service';
import { Storage } from '@ionic/storage-angular';
import { TaskDetailModalPage } from '../../modals/task-detail-modal/task-detail-modal.page';
import { AddTaskModalPage } from '../../modals/add-task-modal/add-task-modal.page';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountButtonComponent } from 'src/app/components/account-button/account-button.component';


// --- Keep existing interfaces ---
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
  importance_explanation_summary?: string;
  recommended_services: ServiceRecommendation[];
  isExpanded?: boolean;
  completed?: boolean;
  isImportant?: boolean;
  task_id?: string;
  stage?: string;
  category?: string;
  notes?: string;
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
  standalone: true,
  imports: [
    IonicModule,
    CommonModule,
    FormsModule,
    HttpClientModule,
    AccountButtonComponent, // Assuming standalone
    RouterLink, // Needed for routerLink in template
    // Modals are typically loaded via ModalController, not directly imported here unless also standalone and used in template directly
  ]
})
export class TabChecklistPage implements OnInit, AfterViewInit, OnDestroy {
   formData: any;
  selectedStage = "predeparture";

  checklistData: ChecklistByStageAndCategory = {
    predeparture: [],
    departure: [],
    arrival: []
  };
  displayedChecklistData: ChecklistByStageAndCategory = {
    predeparture: [],
    departure: [],
    arrival: []
  };

  private formDataSubscription!: Subscription;
  private backendUrl: string = '';

  isQuestionnaireFilled: boolean = false;
  isGeneratingChecklist: boolean = false;

  totalTasksToGenerate: number = 0; // Total tasks based on original full checklist
  generatedTasksCount: number = 0; // Tasks processed during generation stream
  totalCompletedTasks: number = 0; // Total completed from original full checklist

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
  private readonly CACHED_CHECKLIST_KEY_BASE = `cachedChecklist_v3`; // 3rd time deleting this shit and going back to it because I am stubborn
  private readonly CACHED_FORM_DATA_KEY_BASE = `cachedFormDataForChecklist_v3`;
  private CACHED_CHECKLIST_KEY = '';
  private CACHED_FORM_DATA_KEY = '';


  currentSort: 'none' | 'priority' | 'dueDate' = 'none';
  searchTerm: string = '';
  filterStatus: 'all' | 'incomplete' | 'completed' = 'all';
  filterPriority: 'all' | 'High' | 'Medium' | 'Low' = 'all';
  filterFavorites: boolean = false;


  constructor(
    private formDataService: FormDataService,
    private http: HttpClient,
    private toastController: ToastController,
    private alertController: AlertController,
    private databaseService: DatabaseService,
    private storage: Storage,
    private changeDetectorRef: ChangeDetectorRef,
    public authService: AuthService,
    private modalController: ModalController,
    private router: Router
  ) {}

  public getDisplayedCategoriesForStage(stageKey: string): TaskCategory[] {
  // Ensure stageKey is a valid key of ChecklistByStageAndCategory
  if (stageKey === 'predeparture' || stageKey === 'departure' || stageKey === 'arrival') {
    // Use 'as keyof...' for type safety when accessing the object property
    return this.displayedChecklistData[stageKey as keyof ChecklistByStageAndCategory] || [];
  }
  return [];
}

public getTotalDisplayedTasksForStage(stageKey: string): number {
  const categories = this.getDisplayedCategoriesForStage(stageKey);
  // Explicitly type accumulator and category in reduce for clarity
  return categories.reduce((acc: number, cat: TaskCategory) => acc + (cat.tasks?.length || 0), 0);
}

  async ngOnInit() {
    this.backendUrl = await this.databaseService.getPlatformBackendUrl();
    console.log('Checklist Page Initialized. Backend URL:', this.backendUrl);
    await this.storage.create();

    // Set user-specific cache keys
    const userEmailPrefix = this.authService.email_key.replace(/[^a-zA-Z0-9]/g, '_') || 'default_user';
    this.CACHED_CHECKLIST_KEY = `${userEmailPrefix}_${this.CACHED_CHECKLIST_KEY_BASE}`;
    this.CACHED_FORM_DATA_KEY = `${userEmailPrefix}_${this.CACHED_FORM_DATA_KEY_BASE}`;
  }

  async ngAfterViewInit() {
    this.formDataSubscription = this.formDataService.formData$.subscribe(async form => {
      this.formData = form;
      const wasQuestionnaireFilled = this.isQuestionnaireFilled;
      this.isQuestionnaireFilled = this.checkIfQuestionnaireFilled(form);

      if (this.isQuestionnaireFilled) {
          if (!wasQuestionnaireFilled || JSON.stringify(form) !== JSON.stringify(this.cachedFormData)) {
               await this.loadCachedChecklistOrGenerate(form);
          } else {
              console.log("Questionnaire filled, but data unchanged. Using current checklist.");
               this.updateStageProgressAndLabelsFromData(this.checklistData);
               this.applyFiltersAndSearch();
          }
      } else {
          this.clearChecklist();
          this.applyFiltersAndSearch();
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
            await this.loadCachedChecklistOrGenerate(initialForm);
        } else {
             this.isQuestionnaireFilled = false;
             this.clearChecklist();
             this.applyFiltersAndSearch();
        }
    } else {
         this.isQuestionnaireFilled = false;
         this.clearChecklist();
         this.applyFiltersAndSearch();
    }
  }

  ngOnDestroy() {
    if (this.formDataSubscription) {
      this.formDataSubscription.unsubscribe();
    }
  }

  updateStageProgressAndLabelsFromData(sourceData: ChecklistByStageAndCategory) {
    Object.keys(this.stageProgress).forEach(stageKey => {
      const stageCategories = sourceData[stageKey as keyof ChecklistByStageAndCategory];
      let current = 0;
      let total = 0;
      if (stageCategories) {
        stageCategories.forEach(cat => {
          total += cat.tasks.length;
          current += cat.tasks.filter(t => t.completed).length;
        });
      }
      this.stageProgress[stageKey].current = current;
      this.stageProgress[stageKey].total = total;
    });
    this.updateOverallProgress();
  }


  checkIfQuestionnaireFilled(form: any): boolean {
      return form && form.moveType && form.destination && form.moveDate;
  }

  generateSummary(explanation: string | undefined, maxLength: number = 100): string {
    if (!explanation) return 'Tap "More Info" for details.';
    if (explanation.length <= maxLength) return explanation;
    return explanation.substring(0, maxLength - 3) + '...';
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
          Object.values(this.checklistData).forEach((stage: TaskCategory[]) => {
            stage.forEach((category: TaskCategory) => {
                category.tasks.forEach((task: RelocationTask) => {
                    task.importance_explanation_summary = this.generateSummary(task.importance_explanation);
                    task.isImportant = task.isImportant || false;
                    task.notes = task.notes || ''; // Ensure notes property exists
                });
            });
          });
          this.updateStageProgressAndLabelsFromData(this.checklistData);
          this.applyFiltersAndSearch();

           if (this.totalTasksToGenerate > 0) { // totalTasksToGenerate is updated in updateOverallProgress
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
    this.totalCompletedTasks = 0;
    this.workingOnStage = '';
    this.stageProgress = { predeparture: { current: 0, total: 0 }, departure: { current: 0, total: 0 }, arrival: { current: 0, total: 0 } };
    this.updateStageLabelsBasedOnOriginalData();
  }

  public async generateChecklist(form: any) {
    this.isGeneratingChecklist = true;
    this.clearChecklist();

    try {
      const response = await fetch(`${this.backendUrl}/generate_tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      if (!response.body) {
        this.showToast('Checklist generation failed: No response body.', 'danger');
        this.isGeneratingChecklist = false;
        this.applyFiltersAndSearch();
        this.updateStageLabelsBasedOnOriginalData();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let partialData = '';
      this.generatedTasksCount = 0;

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
              if (data.total_tasks !== undefined && data.stage_totals !== undefined) {
                this.totalTasksToGenerate = data.total_tasks; // This is the true total
                Object.assign(this.stageProgress, {
                    predeparture: { current: 0, total: data.stage_totals.predeparture || 0 },
                    departure: { current: 0, total: data.stage_totals.departure || 0 },
                    arrival: { current: 0, total: data.stage_totals.arrival || 0 }
                });
                this.updateStageLabelsBasedOnOriginalData();
              } else {
                const taskData = data;
                const stageKey = taskData.stage as keyof ChecklistByStageAndCategory;
                const categoryName = taskData.category || 'General';

                if (stageKey && this.checklistData[stageKey]) {
                  let category = this.checklistData[stageKey].find(cat => cat.name === categoryName);
                  if (!category) {
                    category = { name: categoryName, tasks: [], isExpanded: false };
                    this.checklistData[stageKey].push(category);
                    this.checklistData[stageKey].sort((a, b) => a.name.localeCompare(b.name));
                  }
                  const newTask: RelocationTask = {
                      task_id: taskData.task_id,
                      task_description: taskData.task_description,
                      priority: taskData.priority,
                      due_date: taskData.due_date,
                      importance_explanation: taskData.importance_explanation,
                      importance_explanation_summary: this.generateSummary(taskData.importance_explanation),
                      recommended_services: taskData.recommended_services,
                      isExpanded: false,
                      completed: false,
                      isImportant: false,
                      stage: stageKey,
                      category: categoryName,
                      notes: ''
                  };
                  category.tasks.push(newTask);
                  this.generatedTasksCount++;
                  this.workingOnStage = stageKey;
                  this.changeDetectorRef.detectChanges();
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
      this.updateStageProgressAndLabelsFromData(this.checklistData);
      this.applyFiltersAndSearch();
      this.saveChecklistToCache();
    }
  }

    async regenerateChecklist() {
        if (this.isGeneratingChecklist || !this.isQuestionnaireFilled) return;
        const confirmationAlert = await this.alertController.create({
             header: 'Regenerate Checklist?',
             message: 'This will clear your current checklist and generate a new one. Completed tasks, favorites, and notes will be lost.',
             buttons: [
                 { text: 'Cancel', role: 'cancel' },
                 {
                     text: 'Regenerate',
                     id: 'confirm-button',
                     handler: async () => {
                         const latestFormData = await this.formDataService.getForm();
                         if (latestFormData) {
                             this.generateChecklist(latestFormData);
                         } else {
                             this.showToast('Could not retrieve questionnaire data.', 'danger');
                         }
                     }
                 }
             ]
         });
         await confirmationAlert.present();
    }

  public handleChange() {
    this.applyFiltersAndSearch();
  }

  toggleCategory(category: TaskCategory) {
    category.isExpanded = !category.isExpanded;
    this.changeDetectorRef.detectChanges();
  }

  showTaskDetails(item: RelocationTask) {
      const stageKey = this.selectedStage as keyof ChecklistByStageAndCategory;
      this.displayedChecklistData[stageKey].forEach(category => {
          category.tasks.forEach(task => {
              if (task.task_id !== item.task_id && task.isExpanded) {
                  task.isExpanded = false;
              }
          });
      });
      item.isExpanded = !item.isExpanded;
      this.changeDetectorRef.detectChanges();
  }

  markCheck(item : RelocationTask, stageKeyStr: string, categoryName: string){
      const stageKey = stageKeyStr as keyof ChecklistByStageAndCategory;
      const taskInOriginalData = this.findTaskInOriginalData(item.task_id, stageKey, categoryName);
      if (taskInOriginalData) {
          taskInOriginalData.completed = !taskInOriginalData.completed;
          item.completed = taskInOriginalData.completed;

          this.stageProgress[stageKey].current += taskInOriginalData.completed ? 1 : -1;
          this.updateOverallProgress();
          this.updateStageLabelsBasedOnOriginalData();
          this.saveChecklistToCache();
          this.applyFiltersAndSearch();
          this.changeDetectorRef.detectChanges();
      }
  }

  getCheckStatus(item : RelocationTask): boolean{
      const taskInOriginalData = this.findTaskInOriginalData(item.task_id, item.stage as keyof ChecklistByStageAndCategory, item.category);
      return taskInOriginalData?.completed || false;
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

    removeItem(item : RelocationTask, stageKeyStr: string, categoryName: string){
        const stageKey = stageKeyStr as keyof ChecklistByStageAndCategory;
        const categoryInOriginal = this.checklistData[stageKey].find(cat => cat.name === categoryName);
        if (categoryInOriginal) {
            const index = categoryInOriginal.tasks.findIndex(t => t.task_id === item.task_id);
            if (index > -1) {
                const removedTask = categoryInOriginal.tasks.splice(index, 1)[0];
                if (removedTask.completed) this.stageProgress[stageKey].current--;
                this.stageProgress[stageKey].total--;

                if (categoryInOriginal.tasks.length === 0 && categoryInOriginal.name !== 'General') {
                     const categoryIndexInOriginal = this.checklistData[stageKey].indexOf(categoryInOriginal);
                     this.checklistData[stageKey].splice(categoryIndexInOriginal, 1);
                }
                this.updateOverallProgress();
                this.updateStageLabelsBasedOnOriginalData();
                this.saveChecklistToCache();
                this.applyFiltersAndSearch();
                this.changeDetectorRef.detectChanges();
            }
        }
    }

  sortTasks(sortBy: 'priority' | 'dueDate') {
    this.currentSort = sortBy;
    const currentStageKey = this.selectedStage as keyof ChecklistByStageAndCategory;

    if (this.checklistData[currentStageKey]) {
        this.checklistData[currentStageKey].forEach(category => {
            this.sortCategoryTasks(category, sortBy);
        });
    }
    this.applyFiltersAndSearch();
    this.changeDetectorRef.detectChanges();
  }

  sortCategoryTasks(category: TaskCategory, sortBy: 'priority' | 'dueDate') {
    if (sortBy === 'priority') {
        const priorityOrder: { [key: string]: number } = { 'High': 1, 'Medium': 2, 'Low': 3 };
        category.tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    } else if (sortBy === 'dueDate') {
        category.tasks.sort((a, b) => a.due_date.localeCompare(b.due_date));
    }
  }

    async saveChecklistToCache() {
        await this.storage.set(this.CACHED_CHECKLIST_KEY, this.checklistData);
        await this.storage.set(this.CACHED_FORM_DATA_KEY, this.formData);
        this.cachedFormData = this.formData;
    }

  updateStageLabelsBasedOnOriginalData() {
    const stages: (keyof ChecklistByStageAndCategory)[] = ['predeparture', 'departure', 'arrival'];
    stages.forEach(stageKey => {
        const originalStageCategories = this.checklistData[stageKey];
        let current = 0;
        let total = 0;

        if (originalStageCategories) {
            originalStageCategories.forEach(cat => {
                total += cat.tasks.length;
                current += cat.tasks.filter(t => t.completed).length;
            });
        }

        this.stageProgress[stageKey].current = current;
        this.stageProgress[stageKey].total = total;

        const stageName = stageKey.charAt(0).toUpperCase() + stageKey.slice(1);
        const labelKey = `${stageKey}Label` as 'predepartureLabel' | 'departureLabel' | 'arrivalLabel';

        if (this.isGeneratingChecklist && this.totalTasksToGenerate > 0) {
             this[labelKey] = `${stageName} (${this.generatedTasksCount}/${this.totalTasksToGenerate} gen...)`;
        } else if (total > 0 && current === total) {
             this[labelKey] = `${stageName} (${total})`;
        } else if (total === 0 && this.isQuestionnaireFilled) {
            this[labelKey] = `${stageName} (0)`;
        } else if (total === 0 && !this.isQuestionnaireFilled) {
            this[labelKey] = stageName;
        } else {
             this[labelKey] = `${stageName} (${current}/${total})`;
        }
    });
    this.changeDetectorRef.detectChanges();
  }

  updateOverallProgress() {
      this.totalTasksToGenerate = 0;
      this.totalCompletedTasks = 0;
      const stages: (keyof ChecklistByStageAndCategory)[] = ['predeparture', 'departure', 'arrival'];
      stages.forEach(stageKey => {
          if (this.checklistData[stageKey]) {
              this.checklistData[stageKey].forEach(category => {
                  this.totalTasksToGenerate += category.tasks.length;
                  this.totalCompletedTasks += category.tasks.filter(t => t.completed).length;
              });
          }
      });
      this.updateStageLabelsBasedOnOriginalData();
  }

  async openDetailedTaskModal(task: RelocationTask) {
    const modal = await this.modalController.create({
      component: TaskDetailModalPage,
      componentProps: {
        taskData: { ...task }
      }
    });
    await modal.present();

    const { data, role } = await modal.onWillDismiss();
    const originalTask = this.findTaskInOriginalData(task.task_id, task.stage as keyof ChecklistByStageAndCategory, task.category);

    if (originalTask) {
      if (role === 'confirm' && data) {
          let changed = false;
          if (data.isImportant !== undefined && originalTask.isImportant !== data.isImportant) {
              originalTask.isImportant = data.isImportant;
              changed = true;
          }
          if (data.due_date !== undefined && originalTask.due_date !== data.due_date) {
               try { // Attempt to format date nicely if possible
                   originalTask.due_date = data.due_date ? new Date(data.due_date).toLocaleDateString() : 'Not set';
               } catch (e) {
                   originalTask.due_date = data.due_date; // Fallback to raw string if formatting fails
               }
              changed = true;
          }
          if (data.notes !== undefined && originalTask.notes !== data.notes) {
              originalTask.notes = data.notes;
              changed = true;
          }
          if (changed) {
              this.saveChecklistToCache();
              this.applyFiltersAndSearch();
              this.changeDetectorRef.detectChanges();
          }
      } else if (role === 'askChatbot' && data?.taskDescription) {
        this.router.navigate(['/tabs/tab_chatbot'], { queryParams: { prefill: data.taskDescription } });
      }
    }
  }

  findTaskInOriginalData(taskId: string | undefined, stageKey?: keyof ChecklistByStageAndCategory, categoryName?: string): RelocationTask | undefined {
    if (!taskId || !stageKey || !categoryName) return undefined;
    const stageData = this.checklistData[stageKey];
    if (stageData) {
        const category = stageData.find(cat => cat.name === categoryName);
        if (category) {
            return category.tasks.find(t => t.task_id === taskId);
        }
    }
    return undefined;
  }

  toggleImportant(item: RelocationTask, stageKeyStr: string, categoryName: string) {
    const stageKey = stageKeyStr as keyof ChecklistByStageAndCategory;
    const taskInOriginalData = this.findTaskInOriginalData(item.task_id, stageKey, categoryName);
    if (taskInOriginalData) {
        taskInOriginalData.isImportant = !taskInOriginalData.isImportant;
        item.isImportant = taskInOriginalData.isImportant;

        this.saveChecklistToCache();
        this.showToast(taskInOriginalData.isImportant ? 'Task marked as important!' : 'Task unmarked as important.', 'secondary');
        if (this.filterFavorites) this.applyFiltersAndSearch();
        this.changeDetectorRef.detectChanges();
    }
  }

  async presentFilterPopover() {
    // Using the AlertController approach defined previously
    const alertInputs: any[] = [ // Explicitly type as any[] for custom structure
            { type: 'radio', label: 'By Status:', value: 'sep_status_header', disabled: true, name: 'sep_status_name_header'},
            { name: 'statusFilterValue', type: 'radio', label: 'All', value: 'all', checked: this.filterStatus === 'all' },
            { name: 'statusFilterValue', type: 'radio', label: 'Incomplete', value: 'incomplete', checked: this.filterStatus === 'incomplete' },
            { name: 'statusFilterValue', type: 'radio', label: 'Completed', value: 'completed', checked: this.filterStatus === 'completed' },
            { type: 'radio', label: 'By Priority:', value: 'sep_priority_header', disabled: true, name: 'sep_priority_name_header'},
            { name: 'priorityFilterValue', type: 'radio', label: 'All', value: 'all', checked: this.filterPriority === 'all' },
            { name: 'priorityFilterValue', type: 'radio', label: 'High', value: 'High', checked: this.filterPriority === 'High' },
            { name: 'priorityFilterValue', type: 'radio', label: 'Medium', value: 'Medium', checked: this.filterPriority === 'Medium' },
            { name: 'priorityFilterValue', type: 'radio', label: 'Low', value: 'Low', checked: this.filterPriority === 'Low' },
            { type: 'radio', label: 'By Favorites:', value: 'sep_favorites_header', disabled: true, name: 'sep_favorites_name_header'},
            { name: 'favoritesFilterValue', type: 'checkbox', label: 'Show Only Favorites', value: 'isFavorite', checked: this.filterFavorites },
        ];

    const alert = await this.alertController.create({
        header: 'Filter Tasks',
        inputs: alertInputs, // Pass the structured inputs
        buttons: [
            { text: 'Cancel', role: 'cancel' },
            {
                text: 'Apply',
                handler: (data) => {
                     // Check if data exists and handle values.
                     // AlertController returns an array for checkboxes if multiple,
                     // or the value string for radio buttons.
                     // Since checkbox is single, data will be undefined if unchecked, or its value ('isFavorite') if checked.
                     // Radio values are straightforward.
                     // We need to find the selected radio value among the possible values.
                     const statusValues = ['all', 'incomplete', 'completed'];
                     const priorityValues = ['all', 'High', 'Medium', 'Low'];

                     let statusVal = this.filterStatus; // Default to current
                     let priorityVal = this.filterPriority; // Default to current
                     let favVal = this.filterFavorites; // Default to current

                     if (Array.isArray(data)) { // Checkbox was likely involved
                         favVal = data.includes('isFavorite');
                         // Find radio values within the array if present
                         statusVal = data.find(d => statusValues.includes(d)) || statusVal;
                         priorityVal = data.find(d => priorityValues.includes(d)) || priorityVal;
                     } else if (typeof data === 'string') { // Only radio buttons were interacted with
                         if (statusValues.includes(data)) statusVal = data as any;
                         if (priorityValues.includes(data)) priorityVal = data as any;
                         // Checkbox state wouldn't change if only radio was clicked
                     }
                    
                     // Assign the determined values
                     this.filterStatus = statusVal;
                     this.filterPriority = priorityVal;
                     this.filterFavorites = favVal;

                     this.applyFiltersAndSearch();
                },
            },
        ],
    });
    await alert.present();
  }

  applyFiltersAndSearch() {
    if (!this.isQuestionnaireFilled) {
        this.displayedChecklistData = { predeparture: [], departure: [], arrival: [] };
        this.updateStageLabelsBasedOnOriginalData();
        return;
    }
    const stages: (keyof ChecklistByStageAndCategory)[] = ['predeparture', 'departure', 'arrival'];
    stages.forEach(stageKey => {
        if (!this.checklistData[stageKey]) {
            this.displayedChecklistData[stageKey] = [];
            return;
        }
        this.displayedChecklistData[stageKey] = this.checklistData[stageKey]
            .map(category => {
                const filteredTasks = category.tasks.filter(task => {
                    const searchMatch = this.searchTerm === '' || task.task_description.toLowerCase().includes(this.searchTerm.toLowerCase()) || (task.notes && task.notes.toLowerCase().includes(this.searchTerm.toLowerCase()));
                    const statusMatch = this.filterStatus === 'all' ||
                                        (this.filterStatus === 'completed' && task.completed) ||
                                        (this.filterStatus === 'incomplete' && !task.completed);
                    const priorityMatch = this.filterPriority === 'all' || task.priority === this.filterPriority;
                    const favoriteMatch = !this.filterFavorites || task.isImportant;

                    return searchMatch && statusMatch && priorityMatch && favoriteMatch;
                });
                if (filteredTasks.length > 0) {
                     return { ...category, tasks: filteredTasks, isExpanded: category.isExpanded };
                }
                return null;
            })
            .filter(category => category !== null) as TaskCategory[];
    });
    this.updateStageLabelsBasedOnOriginalData();
    this.changeDetectorRef.detectChanges();
  }

  async openAddTaskModal() {
      const existingCategoriesByStage: { [key: string]: string[] } = {
        predeparture: this.checklistData.predeparture.map(cat => cat.name).sort(),
        departure: this.checklistData.departure.map(cat => cat.name).sort(),
        arrival: this.checklistData.arrival.map(cat => cat.name).sort(),
      };

      const modal = await this.modalController.create({
        component: AddTaskModalPage,
        componentProps: { existingCategories: existingCategoriesByStage }
      });
      await modal.present();

      const { data, role } = await modal.onWillDismiss();
      if (role === 'confirm' && data) {
        const newTaskData = data;
        const newTask: RelocationTask = {
          task_id: `custom_${new Date().getTime()}`,
          task_description: newTaskData.task_description,
          priority: newTaskData.priority,
          due_date: newTaskData.due_date ? new Date(newTaskData.due_date).toLocaleDateString() : 'Not set',
          importance_explanation: 'This is a custom task you added.',
          importance_explanation_summary: 'Custom task.',
          recommended_services: [],
          isExpanded: false,
          completed: false,
          isImportant: false,
          stage: newTaskData.stage,
          category: newTaskData.category,
          notes: ''
        };

        const stageKey = newTask.stage as keyof ChecklistByStageAndCategory;
        let categoryObj = this.checklistData[stageKey].find(cat => cat.name.toLowerCase() === newTask.category?.toLowerCase());

        if (!categoryObj) {
          categoryObj = { name: newTask.category!, tasks: [], isExpanded: true };
          this.checklistData[stageKey].push(categoryObj);
          this.checklistData[stageKey].sort((a, b) => a.name.localeCompare(b.name));
        }
        categoryObj.tasks.push(newTask);
        if (this.currentSort !== 'none') { this.sortCategoryTasks(categoryObj, this.currentSort); }

        this.updateOverallProgress();
        this.saveChecklistToCache();
        this.applyFiltersAndSearch();
        this.showToast('Custom task added!', 'success');
      }
    }

  areAllTasksComplete(category: TaskCategory): boolean {
      if (!category.tasks || category.tasks.length === 0) return false;
      return category.tasks.every(task => task.completed);
  }
}