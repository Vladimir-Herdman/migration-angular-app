import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
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
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Subject } from 'rxjs';

// Import utility classes
import { DateUtils } from 'src/app/utils/date-utils';
import { FilterUtils, TaskCategory, RelocationTask, ChecklistByStageAndCategory, ServiceRecommendation } from 'src/app/utils/filter-utils';
import { ProgressUtils } from 'src/app/utils/progress-utils';
import { CacheUtils } from 'src/app/utils/cache-utils';
import { TaskGenerationService } from 'src/app/utils/task-generation.service';
import { ChecklistUIService } from 'src/app/utils/checklist-ui.service';
import { StageManagementService } from 'src/app/utils/stage-management.service';

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
    // FilterPopoverComponent is presented via PopoverController, not directly in template
  ],
  providers: [
    DatePipe, 
    DateUtils, 
    FilterUtils, 
    ProgressUtils, 
    CacheUtils,
    TaskGenerationService,
    ChecklistUIService,
    StageManagementService
  ]
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

  // Add cache maps for expensive calculations
  private dueDateCache: Map<string, Date | null> = new Map();
  private relativeDueDateCache: Map<string, string> = new Map();
  private formattedDateCache: Map<string, string> = new Map();
  private isAbsoluteDateCache: Map<string, boolean> = new Map();
  
  // Add debounce for search
  private searchTerms = new Subject<string>();

  // Add new properties for enhanced progress tracking
  preparingProgress: number = 0; // For the animated "preparing" progress bar
  private preparingAnimationInterval: any = null; // For controlling animation timing
  private preparingAnimationComplete: boolean = false; // Flag to track if preparation is complete
  private preparingMinDurationPromise: Promise<void> | null = null; // Promise for minimum preparing duration
  public initialStructureReceived: boolean = false; // Flag to track if initial structure was received
  
  // New queue system for controlled rendering
  private init_queue: {type: 'stageTotals' | 'category', stage: string, data: any}[] = [];
  private gen_tasks: any[] = [];
  private initQueueProcessing: boolean = false;
  private genTasksProcessing: boolean = false;
  private preparingAnimationDuration: number = 4200; // Fixed 4.2 seconds for preparing animation
  public stagesWithTotalsRendered: Set<string> = new Set();

  // Add new properties for progress drain animation
  isDraining: boolean = false;
  progressResetInProgress: boolean = false;

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
    private popoverController: PopoverController,
    public datePipe: DatePipe,
    private ngZone: NgZone,
    private dateUtils: DateUtils,
    private filterUtils: FilterUtils,
    private progressUtils: ProgressUtils,
    private cacheUtils: CacheUtils,
    private taskGenerationService: TaskGenerationService,
    private checklistUIService: ChecklistUIService,
    private stageManagementService: StageManagementService
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

    const userEmailPrefix = this.authService.email_key || 'default_user';
    const cacheKeys = this.cacheUtils.getUserSpecificCacheKeys(userEmailPrefix);
    this.CACHED_CHECKLIST_KEY = cacheKeys.checklistKey;
    this.CACHED_FORM_DATA_KEY = cacheKeys.formDataKey;

    // Setup search debounce to avoid excessive filtering on each keystroke
    this.searchTerms.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(() => {
      this.ngZone.run(() => {
        this.applyFiltersAndSearch();
      });
    });

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
    this.searchTerms.complete();
    this.stopPreparingAnimation(); // Ensure we stop any animations
  }

  updateStageProgressAndLabelsFromData(sourceData: ChecklistByStageAndCategory) {
    this.stageManagementService.updateStageProgressFromData(sourceData, this.selectedStage);
    this.stageProgress = this.stageManagementService.getStageProgress();
    this.updateStageLabels();
  }

  updateStageLabels() {
    // Update stage labels based on current progress and generation state
    const stages = ['predeparture', 'departure', 'arrival'];
    stages.forEach(stageKey => {
      const labelKey = `${stageKey}Label` as 'predepartureLabel' | 'departureLabel' | 'arrivalLabel';
      this[labelKey] = this.stageManagementService.getStageLabel(
        stageKey,
        this.isGeneratingChecklist,
        this.workingOnStage,
        this.isQuestionnaireFilled,
        this.initialStructureReceived
      );
    });
  }

  checkIfQuestionnaireFilled(form: any): boolean {
      return this.formDataService.isFilled(form);
  }

  generateSummary(explanation: string | undefined, maxLength: number = 100): string {
    return this.checklistUIService.generateSummary(explanation, maxLength);
  }

  async loadCachedChecklistOrGenerate(currentForm: any) {
    if (currentForm?.destination?.translations) {currentForm.destination = currentForm.destination.translations.en;}
    try {
      const [cachedChecklist, cachedFormData] = await Promise.all([
        this.storage.get(this.CACHED_CHECKLIST_KEY),
        this.storage.get(this.CACHED_FORM_DATA_KEY)
      ]);
      if (cachedFormData?.destination?.translations) {cachedFormData.destination = cachedFormData.destination.translations.en;}
      
      this.cachedFormData = cachedFormData;
      const formDataChanged = JSON.stringify(currentForm) !== JSON.stringify(this.cachedFormData);

      if (cachedChecklist && !formDataChanged) {
        console.log("Loading cached checklist.");
        this.checklistData = {
          predeparture: cachedChecklist.predeparture || [],
          departure: cachedChecklist.departure || [],
          arrival: cachedChecklist.arrival || []
        };
        
        // Clear caches whenever form data changes
        this.clearCaches();
        
        // If stageProgress is stored in cache, load it as well to preserve task counts
        if (cachedChecklist.stageProgress) {
          this.stageProgress = cachedChecklist.stageProgress;
          this.totalTasksToGenerate = 
            (this.stageProgress['predeparture']?.total || 0) + 
            (this.stageProgress['departure']?.total || 0) + 
            (this.stageProgress['arrival']?.total || 0);
        } else {
          // If no stageProgress in cache, initialize it from the loaded data
          this.initializeStageProgressFromData();
        }
        
        // Only process visible stage immediately for faster UI response
        this.updateStageProgressAndLabelsFromData(this.checklistData);
        this.applyFiltersAndSearch();

        if (this.totalTasksToGenerate > 0) {
          this.showToast('Checklist loaded from cache.', 'success');
        }
      } else {
        console.log("Generating new checklist (questionnaire changed or no cache).");
        this.generateChecklist(currentForm);
      }
    } catch (error) {
      console.error("Error loading cached checklist:", error);
      this.generateChecklist(currentForm);
    }
  }

  // Initialize stage progress tracking from checklist data
  private initializeStageProgressFromData() {
    const stages: (keyof ChecklistByStageAndCategory)[] = ['predeparture', 'departure', 'arrival'];
    
    stages.forEach(stage => {
      const totalTasks = this.checklistData[stage].reduce(
        (acc, category) => acc + category.tasks.length, 0);
      const completedTasks = this.checklistData[stage].reduce(
        (acc, category) => acc + category.tasks.filter(t => t.completed).length, 0);
      
      this.stageProgress[stage] = { 
        current: completedTasks,
        total: totalTasks 
      };
    });
    
    this.totalTasksToGenerate = 
      this.stageProgress['predeparture'].total + 
      this.stageProgress['departure'].total + 
      this.stageProgress['arrival'].total;
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

  async generateChecklist(form: any) {
    if (form?.destination?.translations) {form.destination = form.destination.translations.en;}
    this.isGeneratingChecklist = true;
    this.clearChecklist();
    
    // Start the preparation animation immediately
    this.workingOnStage = 'preparing';
    this.startPreparingAnimation();
    this.startPreparingMinDurationTimer(); // Start 4.2-second minimum timer
    this.initialStructureReceived = false; // Reset flag for new generation
    this.changeDetectorRef.detectChanges();

    try {
      const response = await fetch(`${this.backendUrl}/generate_tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      if (!response.body) {
        this.showToast('Checklist generation failed: No response body.', 'danger');
        this.isGeneratingChecklist = false;
        this.stopPreparingAnimation();
        this.applyFiltersAndSearch();
        return;
      }

      // Reset counters and queues
      this.generatedTasksCount = 0;
      this.taskGenerationService.clearQueues();
      
      // Create a completion flag to track when stream processing is done
      let streamProcessingComplete = false;
      
      // Process the task stream using TaskGenerationService
      await this.taskGenerationService.processTaskStream(
        response,
        {
          onInitialStructure: (data) => {
            // Mark that we've received the initial structure
            this.initialStructureReceived = true;
            
            // Store the total applicable tasks count from backend
            this.totalTasksToGenerate = data.total_applicable_tasks || 0;
            console.log('Total tasks to generate:', this.totalTasksToGenerate);
            
            // Set stage totals from backend data
            this.stageManagementService.setStageProgressFromBackend(data.stage_totals || {});
            this.stageProgress = this.stageManagementService.getStageProgress();
            
            console.log('Stage progress totals received from backend:', JSON.stringify(this.stageProgress));

            // Clear previous categories
            this.checklistData.predeparture = [];
            this.checklistData.departure = [];
            this.checklistData.arrival = [];
            this.stagesWithTotalsRendered.clear();
            
            // Update labels to show the total assigned task counts
            this.updateStageLabels();
            
            // Start processing the init_queue with controlled timing
            this.startProcessingInitQueue();
          },
          onTaskItemAdded: (data) => {
            // Update the working stage
            this.workingOnStage = data.stage as keyof ChecklistByStageAndCategory;
            
            // Start processing gen_tasks if animation is complete
            if ((this.preparingAnimationComplete || this.workingOnStage !== 'preparing') && !this.genTasksProcessing) {
              this.startProcessingGenTasks();
            }
          },
          onStreamEnd: (data) => {
            console.log(`Stream ended. Total tasks streamed by backend: ${data.total_streamed}`);
            streamProcessingComplete = true;
          },
          onError: (error) => {
            console.error('Error processing task stream:', error);
            // Don't show error toast here - it might be premature
          },
          onComplete: () => {
            // Processing is complete
            console.log('Stream processing complete');
          }
        }
      );

      // Wait for the minimum preparing duration before transitioning if still in preparing phase
      if (this.workingOnStage === 'preparing' && !this.preparingAnimationComplete) {
        try {
          // Wait for the 4.2-second minimum timer to complete
          await this.preparingMinDurationPromise;
          
          // Only then, complete the preparing animation
          this.completePreparingAnimation();
          
          // Give the animation time to complete before moving on
          await new Promise(resolve => setTimeout(resolve, 800));
        } catch (e) {
          console.error('Error waiting for preparing animation:', e);
        }
      }
      
      // Wait for task generation to finish
      const waitForTaskGeneration = async () => {
        // If all tasks generated or no tasks were expected, continue
        if (this.generatedTasksCount >= this.totalTasksToGenerate || this.totalTasksToGenerate === 0) {
          return;
        }
        
        // Otherwise wait and check again
        await new Promise(resolve => setTimeout(resolve, 500));
        return waitForTaskGeneration();
      };
      
      // Wait for task generation to complete
      await waitForTaskGeneration();
      
    } catch (error) {
      console.error('Error generating checklist:', error);
      this.showToast('Error generating checklist. Please try again.', 'danger');
    } finally {
      // Final update to ensure all UI elements are current
      this.updateStageLabels();
      this.applyFiltersAndSearch();
      
      this.isGeneratingChecklist = false;
      this.workingOnStage = '';
      this.stopPreparingAnimation();

      // IMPORTANT: Always reset progress bars to 0 completion after generation
      if (this.generatedTasksCount > 0) {
        // Reset all task completion states
        this.checklistData = this.taskGenerationService.resetTaskCompletionStatus(this.checklistData);
        
        // Reset the current completion counters to 0 while preserving totals
        this.stageManagementService.resetStageProgress();
        this.stageProgress = this.stageManagementService.getStageProgress();
        
        // Run the drain animation to visually reset progress bars
        this.resetProgressBarsWithAnimation();
      }

      // Calculate if all expected tasks have been generated
      const expectedTotal = this.totalTasksToGenerate;
      const actualGenerated = this.generatedTasksCount;
      
      // Check if all stages received their expected number of tasks
      const allStagesComplete = Object.keys(this.stageProgress).every(stageKey => {
        const { current, total } = this.stageProgress[stageKey];
        return total === 0 || current >= total;
      });

      // Show appropriate message based on the outcome of generation
      if (expectedTotal > 0 && actualGenerated === expectedTotal && allStagesComplete) {
        this.showToast('Checklist generation complete!', 'success');
      } else if (expectedTotal > 0 && actualGenerated < expectedTotal) {
        this.showToast('Checklist generation partially complete. Some tasks might be missing.', 'warning');
      } else if (expectedTotal > 0 && actualGenerated === 0) {
        this.showToast('Checklist generated, but no tasks match your current criteria.', 'warning');
      } else if (expectedTotal === 0 && actualGenerated === 0 && this.isQuestionnaireFilled) {
        this.showToast('No tasks applicable to your selections.', 'primary');
      }
      
      this.saveChecklistToCache(); 
      this.changeDetectorRef.detectChanges();
    }
  }

  // Reset progress bars with animation
  resetProgressBarsWithAnimation() {
    if (this.progressResetInProgress) return;
    this.progressResetInProgress = true;
    
    this.progressUtils.resetProgressBarsWithAnimation(
      // onDrainStart
      () => {
        this.isDraining = true;
        this.changeDetectorRef.detectChanges();
      },
      // onAnimationComplete
      () => {
        // Keep total tasks but reset completion counters to 0
        this.totalCompletedTasks = 0;
        
        // Reset stage progress tracking to show all tasks as not completed, keeping totals intact
        Object.keys(this.stageProgress).forEach(stageKey => {
          if (this.stageProgress[stageKey]) {
            // Preserve the total but set current to 0
            const total = this.stageProgress[stageKey].total;
            this.stageProgress[stageKey] = { current: 0, total };
          }
        });
        
        // Need to also mark all tasks as uncompleted
        Object.keys(this.checklistData).forEach(stageKey => {
          const stage = stageKey as keyof ChecklistByStageAndCategory;
          this.checklistData[stage].forEach(category => {
            category.tasks.forEach(task => {
              task.completed = false;
            });
          });
        });
        
        // Remove drain animation and refresh UI
        this.isDraining = false;
        this.progressResetInProgress = false;
        this.applyFiltersAndSearch();
        this.changeDetectorRef.detectChanges();
      }
    );
  }

  updateStageLabelsBasedOnOriginalData() {
    const stages: (keyof ChecklistByStageAndCategory)[] = ['predeparture', 'departure', 'arrival'];
    stages.forEach(stageKey => {
      const stageName = stageKey.charAt(0).toUpperCase() + stageKey.slice(1);
      const labelKey = `${stageKey}Label` as 'predepartureLabel' | 'departureLabel' | 'arrivalLabel';

      if (this.isGeneratingChecklist && this.workingOnStage === 'preparing') {
        // We're in the preparing phase
        if (this.initialStructureReceived) {
          // After receiving initial structure, show expected total counts
          const expectedTotal = this.getExpectedTaskCountForStage(stageKey);
          if (expectedTotal > 0) {
            this[labelKey] = `${stageName} (0/${expectedTotal})`;
          } else {
            this[labelKey] = `${stageName} (0)`;
          }
        } else {
          this[labelKey] = `${stageName}`;
        }
      } 
      else if (this.isGeneratingChecklist && this.totalTasksToGenerate > 0) {
        // During active generation phase
        const expectedTotal = this.getExpectedTaskCountForStage(stageKey);
        const completedCount = this.getCompletedTasksCountForStage(stageKey); // Always use completed tasks for display
        const generatedCount = this.getGeneratedTasksCountForStage(stageKey);
        
        // For all stages, always display completed/total, even if 0
        this[labelKey] = `${stageName} (${completedCount}/${expectedTotal})`;
        
        // Only add a checkmark for completed stages
        if (completedCount === expectedTotal && expectedTotal > 0) {
          this[labelKey] = `${stageName} (${completedCount}/${expectedTotal}) ✓`;
        }
      } 
      else if (!this.isGeneratingChecklist) {
        // After generation is complete - display completed/total
        const actualTotal = this.getTotalTasksForStage(stageKey);
        const completed = this.getCompletedTasksCountForStage(stageKey);
        
        if (actualTotal > 0 && completed === actualTotal) {
          this[labelKey] = `${stageName} (${completed}/${actualTotal}) ✓`; // Add checkmark for completed stage
        } else if (actualTotal === 0 && this.isQuestionnaireFilled) {
          this[labelKey] = `${stageName} (0)`;
        } else if (!this.isQuestionnaireFilled) {
          this[labelKey] = stageName;
        } else {
          this[labelKey] = `${stageName} (${completed}/${actualTotal})`;
        }
      }
    });
    this.changeDetectorRef.detectChanges();
  }

  updateOverallProgress() {
    let completedTasks = 0;
    let totalTasks = 0;
    
    // Count across all stages
    Object.keys(this.checklistData).forEach(stageKey => {
      const stage = stageKey as keyof ChecklistByStageAndCategory;
      
      this.checklistData[stage].forEach(category => {
        totalTasks += category.tasks.length;
        completedTasks += category.tasks.filter(task => task.completed).length;
      });
    });
    
    this.totalCompletedTasks = completedTasks;
    
    // Update stage progress counts
    Object.keys(this.stageProgress).forEach(stageKey => {
      const completed = this.getCompletedTasksCountForStage(stageKey);
      // Only update current counts, leave totals as they are
      this.stageProgress[stageKey].current = completed;
      
      // Also update the StageManagementService for each stage
      // This is critical for progress bars to reflect the correct values
      this.stageManagementService.updateCompletedTasks(stageKey, completed);
    });
  }

  async openDetailedTaskModal(task: RelocationTask) {
    await this.checklistUIService.openDetailedTaskModal(
      task,
      // Handle task updates
      (taskId, changes) => {
        const originalTask = this.findTaskInOriginalData(task.task_id, task.stage as keyof ChecklistByStageAndCategory, task.category);
        if (originalTask) {
          if (changes.isImportant !== undefined) {
            originalTask.isImportant = changes.isImportant;
          }
          if (changes.due_date !== undefined) {
            originalTask.due_date = changes.due_date;
          }
          if (changes.notes !== undefined) {
            originalTask.notes = changes.notes;
          }
          this.saveChecklistToCache();
          this.applyFiltersAndSearch();
          this.changeDetectorRef.detectChanges();
        }
      },
      // Handle chatbot requests
      (text) => {
        this.router.navigate(['/tabs/tab_chatbot'], { queryParams: { prefill: text } });
      }
    );
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
    await this.checklistUIService.presentFilterPopover(
      ev,
      this.activeFilters,
      (filters) => {
        this.activeFilters = filters;
        this.applyFiltersAndSearch();
      }
    );
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

// Filter functions now handled by the FilterUtils service directly

// --- REFACTORED: applyFiltersAndSearch ---
applyFiltersAndSearch() {
  if (!this.isQuestionnaireFilled) {
    this.displayedChecklistData = { predeparture: [], departure: [], arrival: [] };
    this.updateStageProgressAndLabelsFromData(this.checklistData);
    return;
  }

  // Run inside NgZone to batch changes for better performance
  this.ngZone.run(() => {
    const newDisplayedData: ChecklistByStageAndCategory = {
      predeparture: [],
      departure: [],
      arrival: []
    };

    // Only process the current selected stage for immediate display
    const currentStage = this.selectedStage as keyof ChecklistByStageAndCategory;
    if (this.checklistData[currentStage]) {
      newDisplayedData[currentStage] = this.filterCategories(
        this.checklistData[currentStage],
        this.activeFilters,
        this.searchTerm,
        this.formData?.moveDate
      );
    }

    // Process other stages in the background for count updates
    const otherStages = Object.keys(this.checklistData)
      .filter(stage => stage !== currentStage) as Array<keyof ChecklistByStageAndCategory>;
    
    // Schedule non-visible stage processing for next event loop to avoid blocking UI
    setTimeout(() => {
      otherStages.forEach(stageKey => {
        if (this.checklistData[stageKey]) {
          newDisplayedData[stageKey] = this.filterCategories(
            this.checklistData[stageKey],
            this.activeFilters,
            this.searchTerm,
            this.formData?.moveDate
          );
        }
      });
      
      // Update active filters count
      this.updateActiveFiltersCount();
      
      // Update progress indicators for non-visible stages
      this.updateStageProgressAndLabelsFromData(this.checklistData);
    }, 10);
    
    // Update the displayed data immediately for current stage
    this.displayedChecklistData = newDisplayedData;
    this.updateActiveFiltersCount();
    
    // Force refresh of progress bars if during generation
    if (this.isGeneratingChecklist) {
      // Force immediate refresh of UI elements
      setTimeout(() => {
        const progressBar = document.querySelector('.active-stage-progress ion-progress-bar') as HTMLElement;
        if (progressBar) {
          // Force a reflow/repaint
          progressBar.style.display = 'none';
          void progressBar.offsetHeight; // Triggers reflow
          progressBar.style.display = '';
        }
      }, 0);
    }
  });
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
    const existingCategoriesByStage: { [key: string]: string[] } = {
      predeparture: [...new Set(this.checklistData.predeparture.map(cat => cat.name))].sort(),
      departure: [...new Set(this.checklistData.departure.map(cat => cat.name))].sort(),
      arrival: [...new Set(this.checklistData.arrival.map(cat => cat.name))].sort(),
    };

    await this.checklistUIService.openAddTaskModal(
      existingCategoriesByStage,
      this.selectedStage,
      (newTaskData) => {
        const newTask: RelocationTask = {
          task_id: `custom_${new Date().getTime()}`,
          task_description: newTaskData.task_description,
          priority: newTaskData.priority,
          due_date: newTaskData.due_date,
          importance_explanation: 'This is a custom task you added.',
          importance_explanation_summary: this.checklistUIService.generateSummary('This is a custom task you added.'),
          recommended_services: [],
          isExpanded: false,
          completed: false,
          isImportant: false,
          stage: newTaskData.stage,
          category: newTaskData.category,
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
    );
  }

  areAllTasksComplete(category: TaskCategory): boolean {
      if (!category.tasks || category.tasks.length === 0) return false; // An empty category isn't "complete"
      return category.tasks.every(task => task.completed);
  }

  getPriorityIcon(priority: 'High' | 'Medium' | 'Low'): string {
    return this.checklistUIService.getPriorityIcon(priority);
  }

  // Clear all caches when form data changes
  clearCaches() {
    this.dateUtils.clearCaches();
  }

  // Optimize search by using the debounced subject
  onSearchInput(event: any) {
    this.searchTerms.next(this.searchTerm);
  }

  // Add the missing getOrdinalSuffix method
  private getOrdinalSuffix(day: number): string {
    const j = day % 10,
          k = day % 100;
    if (j == 1 && k != 11) return "st";
    if (j == 2 && k != 12) return "nd";
    if (j == 3 && k != 13) return "rd";
    return "th";
  }

  async regenerateChecklist() {
    if (this.isGeneratingChecklist || !this.isQuestionnaireFilled) return;
    
    await this.checklistUIService.confirmRegenerateChecklist(
      async () => {
        const latestFormData = await this.formDataService.getForm();
        if (latestFormData) {
          this.generateChecklist(latestFormData);
        } else {
          this.showToast('Could not retrieve questionnaire data.', 'danger');
        }
      }
    );
  }

  handleTaskItemClick(item: RelocationTask, event: MouseEvent) {
    this.checklistUIService.handleTaskItemClick(
      item,
      event,
      () => {
        this.openDetailedTaskModal(item);
      }
    );
  }

  handleTaskItemDoubleClick(item: RelocationTask, stageKeyStr: string, categoryName: string, event: MouseEvent) {
    this.checklistUIService.handleTaskItemDoubleClick(
      event,
      () => {
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
    );
  }

  toggleCategory(categoryFromDisplay: TaskCategory) {
    // Find the original category
    let originalCategoryInMasterList: TaskCategory | undefined;
    const stageKeys: (keyof ChecklistByStageAndCategory)[] = ['predeparture', 'departure', 'arrival'];

    for (const stageKey of stageKeys) {
      if (this.checklistData[stageKey]) {
        originalCategoryInMasterList = this.checklistData[stageKey].find(
          cat => cat.name === categoryFromDisplay.name
        );
        if (originalCategoryInMasterList) {
          break; // Found it
        }
      }
    }

    if (originalCategoryInMasterList) {
      // Toggle the state on the master list's category
      originalCategoryInMasterList.isExpanded = !originalCategoryInMasterList.isExpanded;
      // Also update the displayed category for immediate UI reflection
      categoryFromDisplay.isExpanded = originalCategoryInMasterList.isExpanded;
      
      // Only save to cache if necessary - no need for every toggle
      if (originalCategoryInMasterList.tasks.length > 5) {
        // For categories with many tasks, save cache asynchronously to avoid blocking UI
        setTimeout(() => this.saveChecklistToCache(), 100);
      }
    } else {
      // Fallback for unexpected cases
      categoryFromDisplay.isExpanded = !categoryFromDisplay.isExpanded;
    }
    
    // Don't call change detection here - Angular will handle it automatically
  }

  markCheck(item: RelocationTask, stageKeyStr: string, categoryName: string) {
    // First find the original item in the source data
    const stageKey = stageKeyStr as keyof ChecklistByStageAndCategory;
    const category = this.checklistData[stageKey]?.find(c => c.name === categoryName);
    
    if (category) {
      const originalItem = category.tasks.find(t => t.task_id === item.task_id);
      
      if (originalItem) {
        // Update the original item's completed status (the item passed in is already updated)
        originalItem.completed = item.completed;
        
        // Update overall progress counter
        this.updateOverallProgress();
        
        // Also need to update the stage's current completion count in stageProgress
        if (this.stageProgress[stageKeyStr]) {
          const completedCount = this.getCompletedTasksCountForStage(stageKeyStr);
          this.stageProgress[stageKeyStr].current = completedCount;
          
          // Critical: Update the stage management service with the new completion count
          // This ensures the progress bars and UI elements update correctly
          this.stageManagementService.updateCompletedTasks(stageKeyStr, completedCount);
        }
        
        // Save the updated state to cache
        this.saveChecklistToCache();
        
        // Update stage labels to reflect new completion counts
        this.updateStageLabels();
        
        // For better UX, force update the UI to reflect changes immediately
        this.changeDetectorRef.detectChanges();
      }
    }
  }

  getCheckStatus(item : RelocationTask): boolean{
    const taskInOriginalData = this.findTaskInOriginalData(item.task_id, item.stage as keyof ChecklistByStageAndCategory, item.category);
    return taskInOriginalData?.completed || false;
  }

  async removeItem(item: RelocationTask, stageKeyStr: string, categoryName: string) {
    await this.checklistUIService.confirmTaskRemoval(
      item,
      () => {
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
    );
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
    return this.dateUtils.interpretDueDateString(dueDateStr, this.formData?.moveDate);
  }

  public isAbsoluteDate(dateString: string | undefined | null): boolean {
    return this.dateUtils.isAbsoluteDate(dateString, this.formData?.moveDate);
  }

  public formatDateWithOrdinal(dateInput: string | undefined | null): string {
    return this.dateUtils.formatDateWithOrdinal(dateInput, this.formData?.moveDate);
  }

  public getRelativeDueDate(dueDateInput: string): string {
    return this.dateUtils.getRelativeDueDate(dueDateInput, this.formData?.moveDate);
  }

  sortCategoryTasks(category: TaskCategory, sortBy: 'none' | 'priority' | 'dueDate') {
    this.filterUtils.sortCategoryTasks(category, sortBy, this.formData?.moveDate);
  }

  async saveChecklistToCache() {
    await this.cacheUtils.saveChecklistToCache(
      this.CACHED_CHECKLIST_KEY,
      this.CACHED_FORM_DATA_KEY,
      this.checklistData,
      this.stageProgress,
      this.formData
    );
    
    this.cachedFormData = JSON.parse(JSON.stringify(this.formData)); // Update in-memory cache
  }

  // Helper methods for template to avoid complex expressions in HTML
  
  // Get tasks count for a stage
  public getGeneratedTasksCountForStage(stageKey: string): number {
    // During the preparing phase, always return 0 for all stages to show 0/X in the UI
    if (this.isGeneratingChecklist && this.workingOnStage === 'preparing' && this.initialStructureReceived) {
      return 0;
    }
    
    if (this.checklistData[stageKey as keyof ChecklistByStageAndCategory]) {
      // Count the actual tasks generated and rendered in this stage
      const count = this.checklistData[stageKey as keyof ChecklistByStageAndCategory].reduce(
        (total, category) => total + category.tasks.length, 0);
      
      // Always update the current count in stageProgress to match the actual count of tasks
      // This is critical for the progress bar to accurately reflect current generation progress
      this.stageProgress[stageKey].current = count;
      
      return count;
    }
    return 0;
  }
  
  // Get the expected total tasks for a stage from backend
  public getExpectedTaskCountForStage(stageKey: string): number {
    return this.stageManagementService.getExpectedTaskCountForStage(stageKey);
  }
  
  // Total tasks to generate
  public getTotalTasksForStage(stageKey: string): number {
    return this.stageManagementService.getTotalTasksForStage(stageKey);
  }

  // Get progress bar color for a stage
  public getStageProgressColor(stageKey: string): string {
    return this.stageManagementService.getStageProgressColor(stageKey);
  }
  
  // Updated to provide smoother progress visualization
  public getStageProgressValue(stageKey: string): number {
    return this.stageManagementService.getStageProgressValue(stageKey);
  }
  
  // Update isStageCompleted to work for both generation and completion phases
  public isStageCompleted(stageKey: string): boolean {
    return this.stageManagementService.isStageComplete(stageKey);
  }

  // Add a method to get completed tasks count
  public getCompletedTasksCountForStage(stageKey: string): number {
    return this.stageManagementService.getCompletedTasksCountForStage(
      stageKey, 
      true, // count from checklist data
      this.checklistData
    );
  }

  // Start the preparing progress animation with fixed duration (4.2 seconds)
  private startPreparingAnimation() {
    // Start with initial fast animation up to 50%
    this.preparingProgress = 0;
    let initialAnimationComplete = false;
    
    // First phase: Quick animation to 50%
    const initialAnimation = setInterval(() => {
      if (this.preparingProgress >= 0.5) {
        clearInterval(initialAnimation);
        initialAnimationComplete = true;
      } else {
        this.preparingProgress += 0.02; // Move 2% per frame to reach 50% quickly
        this.changeDetectorRef.detectChanges();
      }
    }, 40); // ~25fps
    
    // Second phase: Content-aware progress
    // This interval continues after initial animation completes
    this.preparingAnimationInterval = setInterval(() => {
      if (initialAnimationComplete) {
        // Calculate total metadata items (categories + stage counts)
        const totalMetadataItems = this.getTotalExpectedCategories() + 3; // 3 stage counts
        const loadedMetadataItems = this.getLoadedMetadataItemsCount();
        
        // Progress is controlled by actual content loading
        const targetProgress = this.progressUtils.controlPreparingAnimation(
          this.preparingProgress,
          totalMetadataItems,
          loadedMetadataItems
        );
        
        // Smoothly move toward target
        if (this.preparingProgress < targetProgress) {
          this.preparingProgress += 0.01; // Small increments for smooth animation
        } else if (this.preparingProgress >= 0.98) {
          // When nearly complete, check if the 4.2 seconds have passed
          if (this.preparingMinDurationPromise) {
            // If time has passed and all metadata is loaded, complete animation
            if (loadedMetadataItems >= totalMetadataItems) {
              this.completePreparingAnimation();
            }
          }
        }
        this.changeDetectorRef.detectChanges();
      }
    }, 80); // Slower for the content-aware phase
  }
  
  // Helper methods for metadata tracking
  private getTotalExpectedCategories(): number {
    // Count categories from backend data or estimate based on form data
    // This could be set when you receive initial structure from backend
    return this.taskGenerationService.getEstimatedCategoryCount() || 10; // Default to 10 if not available
  }

  private getLoadedMetadataItemsCount(): number {
    // Count stage counts and categories that have been rendered
    let count = this.stagesWithTotalsRendered.size; // Count stages with totals
    
    // Count categories that have been created
    Object.keys(this.checklistData).forEach(stageKey => {
      const stage = stageKey as keyof ChecklistByStageAndCategory;
      count += this.checklistData[stage].length;
    });
    
    return count;
  }

  // Complete the preparing animation quickly
  private completePreparingAnimation() {
    this.progressUtils.completePreparingAnimation(
      this.preparingProgress,
      (progress: number) => {
        this.preparingProgress = progress;
        this.changeDetectorRef.detectChanges();
      },
      () => {
        // After animation completes, ensure preparingAnimationComplete is set
        this.preparingAnimationComplete = true;
        
        // Start processing generated tasks with improved handling
        this.startProcessingGenTasks();
      }
    );
  }
  
  // Stop the preparing animation
  private stopPreparingAnimation() {
    this.progressUtils.stopPreparingAnimation();
  }
  
  // Start the minimum duration timer for preparing phase (now 4.2 seconds)
  private startPreparingMinDurationTimer() {
    this.preparingMinDurationPromise = this.progressUtils.startPreparingMinDurationTimer();
    return this.preparingMinDurationPromise;
  }
  
  // Start processing the init_queue (stage totals & categories)
  private startProcessingInitQueue() {
    if (this.initQueueProcessing || this.init_queue.length === 0) return;
    
    this.initQueueProcessing = true;
    console.log('Starting to process init_queue with', this.init_queue.length, 'items');
    
    // Process initQueue items with longer delays for more noticeable staggered appearance
    const processItem = () => {
      if (this.init_queue.length === 0) {
        this.initQueueProcessing = false;
        console.log('Finished processing init_queue');
        // Show stage progress bars when init_queue is empty
        this.showStageProgressBars();
        return;
      }
      
      const item = this.init_queue.shift();
      
      if (item && item.type === 'stageTotals') {
        // Process stage totals
        console.log(`Rendering stage totals for ${item.stage}: 0/${item.data}`);
        
        // Mark this stage as having its totals rendered
        this.stagesWithTotalsRendered.add(item.stage);
        
        // Add a delay before updating the UI to make the change more noticeable
        setTimeout(() => {
          // Update stage labels to reflect the new totals
          if (item.stage === 'predeparture') {
            this.predepartureLabel = `Predeparture (0/${item.data})`;
          } else if (item.stage === 'departure') {
            this.departureLabel = `Departure (0/${item.data})`;
          } else if (item.stage === 'arrival') {
            this.arrivalLabel = `Arrival (0/${item.data})`;
          }
          
          // Force change detection to update the UI with the new label
          this.changeDetectorRef.detectChanges();
        }, 100); // Small delay for UI update
      } else if (item && item.type === 'category') {
        console.log(`Rendering category for ${item.stage}: ${item.data}`);
        
        // Find existing categories for this stage
        const stageKey = item.stage as keyof ChecklistByStageAndCategory;
        
        // Ensure the category exists but is empty
        if (!this.checklistData[stageKey].some(cat => cat.name === item.data)) {
          // Create the new category with collapsed state (closed by default)
          const newCategory = {
            name: item.data,
            tasks: [],
            isExpanded: false, // Always keep categories closed by default during generation
            isNewlyCreated: true
          };
          
          this.checklistData[stageKey].push(newCategory);
          
          // Sort categories alphabetically
          this.checklistData[stageKey].sort((a, b) => a.name.localeCompare(b.name));
          
          // Update UI to show the new category
          this.applyFiltersAndSearch();
          this.changeDetectorRef.detectChanges();
          
          // Remove the newly created flag after animation completes
          setTimeout(() => {
            if (newCategory) {
              newCategory.isNewlyCreated = false;
              this.changeDetectorRef.detectChanges();
            }
          }, 1500);
        } else {
          // Apply filters to refresh the UI
          this.applyFiltersAndSearch();
        }
      }
      
      // Longer delay between metadata items (450ms instead of 250ms) for more visible staggering
      setTimeout(processItem, 450);
    };
    
    // Start processing
    processItem();
    
    this.initQueueProcessing = true;
  }
  
  // Show stage progress bars after init_queue is processed
  private showStageProgressBars() {
    console.log('Showing stage progress bars');
    
    // Force progress bars to be visible with a more noticeable visual effect
    setTimeout(() => {
      // Reset all stage progress tracking to 0/total to prepare for loading animation
      Object.keys(this.stageProgress).forEach(stageKey => {
        if (this.stageProgress[stageKey].total > 0) {
          // Set current to 0 while keeping total
          this.stageProgress[stageKey].current = 0;
          
          // Update stage labels to show 0/total
          const stageName = stageKey.charAt(0).toUpperCase() + stageKey.slice(1);
          const total = this.stageProgress[stageKey].total;
          const labelKey = `${stageKey}Label` as 'predepartureLabel' | 'departureLabel' | 'arrivalLabel';
          this[labelKey] = `${stageName} (0/${total})`;
        }
      });
      
      // Force progress bars to be visible
      const stageProgressElements = document.querySelectorAll('.active-stage-progress');
      stageProgressElements.forEach(el => {
        el.classList.add('force-visible');
      });
      
      this.changeDetectorRef.detectChanges();
      
      // After a short delay, update the UI to prepare for task generation
      setTimeout(() => {
        // Set the first stage with tasks as the active working stage
        if (this.stageProgress['predeparture'].total > 0) {
          this.workingOnStage = 'predeparture';
          this.predepartureLabel = `Predeparture (0/${this.stageProgress['predeparture'].total})`;
        } else if (this.stageProgress['departure'].total > 0) {
          this.workingOnStage = 'departure';
          this.departureLabel = `Departure (0/${this.stageProgress['departure'].total})`;
        } else if (this.stageProgress['arrival'].total > 0) {
          this.workingOnStage = 'arrival';
          this.arrivalLabel = `Arrival (0/${this.stageProgress['arrival'].total})`;
        }
        
        this.changeDetectorRef.detectChanges();
      }, 300);
    }, 500); // Increased delay for more visible effect
  }
  
  // Start processing generated tasks queue with adaptive pacing
  private startProcessingGenTasks() {
    if (this.genTasksProcessing) return;
    
    let processingBatch = false;
    
    const processNextBatch = () => {
      if (processingBatch || !this.taskGenerationService.hasTasksInQueue()) {
        if (!processingBatch && this.generatedTasksCount < this.totalTasksToGenerate) {
          // If we're waiting for more tasks, check again after a delay
          setTimeout(processNextBatch, 500);
        } else if (this.generatedTasksCount >= this.totalTasksToGenerate) {
          // All tasks have been processed
          this.genTasksProcessing = false;
          console.log('Finished processing all tasks:', this.generatedTasksCount);
        }
        return;
      }
      
      processingBatch = true;
      const queueSize = this.taskGenerationService.getTaskQueueSize();
      const batchSize = Math.min(5, queueSize); // Process up to 5 tasks at once
      
      // Calculate delay based on queue size - adaptive pacing
      const renderDelay = this.progressUtils.calculateTaskRenderDelay(queueSize);
      
      // Process a small batch with staggered rendering
      let tasksProcessed = 0;
      
      const processSingleTask = () => {
        const task = this.taskGenerationService.getNextTask();
        if (task) {
          // Render the task with visual emphasis
          this.renderGeneratedTaskWithEmphasis(task);
          tasksProcessed++;
          
          // Update stage labels after each task
          this.updateStageLabels();
          
          // Continue processing batch with delays between tasks
          if (tasksProcessed < batchSize) {
            setTimeout(processSingleTask, renderDelay);
          } else {
            // Batch complete
            processingBatch = false;
            
            // Schedule next batch with a longer delay for visual distinction
            setTimeout(processNextBatch, renderDelay * 2);
          }
        } else {
          // No more tasks in queue
          processingBatch = false;
          if (this.generatedTasksCount < this.totalTasksToGenerate) {
            // If we're waiting for more tasks, check again after a delay
            setTimeout(processNextBatch, 500);
          } else {
            // All tasks have been processed
            this.genTasksProcessing = false;
          }
        }
      };
      
      // Start processing the first task in this batch
      processSingleTask();
    };
    
    // Start the initial batch processing
    this.genTasksProcessing = true;
    processNextBatch();
  }
  
  // Render a generated task to UI with enhanced visual feedback
  private renderGeneratedTaskWithEmphasis(taskData: any) {
    const stageKey = taskData.stage as keyof ChecklistByStageAndCategory;
    const categoryName = taskData.category || 'General';
    
    if (stageKey && this.checklistData[stageKey]) {
      // Find the category or create it if needed
      let category = this.checklistData[stageKey].find(cat => cat.name === categoryName);
      if (!category) {
        // Create a new category (always collapsed during initial generation)
        category = { name: categoryName, tasks: [], isExpanded: false, isNewlyCreated: true };
        this.checklistData[stageKey].push(category);
        this.checklistData[stageKey].sort((a, b) => a.name.localeCompare(b.name));
        
        // Remove the "newly created" flag after animation completes
        setTimeout(() => {
          if (category) {
            category.isNewlyCreated = false;
            this.changeDetectorRef.detectChanges();
          }
        }, 1500);
      }
      
      // Create the new task using the TaskGenerationService
      const newTask = this.taskGenerationService.createTaskFromData(
        taskData, 
        (explanation) => this.generateSummary(explanation)
      );
      
      // Add animation class flag
      newTask.isNewlyGenerated = true;
      
      // Add the task to the category
      category.tasks.push(newTask);
      
      // Increment the task count but don't change workingOnStage
      this.stageProgress[stageKey].current = this.getGeneratedTasksCountForStage(stageKey);
      this.generatedTasksCount++;
      
      // Update UI immediately for this task to show animation
      this.applyFiltersAndSearch();
      this.changeDetectorRef.detectChanges();
      
      // Remove the animation class after animation completes
      setTimeout(() => {
        newTask.isNewlyGenerated = false;
        this.changeDetectorRef.detectChanges();
      }, 1000);
    }
  }

  // Update handleChange to handleStageChange with proper handling
  public handleStageChange() {
    // Update the progress display when stage changes
    this.applyFiltersAndSearch();

    // Ensure progress bars are properly visible on stage change
    if (this.isGeneratingChecklist) {
      // Short delay to ensure DOM elements are updated
      setTimeout(() => {
        const stageProgressElement = document.querySelector('.active-stage-progress');
        if (stageProgressElement) {
          // Force progress bars to be visible after stage change
          const progressBar = stageProgressElement.querySelector('ion-progress-bar');
          if (progressBar) {
            // Force a reflow/repaint to ensure proper animation
            progressBar.style.display = 'none';
            void progressBar.offsetHeight; // Trigger reflow
            progressBar.style.display = '';
          }
        }
      }, 50);
    }
  }

  // Add a helper method to show the current stage being generated
  private applyCurrentStageFilter() {
    // Only filter the currently visible stage for better performance during generation
    const stageKey = this.selectedStage as keyof ChecklistByStageAndCategory;
    
    // Create a shallow copy of the current stage's data
    if (this.checklistData[stageKey]) {
      this.displayedChecklistData[stageKey] = this.checklistData[stageKey].map(category => {
        return { ...category, tasks: [...category.tasks] };
      });
    }
  }

  // Add the showToast method to fix linter errors
  async showToast(message: string, color: string = 'success', duration: number = 2000) {
    await this.checklistUIService.showToast(message, color, duration);
  }

  // Implement our own filterCategories function since it doesn't exist on FilterUtils
  private filterCategories(
    categories: TaskCategory[],
    filters: ChecklistFilterData,
    searchTerm: string,
    moveDate: string | null
  ): TaskCategory[] {
    return categories
      .map(categoryFromMaster => {
        let tasksToDisplay = [...categoryFromMaster.tasks];
        
        // Apply all filters using FilterUtils
        tasksToDisplay = this.filterUtils.applyAllFilters(
          tasksToDisplay,
          filters,
          searchTerm,
          moveDate
        );
        
        // Return a new category object with the filtered tasks or null if empty
        return tasksToDisplay.length > 0 ? { ...categoryFromMaster, tasks: tasksToDisplay } : null;
      })
      .filter((category): category is TaskCategory => category !== null);
  }

  /**
   * Track by function for task lists
   * @param index Index in the array
   * @param task Task item
   * @returns A unique identifier for the task
   */
  trackByTaskId(index: number, task: any): string {
    return task.task_id || `task-${index}`;
  }
}
