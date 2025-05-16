import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormDataService } from 'src/app/components/quiz/form-data.service';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { LoadingController, ToastController, AlertController, ModalController, IonicModule, PopoverController } from '@ionic/angular';
import { DatabaseService } from 'src/app/services/database.service';
import { AuthService } from 'src/app/services/auth.service';
import { Storage } from '@ionic/storage-angular';
import { TaskDetailModalPage } from '../../modals/task-detail-modal/task-detail-modal.page';
import { AddTaskModalPage } from '../../modals/add-task-modal/add-task-modal.page';
import { Router, RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountButtonComponent } from 'src/app/components/account-button/account-button.component';
import { FilterPopoverComponent, ChecklistFilterData } from '../../components/filter-popover/filter-popover.component';
import { filter } from 'rxjs';


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
  due_date: string; // Keep as string from backend, format for display
  importance_explanation?: string;
  importance_explanation_summary?: string;
  recommended_services: ServiceRecommendation[];
  isExpanded?: boolean; // For inline expansion, less relevant if moving to modal-first
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
    AccountButtonComponent,
    RouterLink,
    DatePipe,
    // FilterPopoverComponent is presented via PopoverController, not directly in template
  ],
  providers: [DatePipe] // Add DatePipe to providers
})
export class TabChecklistPage implements OnInit, OnDestroy {
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

  isOpeningDetailedModal = false;
  isOpeningAddTaskModal = false;
  private clickTimeout: any = null;
  private readonly DOUBLE_CLICK_THRESHOLD = 250;

  totalTasksToGenerate: number = 0; 
  generatedTasksCount: number = 0; 
  totalCompletedTasks: number = 0;

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
  public readonly CACHED_CHECKLIST_KEY_BASE = `cachedChecklist_v3`; 
  private readonly CACHED_FORM_DATA_KEY_BASE = `cachedFormDataForChecklist_v3`;  
  private CACHED_CHECKLIST_KEY = '';
  private CACHED_FORM_DATA_KEY = '';


  currentSort: 'none' | 'priority' | 'dueDate' = 'none';
  searchTerm: string = '';
  
  // Default filters
  activeFilters: ChecklistFilterData = {
    status: 'all',
    priority: 'all',
    favorites: false,
  };
  activeFiltersCount: number = 0;


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
    private router: Router,
    private popoverController: PopoverController, // Added PopoverController
    public datePipe: DatePipe // Inject DatePipe
  ) {}

  public getDisplayedCategoriesForStage(stageKey: string): TaskCategory[] {
  if (stageKey === 'predeparture' || stageKey === 'departure' || stageKey === 'arrival') {
    return this.displayedChecklistData[stageKey as keyof ChecklistByStageAndCategory] || [];
  }
  return [];
}

public getTotalDisplayedTasksForStage(stageKey: string): number {
  const categories = this.getDisplayedCategoriesForStage(stageKey);
  return categories.reduce((acc: number, cat: TaskCategory) => acc + (cat.tasks?.length || 0), 0);
}

  async ngOnInit() {
    this.backendUrl = await this.databaseService.getPlatformBackendUrl();
    console.log('Checklist Page Initialized. Backend URL:', this.backendUrl);
    await this.storage.create();

    const userEmailPrefix = this.authService.email_key.replace(/[^a-zA-Z0-9]/g, '_') || 'default_user';
    this.CACHED_CHECKLIST_KEY = `${userEmailPrefix}_${this.CACHED_CHECKLIST_KEY_BASE}`;
    this.CACHED_FORM_DATA_KEY = `${userEmailPrefix}_${this.CACHED_FORM_DATA_KEY_BASE}`;

    this.loadInitialData();
  }

  async loadInitialData() {
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
          // applyFiltersAndSearch is called within clearChecklist
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
    this.updateOverallProgress(); // This will call updateStageLabelsBasedOnOriginalData
  }


  checkIfQuestionnaireFilled(form: any): boolean {
      return this.formDataService.isFilled(form);
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
          Object.values(this.checklistData).flat().forEach((category: TaskCategory) => {
            category.tasks.forEach((task: RelocationTask) => {
                task.importance_explanation_summary = this.generateSummary(task.importance_explanation);
                task.isImportant = task.isImportant || false;
                task.notes = task.notes || '';
            });
          });
          this.updateStageProgressAndLabelsFromData(this.checklistData);
          this.applyFiltersAndSearch(); // Apply default or previously saved filters

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
    this.displayedChecklistData = { predeparture: [], departure: [], arrival: [] };
    this.totalTasksToGenerate = 0;
    this.generatedTasksCount = 0;
    this.totalCompletedTasks = 0;
    this.workingOnStage = '';
    this.stageProgress = { predeparture: { current: 0, total: 0 }, departure: { current: 0, total: 0 }, arrival: { current: 0, total: 0 } };
    this.applyFiltersAndSearch(); // This will update labels via updateOverallProgress
  }

  public async generateChecklist(form: any) {
    this.isGeneratingChecklist = true;
    this.clearChecklist();
    // form.destination = form.destination.translations.en;

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
              if (data.event_type === 'initial_structure') {
                this.totalTasksToGenerate = data.total_applicable_tasks || 0;
                Object.assign(this.stageProgress, {
                    predeparture: { current: 0, total: data.stage_totals?.predeparture || 0 },
                    departure: { current: 0, total: data.stage_totals?.departure || 0 },
                    arrival: { current: 0, total: data.stage_totals?.arrival || 0 }
                });
                this.updateStageLabelsBasedOnOriginalData();
              } else if (data.event_type === 'task_item') {
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
                      due_date: taskData.due_date, // Keep as string
                      importance_explanation: taskData.importance_explanation,
                      importance_explanation_summary: this.generateSummary(taskData.importance_explanation),
                      recommended_services: taskData.recommended_services,
                      isExpanded: false,
                      completed: taskData.completed !== undefined ? taskData.completed : false,
                      isImportant: taskData.isImportant !== undefined ? taskData.isImportant : false,
                      stage: stageKey,
                      category: categoryName,
                      notes: taskData.notes || ''
                  };
                  category.tasks.push(newTask);
                  this.generatedTasksCount++;
                  this.workingOnStage = stageKey;
                  this.updateStageLabelsBasedOnOriginalData();
                  this.changeDetectorRef.detectChanges(); // Trigger change detection for progress bar
                }
              } else if (data.event_type === 'stream_end') {
                console.log(`Stream ended. Total tasks streamed by backend: ${data.total_streamed}`);
              }
            } catch (e) {
              console.error('Error parsing streamed JSON:', e, 'Line:', line);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error generating checklist:', error);
      this.showToast('Error generating checklist. Please try again.', 'danger');
    } finally {
      this.isGeneratingChecklist = false;
      this.workingOnStage = '';

      if (this.generatedTasksCount > 0 && this.generatedTasksCount === this.totalTasksToGenerate) {
          this.showToast('Checklist generation complete!', 'success');
      } else if (this.totalTasksToGenerate > 0 && this.generatedTasksCount < this.totalTasksToGenerate) {
          this.showToast('Checklist generation partially complete. Some tasks might be missing.', 'warning');
      } else if (this.totalTasksToGenerate > 0 && this.generatedTasksCount === 0) {
          this.showToast('Checklist generated, but no tasks match your current criteria.', 'warning');
      } else if (this.totalTasksToGenerate === 0 && this.generatedTasksCount === 0 && this.isQuestionnaireFilled) {
           this.showToast('No tasks applicable to your selections.', 'primary');
      }
      
      this.applyFiltersAndSearch(); // This also calls updateStageProgressAndLabelsFromData
      this.saveChecklistToCache(); 
      this.changeDetectorRef.detectChanges();
    }
  }

    async regenerateChecklist() {
        if (this.isGeneratingChecklist || !this.isQuestionnaireFilled) return;
        const confirmationAlert = await this.alertController.create({
             header: 'Regenerate Checklist?',
             message: 'This will clear your current checklist progress (completed tasks, favorites, notes) and generate a new one based on your latest questionnaire answers. Are you sure?',
             buttons: [
                 { text: 'Cancel', role: 'cancel', cssClass: 'alert-button-cancel' },
                 {
                     text: 'Regenerate',
                     role: 'destructive',
                     cssClass: 'alert-button-destructive',
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
    //this.applyFiltersAndSearch(); // No need to call here, segment change triggers view update
  }

  handleTaskItemClick(item: RelocationTask, event: MouseEvent) {
  // If the click was on the checkbox or the info button, let their specific handlers manage it
  const target = event.target as HTMLElement;
  if (target.closest('.task-checkbox') || target.closest('.info-button')) {
    return;
  }

  // Clear any existing timeout to prevent single click if double click is happening
  if (this.clickTimeout) {
    clearTimeout(this.clickTimeout);
    this.clickTimeout = null;
    // This path is taken on the second click of a double-click pair
    // The dblclick handler will take care of the action
    return;
  }

  // Set a timeout for single click action
  this.clickTimeout = setTimeout(() => {
    this.openDetailedTaskModal(item);
    this.clickTimeout = null; // Reset after action
  }, this.DOUBLE_CLICK_THRESHOLD);
}

// New method to handle double clicks on the task item
handleTaskItemDoubleClick(item: RelocationTask, stageKeyStr: string, categoryName: string, event: MouseEvent) {
  event.preventDefault(); // Prevent any default double-click behavior (like text selection)
  event.stopPropagation(); // Stop event from bubbling further

  // Clear the single click timeout if it's still pending
  if (this.clickTimeout) {
    clearTimeout(this.clickTimeout);
    this.clickTimeout = null;
  }

  // Now, toggle the favorite status
  const originalTask = this.findTaskInOriginalData(item.task_id, stageKeyStr as keyof ChecklistByStageAndCategory, categoryName);

  if (originalTask) {
    originalTask.isImportant = !originalTask.isImportant;
    item.isImportant = originalTask.isImportant; // Sync displayed item

    this.saveChecklistToCache();
    this.applyFiltersAndSearch(); // Re-apply filters if "Show Only Favorites" is active
    this.changeDetectorRef.detectChanges();

    const toastMessage = originalTask.isImportant ? 'Task marked as important!' : 'Task unmarked as important.';
    this.showToast(toastMessage, originalTask.isImportant ? 'success' : 'secondary', 1500);
  }
}

  toggleCategory(categoryFromDisplay: TaskCategory) {
    // The 'categoryFromDisplay' is an object from 'this.displayedChecklistData'.
    // We need to find its corresponding object in 'this.checklistData' (the master list)
    // to ensure the 'isExpanded' state is persisted there.

    // Determine the stage of the categoryFromDisplay.
    // We need a way to know which stage this category belongs to in checklistData.
    // If categoryFromDisplay doesn't have a 'stage' property, we might need to infer it
    // or, ideally, ensure categories carry their stage key.
    // For now, let's assume we can find it by name across all stages, or
    // if you know the current `this.selectedStage`, you can use that.

    let originalCategoryInMasterList: TaskCategory | undefined;
    const stageKeys: (keyof ChecklistByStageAndCategory)[] = ['predeparture', 'departure', 'arrival'];

    // Search for the category by name in the master list across all stages
    for (const stageKey of stageKeys) {
      if (this.checklistData[stageKey]) {
        originalCategoryInMasterList = this.checklistData[stageKey].find(
          cat => cat.name === categoryFromDisplay.name // Assuming category names are unique enough for this.
                                                        // A unique ID on categories would be more robust.
        );
        if (originalCategoryInMasterList) {
          break; // Found it
        }
      }
    }

    if (originalCategoryInMasterList) {
      // Toggle the state on the master list's category
      originalCategoryInMasterList.isExpanded = !originalCategoryInMasterList.isExpanded;

      // Also update the 'categoryFromDisplay' (from displayedChecklistData) for immediate UI reflection.
      // This is important because applyFiltersAndSearch might not run immediately,
      // or if it does, we want the UI to feel responsive.
      categoryFromDisplay.isExpanded = originalCategoryInMasterList.isExpanded;

    } else {
      // This case should ideally not happen if categoryFromDisplay originated from displayedChecklistData
      // which itself is derived from checklistData.
      // If it does, it might indicate that 'categoryFromDisplay' is a stale reference or from an unexpected source.
      console.warn('Toggled category not found in master checklistData during toggleCategory:', categoryFromDisplay.name);
      // Fallback: just toggle the one we have, but be aware this state might be lost on the next filter/sort.
      categoryFromDisplay.isExpanded = !categoryFromDisplay.isExpanded;
    }

    // It's usually a good idea to save to cache if a persistent state like isExpanded changes.
    this.saveChecklistToCache(); // Add this if you want expanded states to persist across sessions

    this.changeDetectorRef.detectChanges(); // Update UI immediately after toggle
  }

  // Inline expansion via showTaskDetails is removed to favor modal for details.
  // If some very brief inline info is needed on click before modal, this could be reinstated.
  // showTaskDetails(item: RelocationTask) {
  // item.isExpanded = !item.isExpanded;
  // this.changeDetectorRef.detectChanges();
  // }

  markCheck(item : RelocationTask, stageKeyStr: string, categoryName: string){
      const stageKey = stageKeyStr as keyof ChecklistByStageAndCategory;
      const taskInOriginalData = this.findTaskInOriginalData(item.task_id, stageKey, categoryName);
      if (taskInOriginalData) {
          taskInOriginalData.completed = !taskInOriginalData.completed;
          item.completed = taskInOriginalData.completed; // Sync displayed item

          this.updateStageProgressAndLabelsFromData(this.checklistData); // Recalculate all progress
          this.saveChecklistToCache();
          // No need to call applyFiltersAndSearch() if filter isn't by completion status,
          // but good to call if it might affect visibility.
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
            position: 'bottom', // Changed to bottom for less intrusive toasts
            cssClass: 'custom-toast'
        });
        await toast.present();
    }

    async removeItem(item : RelocationTask, stageKeyStr: string, categoryName: string){
      const alert = await this.alertController.create({
        header: 'Confirm Removal',
        message: `Are you sure you want to remove the task "${item.task_description}"? This cannot be undone.`,
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Remove',
            role: 'destructive',
            handler: () => {
              const stageKey = stageKeyStr as keyof ChecklistByStageAndCategory;
              const categoryInOriginal = this.checklistData[stageKey].find(cat => cat.name === categoryName);
              if (categoryInOriginal) {
                  const index = categoryInOriginal.tasks.findIndex(t => t.task_id === item.task_id);
                  if (index > -1) {
                      categoryInOriginal.tasks.splice(index, 1);
                      
                      if (categoryInOriginal.tasks.length === 0 && categoryInOriginal.name !== 'General') { // Avoid removing 'General' if empty
                           const categoryIndexInOriginal = this.checklistData[stageKey].indexOf(categoryInOriginal);
                           if (categoryIndexInOriginal > -1) {
                               this.checklistData[stageKey].splice(categoryIndexInOriginal, 1);
                           }
                      }
                      this.updateStageProgressAndLabelsFromData(this.checklistData);
                      this.saveChecklistToCache();
                      this.applyFiltersAndSearch();
                      this.changeDetectorRef.detectChanges();
                      this.showToast('Task removed.', 'medium');
                  }
              }
            }
          }
        ]
      });
      await alert.present();
    }

  sortTasks(sortBy: 'priority' | 'dueDate') {
    if (this.currentSort === sortBy) { // If already sorted by this, toggle or reset
        this.currentSort = 'none'; // Reset sort
    } else {
        this.currentSort = sortBy;
    }

    const stages: (keyof ChecklistByStageAndCategory)[] = ['predeparture', 'departure', 'arrival'];
    stages.forEach(stageKey => {
        if (this.checklistData[stageKey]) {
            this.checklistData[stageKey].forEach(category => {
                this.sortCategoryTasks(category, this.currentSort);
            });
        }
    });
    this.applyFiltersAndSearch(); // Re-apply filters to the sorted data
    this.changeDetectorRef.detectChanges();
  }

  private interpretDueDateString(dueDateStr: string): Date | null {
    if (!dueDateStr || !this.formData || !this.formData.moveDate) {
      return null;
    }

    const cleanedStr = dueDateStr.trim().toLowerCase();
    let baseMoveDate = new Date(this.formData.moveDate); // User's move date from quiz

    if (isNaN(baseMoveDate.getTime())) { // Invalid moveDate in quiz
      return null;
    }
    
    // Set baseMoveDate to midnight for consistent day-based calculations
    baseMoveDate = new Date(baseMoveDate.getFullYear(), baseMoveDate.getMonth(), baseMoveDate.getDate());


    if (cleanedStr === "day of move" || cleanedStr === "day of arrival") {
      return baseMoveDate;
    }
    if (cleanedStr === "day before move" || cleanedStr === "1 day before move") {
      const target = new Date(baseMoveDate);
      target.setDate(baseMoveDate.getDate() - 1);
      return target;
    }

    const weeksBeforeMatch = cleanedStr.match(/(\d+)(?:-\d+)?\s*weeks?\s*before\s*move/);
    if (weeksBeforeMatch && weeksBeforeMatch[1]) {
      const weeks = parseInt(weeksBeforeMatch[1], 10);
      const target = new Date(baseMoveDate);
      target.setDate(baseMoveDate.getDate() - (weeks * 7));
      return target;
    }

    const daysBeforeMatch = cleanedStr.match(/(\d+)(?:-\d+)?\s*days?\s*before\s*move/);
    if (daysBeforeMatch && daysBeforeMatch[1]) {
      const days = parseInt(daysBeforeMatch[1], 10);
      const target = new Date(baseMoveDate);
      target.setDate(baseMoveDate.getDate() - days);
      return target;
    }
    
    // If the string itself is a parsable ISO date (e.g., from a custom task)
    const directDate = new Date(dueDateStr); // Try parsing original string directly
    if (!isNaN(directDate.getTime())) {
        return directDate;
    }

    return null; // Could not interpret as a date relative to moveDate or as an absolute date
  }
public isAbsoluteDate(dateString: string | undefined | null): boolean {
    if (!dateString) {
      return false;
    }
    const cleanedDateString = dateString.trim();
    // First, try to interpret it based on known patterns relative to moveDate
    const interpretedDate = this.interpretDueDateString(cleanedDateString);
    if (interpretedDate) { // If successfully interpreted, it's an absolute date
      return true;
    }
    // If not interpretable relative to moveDate, check if it's a standalone parsable date
    const date = new Date(cleanedDateString);
    return !isNaN(date.getTime());
  }


  private getOrdinalSuffix(day: number): string {
    const j = day % 10,
          k = day % 100;
    if (j == 1 && k != 11) return "st";
    if (j == 2 && k != 12) return "nd";
    if (j == 3 && k != 13) return "rd";
    return "th";
  }

  public formatDateWithOrdinal(dateInput: string | undefined | null): string {
    if (!dateInput) return 'N/A';
    const cleanedDateInput = dateInput.trim();

    // Attempt to interpret the string first (e.g. "Day of move")
    let dateToFormat = this.interpretDueDateString(cleanedDateInput);

    if (!dateToFormat) {
      // If not interpretable, try parsing as a direct date string
      const directDate = new Date(cleanedDateInput);
      if (!isNaN(directDate.getTime())) {
        dateToFormat = directDate;
      } else {
        // If still not a date, it must be "2-4 Weeks", "ASAP", etc.
        // This function should not handle those. The HTML logic will use getRelativeDueDate for them.
        // However, the *ngIf in HTML calling this should already filter those out.
        return cleanedDateInput; // Safety return
      }
    }

    const day = dateToFormat.getDate();
    const month = dateToFormat.toLocaleDateString(undefined, { month: 'long' });
    const year = dateToFormat.getFullYear();
    return `${day}${this.getOrdinalSuffix(day)} ${month} ${year}`;
  }


  public getRelativeDueDate(dueDateInput: string): string {
    if (!dueDateInput) {
      return '';
    }
    const cleanedDueDateInput = dueDateInput.trim();

    // Attempt to interpret the string into an absolute date first
    const absoluteDate = this.interpretDueDateString(cleanedDueDateInput);

    if (absoluteDate) { // Successfully interpreted to an absolute date
      const now = new Date();
      const dueDateDay = new Date(absoluteDate.getFullYear(), absoluteDate.getMonth(), absoluteDate.getDate());
      const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diffTime = dueDateDay.getTime() - nowDay.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < -1) { /* ... overdue logic ... */ 
        const diffWeeksOverdue = Math.floor(Math.abs(diffDays) / 7);
        if (diffWeeksOverdue >= 1) return `Overdue ~${diffWeeksOverdue} week${diffWeeksOverdue !== 1 ? 's' : ''}`;
        return `Overdue ${Math.abs(diffDays)} days`;
      }
      if (diffDays === -1) return `Overdue 1 day`;
      if (diffDays === 0) return 'Due today';
      if (diffDays === 1) return 'Due tomorrow';
      if (diffDays >= 7) {
        const diffWeeks = Math.floor(diffDays / 7);
        return `~${diffWeeks} week${diffWeeks !== 1 ? 's' : ''}`;
      }
      if (diffDays > 1 && diffDays < 7) {
        return `~${diffDays} days`;
      }
      return ''; // No specific relative string, ordinal date will be primary
    } else {
      // If not interpretable as an absolute date (e.g., "2-4 Weeks", "ASAP", or a malformed ISO)
      const inputLower = cleanedDueDateInput.toLowerCase();
      const weeksRangeMatch = inputLower.match(/(\d+(?:-\d+)?)\s*weeks?/);
      if (weeksRangeMatch && weeksRangeMatch[1]) return `${weeksRangeMatch[1]} Weeks`;
      
      const daysRangeMatch = inputLower.match(/(\d+(?:-\d+)?)\s*days?/);
      if (daysRangeMatch && daysRangeMatch[1]) return `${daysRangeMatch[1]} Days`;
      
      if (inputLower.includes("asap")) return "ASAP";
      if (inputLower.includes("ongoing")) return "Ongoing";
      
      // If it's an unparsable string that doesn't match known patterns, return it.
      // This would include the malformed ISO strings if the backend fix wasn't applied/reverted.
      return cleanedDueDateInput;
    }
  }

  // _parseDueDateRange for sorting should also use interpretDueDateString
  private _parseDueDateRange(dueDateStr: string | undefined): number {
    if (!dueDateStr) return Infinity;
    const cleanedStr = dueDateStr.trim();

    const absoluteDate = this.interpretDueDateString(cleanedStr);
    if (absoluteDate) {
      return absoluteDate.getTime();
    }

    // Fallback for strings not interpretable into absolute dates (e.g. "2-4 Weeks", "ASAP")
    const lowerDueDateStr = cleanedStr.toLowerCase();
    if (lowerDueDateStr.includes("asap") || lowerDueDateStr.includes("ongoing")) {
      return Infinity - 1;
    }

    const weeksMatch = lowerDueDateStr.match(/(\d+)(?:-\d+)?\s*weeks?/);
    if (weeksMatch && weeksMatch[1]) {
      return parseInt(weeksMatch[1], 10) * 7; // Convert weeks to a day-equivalent
    }

    const daysMatch = lowerDueDateStr.match(/(\d+)(?:-\d+)?\s*days?/);
    if (daysMatch && daysMatch[1]) {
      return parseInt(daysMatch[1], 10);
    }
    
    return Infinity - 2; // Default for other unparsable strings
  }
  
  sortCategoryTasks(category: TaskCategory, sortBy: 'none' | 'priority' | 'dueDate') {
    if (sortBy === 'none') {
      category.tasks.sort((a, b) => { /* ... existing task_id sort ... */ 
        if (a.task_id && b.task_id) {
          const aIsNumeric = /^\d+$/.test(a.task_id.replace('custom_', ''));
          const bIsNumeric = /^\d+$/.test(b.task_id.replace('custom_', ''));
          if (aIsNumeric && bIsNumeric) {
            return parseInt(a.task_id.replace('custom_', ''), 10) - parseInt(b.task_id.replace('custom_', ''), 10);
          }
          return a.task_id.localeCompare(b.task_id);
        }
        return 0;
      });
      return;
    }

    if (sortBy === 'priority') {
      const priorityOrder: { [key: string]: number } = { 'High': 1, 'Medium': 2, 'Low': 3 };
      category.tasks.sort((a, b) => {
        const orderDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (orderDiff === 0) { // If priorities are the same, sub-sort by our parsed due date value
          const valA = this._parseDueDateRange(a.due_date);
          const valB = this._parseDueDateRange(b.due_date);
          return valA - valB;
        }
        return orderDiff;
      });
    } else if (sortBy === 'dueDate') {
      category.tasks.sort((a, b) => {
        const valA = this._parseDueDateRange(a.due_date);
        const valB = this._parseDueDateRange(b.due_date);

        if (valA !== valB) {
            return valA - valB;
        }
        // If due dates are equivalent (e.g. both "ASAP" or same numeric value),
        // then sub-sort by priority as a tie-breaker
        const priorityOrder: { [key: string]: number } = { 'High': 1, 'Medium': 2, 'Low': 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
    }
  }

  async saveChecklistToCache() {
      await this.storage.set(this.CACHED_CHECKLIST_KEY, this.checklistData);
      await this.storage.set(this.CACHED_FORM_DATA_KEY, this.formData); // Save the form data that generated this checklist
      this.cachedFormData = JSON.parse(JSON.stringify(this.formData)); // Update in-memory cache of form data
  }

  updateStageLabelsBasedOnOriginalData() {
    const stages: (keyof ChecklistByStageAndCategory)[] = ['predeparture', 'departure', 'arrival'];
    stages.forEach(stageKey => {
        const { current, total } = this.stageProgress[stageKey];
        const stageName = stageKey.charAt(0).toUpperCase() + stageKey.slice(1);
        const labelKey = `${stageKey}Label` as 'predepartureLabel' | 'departureLabel' | 'arrivalLabel';

        if (this.isGeneratingChecklist && this.totalTasksToGenerate > 0) {
             this[labelKey] = `${stageName} (${this.generatedTasksCount}/${this.totalTasksToGenerate} gen...)`;
        } else if (this.isGeneratingChecklist) {
             this[labelKey] = `${stageName} (Generating...)`;
        } else if (total > 0 && current === total) {
             this[labelKey] = `${stageName} (${total}) ✓`; // Add checkmark for completed stage
        } else if (total === 0 && this.isQuestionnaireFilled && !this.isGeneratingChecklist) {
            this[labelKey] = `${stageName} (0)`;
        } else if (!this.isQuestionnaireFilled) {
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
  if (this.isOpeningDetailedModal) {
    console.log('Detailed modal opening already in progress. Aborting.');
    return; // Already trying to open this type of modal, do nothing
  }
  this.isOpeningDetailedModal = true; // Set flag

  try { // Add try block
    const modal = await this.modalController.create({
      component: TaskDetailModalPage,
      componentProps: {
        taskData: JSON.parse(JSON.stringify(task)) // Pass a deep copy
      },
      cssClass: 'task-detail-modal-custom' // Optional: for custom modal styling
    });

    // Listen for when the modal is fully dismissed to reset the flag
    modal.onDidDismiss().then(() => {
      this.isOpeningDetailedModal = false;
      console.log('Detailed modal dismissed, flag reset.');
    });

    await modal.present();
    console.log('Detailed modal presented.');

    // This promise resolves when the modal *starts* to dismiss, not when it's fully gone.
    // The flag is reset by onDidDismiss() above.
    const { data, role } = await modal.onWillDismiss();
    console.log('Detailed modal onWillDismiss - Role:', role, 'Data:', data);

    const originalTask = this.findTaskInOriginalData(task.task_id, task.stage as keyof ChecklistByStageAndCategory, task.category);

    if (originalTask) {
      if (role === 'confirm' && data) {
          let changed = false;
          if (data.isImportant !== undefined && originalTask.isImportant !== data.isImportant) {
              originalTask.isImportant = data.isImportant;
              changed = true;
          }
          if (data.due_date !== undefined && originalTask.due_date !== data.due_date) {
               originalTask.due_date = data.due_date; // Expecting ISO string from modal
              changed = true;
          }
          if (data.notes !== undefined && originalTask.notes !== data.notes) {
              originalTask.notes = data.notes;
              changed = true;
          }
          if (changed) {
              console.log('Detailed modal changes confirmed, saving and applying filters.');
              this.saveChecklistToCache();
              this.applyFiltersAndSearch(); // Re-filter if notes/due date changed, sort might also apply
              this.changeDetectorRef.detectChanges();
          }
      } else if (role === 'askChatbot' && data?.taskDescription) {
        console.log('Detailed modal asking chatbot for:', data.taskDescription);
        this.router.navigate(['/tabs/tab_chatbot'], { queryParams: { prefill: data.taskDescription } });
      }
    }
  } catch (error) { // Add catch block
    console.error("Error in openDetailedTaskModal:", error);
    this.isOpeningDetailedModal = false; // Ensure flag is reset on error
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
    // This action is now primarily handled in the TaskDetailModal.
    // If an inline toggle is desired (e.g., quick star click), this logic can be kept.
    // For now, assume modal handles it. If an inline star is still clickable, it should open the modal.
    this.openDetailedTaskModal(item);
  }

  async presentFilterPopover(ev: any) {
    const popover = await this.popoverController.create({
      component: FilterPopoverComponent,
      componentProps: {
        currentFilters: this.activeFilters
      },
      event: ev,
      translucent: true,
      cssClass: 'filter-popover-class' // Add a custom class for styling
    });
    await popover.present();

    const { data, role } = await popover.onWillDismiss();
    if (role === 'apply' && data) {
      this.activeFilters = data;
      this.applyFiltersAndSearch();
    }
  }
  
  updateActiveFiltersCount() {
    let count = 0;
    if (this.activeFilters.status !== 'all') count++;
    if (this.activeFilters.priority !== 'all') count++;
    if (this.activeFilters.favorites) count++;
    this.activeFiltersCount = count;
  }

// In app/tabs/tab_checklist/tab_checklist.page.ts

// ... (keep existing interfaces and properties) ...

// --- NEW: Helper Filter Functions ---

private _filterTasksByStatus(tasks: RelocationTask[], statusFilter: ChecklistFilterData['status']): RelocationTask[] {
  if (statusFilter === 'all') {
    return tasks;
  }
  return tasks.filter(task =>
    (statusFilter === 'completed' && task.completed) ||
    (statusFilter === 'incomplete' && !task.completed)
  );
}

private _filterTasksByPriority(tasks: RelocationTask[], priorityFilter: ChecklistFilterData['priority']): RelocationTask[] {
  if (priorityFilter === 'all') {
    return tasks;
  }
  return tasks.filter(task => task.priority === priorityFilter);
}

private _filterTasksByFavorites(tasks: RelocationTask[], favoritesFilter: ChecklistFilterData['favorites']): RelocationTask[] {
  if (!favoritesFilter) {
    return tasks;
  }
  return tasks.filter(task => task.isImportant);
}

private _filterTasksBySearchTerm(tasks: RelocationTask[], searchTerm: string): RelocationTask[] {
  const term = searchTerm.trim().toLowerCase();
  if (!term) { // If search term is empty, show all tasks (that passed previous filters)
    return tasks;
  }

  // Full word search logic (regex)
  const searchRegex = new RegExp(`\\b${this._escapeRegExp(term)}\\b`, 'i');

  return tasks.filter(task => {
    let searchMatch = false;
    if (task.task_description && searchRegex.test(task.task_description)) {
      searchMatch = true;
    }
    if (!searchMatch && task.importance_explanation && searchRegex.test(task.importance_explanation)) {
      searchMatch = true;
    }
    if (!searchMatch && task.notes && searchRegex.test(task.notes)) {
      searchMatch = true;
    }
    if (!searchMatch && task.priority && searchRegex.test(task.priority)) { // Match whole word for priority in search
        searchMatch = true;
    }

    // For due date, use 'includes' for flexibility as full word might be too restrictive
    const formattedDate = (this.datePipe.transform(task.due_date, 'mediumDate') || '').toLowerCase();
    const relativeDate = (this.getRelativeDueDate(task.due_date) || '').toLowerCase();
    const originalDueDateLower = (task.due_date || '').toLowerCase();

    if (!searchMatch && formattedDate.includes(term)) {
      searchMatch = true;
    }
    if (!searchMatch && relativeDate.includes(term)) {
      searchMatch = true;
    }
    // If due_date is a string not parsable by datePipe (e.g., "2-4 Weeks"), search in it
    if (!searchMatch && isNaN(new Date(task.due_date).getTime()) && originalDueDateLower.includes(term)) {
      searchMatch = true;
    }
    return searchMatch;
  });
}

// Helper to escape special characters for regex
private _escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}


// --- REFACTORED: applyFiltersAndSearch ---
applyFiltersAndSearch() {
  if (!this.isQuestionnaireFilled) {
    this.displayedChecklistData = { predeparture: [], departure: [], arrival: [] };
    this.updateStageProgressAndLabelsFromData(this.checklistData);
    return;
  }

  const newDisplayedData: ChecklistByStageAndCategory = {
    predeparture: [],
    departure: [],
    arrival: []
  };

  for (const stageKey of Object.keys(this.checklistData) as Array<keyof ChecklistByStageAndCategory>) {
    if (!this.checklistData[stageKey]) {
      newDisplayedData[stageKey] = [];
      continue;
    }

    newDisplayedData[stageKey] = this.checklistData[stageKey]
      .map(categoryFromMaster => {
        let tasksToDisplay = [...categoryFromMaster.tasks]; // Start with all tasks for the category

        // Apply filters sequentially
        tasksToDisplay = this._filterTasksByStatus(tasksToDisplay, this.activeFilters.status);
        tasksToDisplay = this._filterTasksByPriority(tasksToDisplay, this.activeFilters.priority);
        tasksToDisplay = this._filterTasksByFavorites(tasksToDisplay, this.activeFilters.favorites);
        tasksToDisplay = this._filterTasksBySearchTerm(tasksToDisplay, this.searchTerm);

        // Return a new category object with the filtered tasks, preserving other category properties
        // like 'isExpanded' from the master data.
        return tasksToDisplay.length > 0 ? { ...categoryFromMaster, tasks: tasksToDisplay } : null;
      })
      .filter(category => category !== null) as TaskCategory[];
  }

  this.displayedChecklistData = newDisplayedData;

  this.updateActiveFiltersCount();
  this.updateStageProgressAndLabelsFromData(this.checklistData); // Progress based on original data
  this.changeDetectorRef.detectChanges();
}
  
  resetFiltersAndSearch() {
    this.searchTerm = '';
    this.activeFilters = {
        status: 'all',
        priority: 'all',
        favorites: false,
    };
    this.currentSort = 'none'; // Optionally reset sort too
    // Re-sort all data to default if sort was reset
    if (this.currentSort === 'none') {
        const stages: (keyof ChecklistByStageAndCategory)[] = ['predeparture', 'departure', 'arrival'];
        stages.forEach(stageKey => {
            if (this.checklistData[stageKey]) {
                this.checklistData[stageKey].forEach(category => {
                    // Assuming tasks have an original order or sort by task_id
                    category.tasks.sort((a,b) => (a.task_id && b.task_id) ? a.task_id.localeCompare(b.task_id) : 0);
                });
            }
        });
    }
    this.applyFiltersAndSearch();
    this.showToast('Filters and search have been reset.', 'secondary');
  }


  async openAddTaskModal() {
  if (this.isOpeningAddTaskModal) {
    console.log('Add task modal opening already in progress. Aborting.');
    return; // Already trying to open this type of modal
  }
  this.isOpeningAddTaskModal = true; // Set flag

  try { // Add try block
      const existingCategoriesByStage: { [key: string]: string[] } = {
        predeparture: [...new Set(this.checklistData.predeparture.map(cat => cat.name))].sort(),
        departure: [...new Set(this.checklistData.departure.map(cat => cat.name))].sort(),
        arrival: [...new Set(this.checklistData.arrival.map(cat => cat.name))].sort(),
      };

      const modal = await this.modalController.create({
        component: AddTaskModalPage,
        componentProps: {
            existingCategories: existingCategoriesByStage,
            // Pass current stage to pre-select in modal
            currentStage: this.selectedStage
        }
      });

      // Listen for when the modal is fully dismissed to reset the flag
      modal.onDidDismiss().then(() => {
        this.isOpeningAddTaskModal = false;
        console.log('Add task modal dismissed, flag reset.');
      });

      await modal.present();
      console.log('Add task modal presented.');

      // This promise resolves when the modal *starts* to dismiss.
      const { data, role } = await modal.onWillDismiss();
      console.log('Add task modal onWillDismiss - Role:', role, 'Data:', data);

      if (role === 'confirm' && data) {
        const newTaskData = data;
        const newTask: RelocationTask = {
          task_id: `custom_${new Date().getTime()}`,
          task_description: newTaskData.task_description,
          priority: newTaskData.priority,
          due_date: newTaskData.due_date, // Store as ISO string
          importance_explanation: 'This is a custom task you added.',
          importance_explanation_summary: 'Custom task.',
          recommended_services: [],
          isExpanded: false,
          completed: false,
          isImportant: false,
          stage: newTaskData.stage,
          category: newTaskData.category, // This will be the new or selected category name
          notes: ''
        };

        const stageKey = newTask.stage as keyof ChecklistByStageAndCategory;
        // Ensure the stage array exists
        if (!this.checklistData[stageKey]) {
          this.checklistData[stageKey] = [];
        }

        let categoryObj = this.checklistData[stageKey].find(cat => cat.name.toLowerCase() === newTask.category?.toLowerCase());

        if (!categoryObj) {
          categoryObj = { name: newTask.category!, tasks: [], isExpanded: true }; // Auto-expand new category
          this.checklistData[stageKey].push(categoryObj);
          // Sort categories by name after adding a new one
          this.checklistData[stageKey].sort((a, b) => a.name.localeCompare(b.name));
        }
        categoryObj.tasks.push(newTask);
        // Sort tasks within the category if a sort order is active
        if (this.currentSort !== 'none') { this.sortCategoryTasks(categoryObj, this.currentSort); }

        console.log('Add task modal confirmed, saving and applying filters.');
        this.updateStageProgressAndLabelsFromData(this.checklistData);
        this.saveChecklistToCache();
        this.applyFiltersAndSearch(); // Refresh displayed data
        this.showToast('Custom task added!', 'success');
      }
  } catch (error) { // Add catch block
    console.error("Error in openAddTaskModal:", error);
    this.isOpeningAddTaskModal = false; // Ensure flag is reset on error
  }
}

  areAllTasksComplete(category: TaskCategory): boolean {
      if (!category.tasks || category.tasks.length === 0) return false; // An empty category isn't "complete"
      return category.tasks.every(task => task.completed);
  }

  getPriorityIcon(priority: 'High' | 'Medium' | 'Low'): string {
    switch (priority) {
      case 'High': return 'alert-circle-outline'; // Or chevron-up-outline, trending-up-outline
      case 'Medium': return 'remove-outline'; // Or chevron-forward-outline (less intuitive for priority)
      case 'Low': return 'chevron-down-outline'; // Or trending-down-outline
      default: return 'ellipse-outline';
    }
  }
}