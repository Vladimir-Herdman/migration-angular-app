import { Injectable } from '@angular/core';
import { ToastController, AlertController, ModalController, PopoverController } from '@ionic/angular';
import { TaskDetailModalPage } from '../modals/task-detail-modal/task-detail-modal.page';
import { AddTaskModalPage } from '../modals/add-task-modal/add-task-modal.page';
import { FilterPopoverComponent, ChecklistFilterData } from '../components/filter-popover/filter-popover.component';
import { Router } from '@angular/router';
import { RelocationTask, ChecklistByStageAndCategory, TaskCategory } from './filter-utils';
import { ProgressUtils } from './progress-utils';
import { TaskGenerationService } from './task-generation.service';
import { BehaviorSubject, Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { StageManagementService } from './stage-management.service';

@Injectable({
  providedIn: 'root'
})
export class ChecklistUIService {
  // Track modal state to prevent multiple opens
  private isOpeningDetailedModal = false;
  private isOpeningAddTaskModal = false;
  
  // Double-click handler properties
  private clickTimeout: any = null;
  private readonly DOUBLE_CLICK_THRESHOLD = 250;

  // Queue for rendering tasks
  private renderQueue: any[] = [];
  
  // State tracking
  private preparingPhaseActive = false;
  private renderingTasksActive = false;
  private preparingProgressSubject = new BehaviorSubject<number>(0);
  public preparingProgress$ = this.preparingProgressSubject.asObservable();
  
  // Click debounce handling
  private clickSubject = new Subject<any>();

  // Counters for rendered items
  private renderedTasksCount = 0;
  private totalExpectedTasks = 0;

  constructor(
    private toastController: ToastController,
    private alertController: AlertController,
    private modalController: ModalController,
    private popoverController: PopoverController,
    private router: Router,
    private progressUtils: ProgressUtils,
    private taskGenerationService: TaskGenerationService,
    private stageManagementService: StageManagementService
  ) {
    // Set up debounced click handler
    this.clickSubject.pipe(debounceTime(300)).subscribe(data => {
      if (data && data.handler) {
        data.handler();
      }
    });
  }

  /**
   * Show a toast message
   * @param message Message text
   * @param color Toast color (ionic color)
   * @param duration Duration in ms
   */
  async showToast(message: string, color: string = 'success', duration: number = 2000): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration,
      color,
      position: 'bottom', // Changed to bottom for less intrusive toasts
      cssClass: 'custom-toast'
    });
    await toast.present();
  }

  /**
   * Open the task detail modal
   * @param task Task to view/edit
   * @param onTaskUpdate Callback when task is updated
   */
  async openDetailedTaskModal(
    task: RelocationTask, 
    onTaskUpdate: (taskId: string, changes: { isImportant?: boolean, due_date?: string, notes?: string }) => void,
    onAskChatbot: (text: string) => void
  ): Promise<void> {
    if (this.isOpeningDetailedModal) {
      console.log('Detailed modal opening already in progress. Aborting.');
      return; // Already trying to open this type of modal, do nothing
    }
    this.isOpeningDetailedModal = true; // Set flag

    try {
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

      if (role === 'confirm' && data) {
        let changed = false;
        const changes: { isImportant?: boolean, due_date?: string, notes?: string } = {};
        
        if (data.isImportant !== undefined && task.isImportant !== data.isImportant) {
          changes.isImportant = data.isImportant;
          changed = true;
        }
        if (data.due_date !== undefined && task.due_date !== data.due_date) {
          changes.due_date = data.due_date; // Expecting ISO string from modal
          changed = true;
        }
        if (data.notes !== undefined && task.notes !== data.notes) {
          changes.notes = data.notes;
          changed = true;
        }
        
        if (changed && task.task_id) {
          // Notify caller about task updates
          onTaskUpdate(task.task_id, changes);
        }
      } else if (role === 'askChatbot' && data?.taskDescription) {
        console.log('Detailed modal asking chatbot for:', data.taskDescription);
        onAskChatbot(data.taskDescription);
      }
    } catch (error) {
      console.error("Error in openDetailedTaskModal:", error);
      this.isOpeningDetailedModal = false; // Ensure flag is reset on error
    }
  }

  /**
   * Open add task modal to create a new custom task
   * @param existingCategories Map of existing categories by stage
   * @param currentStage Current selected stage
   * @param onTaskAdded Callback when a task is added
   */
  async openAddTaskModal(
    existingCategories: { [key: string]: string[] }, 
    currentStage: string,
    onTaskAdded: (taskData: any) => void
  ): Promise<void> {
    if (this.isOpeningAddTaskModal) {
      console.log('Add task modal opening already in progress. Aborting.');
      return; // Already trying to open this type of modal
    }
    this.isOpeningAddTaskModal = true; // Set flag

    try {
      const modal = await this.modalController.create({
        component: AddTaskModalPage,
        componentProps: {
          existingCategories: existingCategories,
          currentStage: currentStage
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
        onTaskAdded(data);
      }
    } catch (error) {
      console.error("Error in openAddTaskModal:", error);
      this.isOpeningAddTaskModal = false; // Ensure flag is reset on error
    }
  }

  /**
   * Present filter popover
   * @param event Click event
   * @param currentFilters Current filter settings
   * @param onFiltersApplied Callback when filters are applied
   */
  async presentFilterPopover(
    event: any, 
    currentFilters: ChecklistFilterData,
    onFiltersApplied: (filters: ChecklistFilterData) => void
  ): Promise<void> {
    const popover = await this.popoverController.create({
      component: FilterPopoverComponent,
      componentProps: {
        currentFilters: currentFilters
      },
      event: event,
      translucent: true,
      cssClass: 'filter-popover-class' // Add a custom class for styling
    });
    await popover.present();

    const { data, role } = await popover.onWillDismiss();
    if (role === 'apply' && data) {
      onFiltersApplied(data);
    }
  }

  /**
   * Show confirmation dialog before removing a task
   * @param task Task to remove
   * @param onConfirm Callback when removal is confirmed
   */
  async confirmTaskRemoval(task: RelocationTask, onConfirm: () => void): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Confirm Removal',
      message: `Are you sure you want to remove the task "${task.task_description}"? This cannot be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Remove',
          role: 'destructive',
          handler: () => {
            onConfirm();
          }
        }
      ]
    });
    await alert.present();
  }

  /**
   * Show confirmation dialog before regenerating checklist
   * @param onConfirm Callback when regeneration is confirmed
   */
  async confirmRegenerateChecklist(onConfirm: () => void): Promise<void> {
    const confirmationAlert = await this.alertController.create({
      header: 'Regenerate Checklist?',
      message: 'This will clear your current checklist progress (completed tasks, favorites, notes) and generate a new one based on your latest questionnaire answers. Are you sure?',
      buttons: [
        { text: 'Cancel', role: 'cancel', cssClass: 'alert-button-cancel' },
        {
          text: 'Regenerate',
          role: 'destructive',
          cssClass: 'alert-button-destructive',
          handler: () => {
            onConfirm();
          }
        }
      ]
    });
    await confirmationAlert.present();
  }

  /**
   * Handle task item click with debounce to distinguish from double-click
   * @param task Task being clicked
   * @param event Mouse event
   * @param onSingleClick Callback for single click
   */
  handleTaskItemClick(
    task: RelocationTask, 
    event: MouseEvent, 
    onSingleClick: () => void
  ): void {
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
      onSingleClick();
      this.clickTimeout = null; // Reset after action
    }, this.DOUBLE_CLICK_THRESHOLD);
  }

  /**
   * Handle double-click on task items (typically to toggle favorites)
   * @param event Mouse event
   * @param onDoubleClick Callback for double click
   */
  handleTaskItemDoubleClick(
    event: MouseEvent, 
    onDoubleClick: () => void
  ): void {
    event.preventDefault(); // Prevent any default double-click behavior (like text selection)
    event.stopPropagation(); // Stop event from bubbling further

    // Clear the single click timeout if it's still pending
    if (this.clickTimeout) {
      clearTimeout(this.clickTimeout);
      this.clickTimeout = null;
    }

    // Execute the double-click callback
    onDoubleClick();
  }

  /**
   * Navigate to chatbot tab with prefilled text
   * @param text Text to prefill in chatbot
   */
  navigateToChatbotWithText(text: string): void {
    this.router.navigate(['/tabs/tab_chatbot'], { queryParams: { prefill: text } });
  }

  /**
   * Get appropriate icon for priority level
   * @param priority Priority level
   * @returns Icon name
   */
  getPriorityIcon(priority: 'High' | 'Medium' | 'Low'): string {
    switch (priority) {
      case 'High': return 'alert-circle-outline'; // Or chevron-up-outline, trending-up-outline
      case 'Medium': return 'remove-outline'; // Or chevron-forward-outline (less intuitive for priority)
      case 'Low': return 'chevron-down-outline'; // Or trending-down-outline
      default: return 'ellipse-outline';
    }
  }
  
  /**
   * Generate a summary from a longer explanation
   * @param explanation The full explanation text
   * @param maxLength Maximum length of summary
   * @returns Shortened summary text
   */
  generateSummary(explanation: string | undefined, maxLength: number = 100): string {
    if (!explanation) return 'Tap "More Info" for details.';
    if (explanation.length <= maxLength) return explanation;
    return explanation.substring(0, maxLength - 3) + '...';
  }

  /**
   * Start the preparing task structure phase
   * @param callbacks Functions to call during the phase
   */
  startPreparingPhase(callbacks: {
    onProgressUpdate: (progress: number) => void,
    onComplete: () => void,
    onInitMetadataRendered: () => void,
    onStageTotal: (stage: string, total: number) => void,
    onCategoryAdded: (stage: string, categoryName: string) => void
  }): void {
    if (this.preparingPhaseActive) return;
    
    this.preparingPhaseActive = true;
    this.renderQueue = [];
    this.renderedTasksCount = 0;
    
    // Signal that generation has started
    this.stageManagementService.startGeneration();
    
    // Start minimum duration timer (4.2 seconds)
    const prepareMinDuration = this.progressUtils.startPreparingMinDurationTimer();
    
    // Start preparing animation
    this.progressUtils.startPreparingAnimation((progress) => {
      this.preparingProgressSubject.next(progress);
      callbacks.onProgressUpdate(progress);
    });
    
    // Process initialization queue (metadata like stage totals and categories)
    this.taskGenerationService.startProcessingInitQueue({
      onStageTotal: (stage, total) => {
        // Record the total tasks for this stage
        this.stageManagementService.setStageTotal(stage, total);
        
        // Track total expected tasks
        this.totalExpectedTasks += total;
        
        // Call the callback
        callbacks.onStageTotal(stage, total);
      },
      onCategory: (stage, categoryName) => {
        // Record the category for this stage
        this.stageManagementService.addCategory(stage, categoryName);
        
        // Call the callback
        callbacks.onCategoryAdded(stage, categoryName);
      },
      onQueueComplete: () => {
        // All metadata rendered, signal that initialization is complete
        callbacks.onInitMetadataRendered();
        
        // Wait for minimum duration before transitioning to next phase
        prepareMinDuration.then(() => {
          this.completePreparingPhase(callbacks.onProgressUpdate, callbacks.onComplete);
        });
      }
    });
  }
  
  /**
   * Complete the preparing phase and transition to task rendering
   */
  private completePreparingPhase(
    onProgressUpdate: (progress: number) => void,
    onComplete: () => void
  ): void {
    // Get current progress to continue animation from
    const currentProgress = this.preparingProgressSubject.value;
    
    // Complete preparing animation with quick progression to 100%
    this.progressUtils.completePreparingAnimation(
      currentProgress,
      (progress) => {
        this.preparingProgressSubject.next(progress);
        onProgressUpdate(progress);
      },
      () => {
        this.preparingPhaseActive = false;
        onComplete();
        
        // Move to the first stage for task generation
        this.stageManagementService.setWorkingStage(this.stageManagementService.STAGE_KEYS[0]);
        
        // Begin rendering tasks
        this.startRenderingTasks();
      }
    );
  }
  
  /**
   * Add a task to the render queue
   * @param task Task data from backend
   */
  addTaskToRenderQueue(task: any): void {
    this.renderQueue.push(task);
    
    // If we're not currently rendering tasks and preparing is done, start rendering
    if (!this.renderingTasksActive && !this.preparingPhaseActive) {
      this.startRenderingTasks();
    }
  }
  
  /**
   * Start rendering tasks from the queue with dynamic pacing
   */
  private startRenderingTasks(): void {
    if (this.renderingTasksActive || this.preparingPhaseActive) return;
    
    this.renderingTasksActive = true;
    console.log('Starting to render tasks with', this.renderQueue.length, 'items in queue');
    
    const renderNextTask = () => {
      if (this.renderQueue.length === 0) {
        // No more tasks in queue, but check again after a delay
        // in case more tasks arrive
        setTimeout(() => {
          if (this.renderQueue.length > 0) {
            renderNextTask();
          } else {
            // If we've rendered all expected tasks, complete generation
            if (this.renderedTasksCount >= this.totalExpectedTasks && this.totalExpectedTasks > 0) {
              this.stageManagementService.completeGeneration();
            }
            
            this.renderingTasksActive = false;
            console.log('Finished rendering tasks - queue empty');
          }
        }, 1000);
        return;
      }
      
      // Dequeue and render next task
      const taskData = this.renderQueue.shift();
      
      // Update stage being worked on if needed
      if (taskData && taskData.stage) {
        this.stageManagementService.setWorkingStage(taskData.stage);
      }
      
      // Process the task through our rendering callbacks
      if (this.renderCallbacks?.onTaskProcessed && taskData) {
        // Create standardized task object with safe handling for undefined
        const task = this.createTaskFromData(taskData);
        
                        // Update stage generated tasks count        if (task.stage) {          this.stageManagementService.incrementGeneratedTasks(task.stage);        }
        
        // Increment rendered tasks count
        this.renderedTasksCount++;
        
        // Call the rendering callback
        this.renderCallbacks.onTaskProcessed(task);
        
        // Signal batch complete
        if (this.renderCallbacks.onBatchComplete) {
          this.renderCallbacks.onBatchComplete();
        }
      }
      
      // Calculate delay based on queue length as specified:
      // - If queue has 2+ items, use 500ms delay 
      // - If queue has 1 item (almost empty), use 1500ms delay
      const delay = this.renderQueue.length >= 2 ? 500 : 1500;
      
      // Schedule next task rendering with calculated delay
      setTimeout(renderNextTask, delay);
    };
    
    // Start rendering the first task
    renderNextTask();
  }
  
  // Render callbacks storage
  private renderCallbacks: {
    onTaskProcessed: (task: RelocationTask) => void,
    onBatchComplete?: () => void
  } | null = null;
  
  /**
   * Creates a standardized task object from backend data
   * @param taskData Raw task data from backend
   * @returns Formatted task object
   */
  private createTaskFromData(taskData: any): RelocationTask {
    // Create a safe summary generator function
    const summaryGenerator = (explanation: string | undefined): string => {
      return this.generateSummary(explanation, 120);
    };
    
    // Call the task generation service with our summary generator
    return this.taskGenerationService.createTaskFromData(taskData, summaryGenerator);
  }
  
  /**
   * Set rendering callbacks
   * @param callbacks Callbacks for task rendering
   */
  setRenderCallbacks(callbacks: {
    onTaskProcessed: (task: RelocationTask) => void,
    onBatchComplete?: () => void
  }): void {
    this.renderCallbacks = callbacks;
  }
  
  /**
   * Check if preparing phase is active
   */
  isPreparingActive(): boolean {
    return this.preparingPhaseActive;
  }
  
  /**
   * Check if rendering tasks is active
   */
  isRenderingActive(): boolean {
    return this.renderingTasksActive;
  }
  
  /**
   * Get current number of rendered tasks
   */
  getRenderedTasksCount(): number {
    return this.renderedTasksCount;
  }
  
  /**
   * Get total expected tasks
   */
  getTotalExpectedTasks(): number {
    return this.totalExpectedTasks;
  }
  
  /**
   * Generate a summary of the task importance explanation
   * @param explanation Full explanation text
   * @returns Shortened summary
   */
  generateImportanceExplanationSummary(explanation: string): string {
    if (!explanation) return '';
    
    const maxLength = 120; // Maximum length for summary
    
    if (explanation.length <= maxLength) {
      return explanation;
    }
    
    return explanation.substring(0, maxLength - 3) + '...';
  }
  
  /**
   * Handle a click with debounce to prevent double-clicks
   * @param handler Function to call when debounced click occurs
   */
  handleDebouncedClick(handler: () => void): void {
    this.clickSubject.next({ handler });
  }
  
  /**
   * Helper method for Angular *ngFor trackBy function
   * @param index Index in the array
   * @param task Task item
   * @returns A unique identifier for the task
   */
  trackByTaskId(index: number, task: RelocationTask): string {
    return task.task_id || `task-${index}`;
  }
} 