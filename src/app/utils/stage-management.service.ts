import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ChecklistByStageAndCategory, TaskCategory } from './filter-utils';
import { ProgressUtils } from './progress-utils';

export interface StageInfo {
  key: string;
  label: string;
  order: number;
  totalTasks: number;
  generatedTasks: number;
  completedTasks: number;
  categories: { [categoryName: string]: boolean }; // Whether category is displayed
}

@Injectable({
  providedIn: 'root'
})
export class StageManagementService {
  // Stage definition constants 
  readonly STAGE_KEYS = ['predeparture', 'departure', 'arrival'] as const;
  readonly STAGE_LABELS: { [key: string]: string } = {
    'predeparture': 'Pre-Departure',
    'departure': 'Departure',
    'arrival': 'Arrival'
  };
  
  // Stage tracking
  private stageInfoMap = new Map<string, StageInfo>();
  private currentStageKey = new BehaviorSubject<string>('predeparture');
  public currentStage$ = this.currentStageKey.asObservable();
  
  // Generation state tracking
  private isGenerating = new BehaviorSubject<boolean>(false);
  public isGenerating$ = this.isGenerating.asObservable();
  private workingOnStage = new BehaviorSubject<string>('preparing');
  public workingOnStage$ = this.workingOnStage.asObservable();
  
  constructor(private progressUtils: ProgressUtils) {
    // Initialize stage info with default values
    this.resetStages();
  }
  
  /**
   * Reset stages to initial state
   */
  resetStages(): void {
    this.stageInfoMap.clear();
    
    // Initialize stage info with default values
    this.STAGE_KEYS.forEach((stageKey, index) => {
      this.stageInfoMap.set(stageKey, {
        key: stageKey,
        label: this.STAGE_LABELS[stageKey],
        order: index,
        totalTasks: 0,
        generatedTasks: 0,
        completedTasks: 0,
        categories: {}
      });
    });
    
    // Reset current stage to first stage
    this.currentStageKey.next('predeparture');
    
    // Reset generation state
    this.isGenerating.next(false);
    this.workingOnStage.next('preparing');
  }
  
  /**
   * Start generation process
   */
  startGeneration(): void {
    this.isGenerating.next(true);
    this.workingOnStage.next('preparing');
  }
  
  /**
   * Complete generation process
   */
  completeGeneration(): void {
    this.isGenerating.next(false);
    this.workingOnStage.next('');
  }
  
  /**
   * Set current working stage during generation
   * @param stageKey Stage key to set as current
   */
  setWorkingStage(stageKey: string): void {
    this.workingOnStage.next(stageKey);
  }
  
  /**
   * Set current selected stage (user navigation)
   * @param stageKey Stage key to set as current
   */
  setCurrentStage(stageKey: string): void {
    if (this.stageInfoMap.has(stageKey)) {
      this.currentStageKey.next(stageKey);
    }
  }
  
  /**
   * Set total tasks for a stage
   * @param stageKey Stage key
   * @param total Total number of tasks
   */
  setStageTotal(stageKey: string, total: number): void {
    const stageInfo = this.stageInfoMap.get(stageKey);
    if (stageInfo) {
      stageInfo.totalTasks = total;
      this.stageInfoMap.set(stageKey, stageInfo);
    }
  }
  
  /**
   * Add category to stage
   * @param stageKey Stage key
   * @param categoryName Category name
   */
  addCategory(stageKey: string, categoryName: string): void {
    const stageInfo = this.stageInfoMap.get(stageKey);
    if (stageInfo && categoryName) {
      stageInfo.categories[categoryName] = true;
      this.stageInfoMap.set(stageKey, stageInfo);
    }
  }
  
  /**
   * Increment generated tasks count for a stage
   * @param stageKey Stage key
   */
  incrementGeneratedTasks(stageKey: string): void {
    const stageInfo = this.stageInfoMap.get(stageKey);
    if (stageInfo) {
      stageInfo.generatedTasks++;
      this.stageInfoMap.set(stageKey, stageInfo);
    }
  }
  
  /**
   * Update completed tasks count for a stage
   * @param stageKey Stage key
   * @param completedCount Number of completed tasks
   */
  updateCompletedTasks(stageKey: string, completedCount: number): void {
    const stageInfo = this.stageInfoMap.get(stageKey);
    if (stageInfo) {
      stageInfo.completedTasks = completedCount;
      this.stageInfoMap.set(stageKey, stageInfo);
    }
  }
  
  /**
   * Get stage info by key
   * @param stageKey Stage key
   * @returns Stage info object or undefined if not found
   */
  getStageInfo(stageKey: string): StageInfo | undefined {
    return this.stageInfoMap.get(stageKey) || undefined;
  }
  
  /**
   * Get all stages in order
   * @returns Array of stage info objects in order
   */
  getAllStages(): StageInfo[] {
    return Array.from(this.stageInfoMap.values())
      .sort((a, b) => a.order - b.order);
  }
  
  /**
   * Calculate overall progress across all stages
   * @returns Progress value between 0 and 1
   */
  calculateOverallProgress(): number {
    const stages = this.getAllStages();
    const totalTasks = stages.reduce((sum, stage) => sum + stage.totalTasks, 0);
    
    if (totalTasks === 0) return 0;
    
    // During generation, use generated tasks count
    if (this.isGenerating.value) {
      const generatedTasks = stages.reduce((sum, stage) => sum + stage.generatedTasks, 0);
      return generatedTasks / totalTasks;
    } 
    // After generation, use completed tasks count
    else {
      const completedTasks = stages.reduce((sum, stage) => sum + stage.completedTasks, 0);
      return completedTasks / totalTasks;
    }
  }
  
  /**
   * Get progress color for a stage
   * @param stageKey Stage key
   * @returns Color string for progress bar
   */
  getStageProgressColor(stageKey: string): string {
    const stageInfo = this.stageInfoMap.get(stageKey);
    if (!stageInfo) return 'medium';
    
    return this.progressUtils.getStageProgressColor(
      this.isGenerating.value,
      this.workingOnStage.value,
      stageKey,
      this.isGenerating.value ? stageInfo.generatedTasks : stageInfo.completedTasks,
      stageInfo.totalTasks
    );
  }
  
  /**
   * Get progress value for a stage
   * @param stageKey Stage key
   * @returns Progress value between 0 and 1
   */
  getStageProgressValue(stageKey: string): number {
    const stageInfo = this.stageInfoMap.get(stageKey);
    if (!stageInfo) return 0;
    
    return this.progressUtils.getStageProgressValue(
      this.isGenerating.value,
      this.workingOnStage.value,
      true, // initialStructureReceived
      stageKey,
      this.isGenerating.value ? stageInfo.generatedTasks : stageInfo.completedTasks,
      stageInfo.totalTasks,
      stageInfo.generatedTasks
    );
  }
  
  /**
   * Check if a stage is complete
   * @param stageKey Stage key
   * @returns True if stage is complete
   */
  isStageComplete(stageKey: string): boolean {
    const stageInfo = this.stageInfoMap.get(stageKey);
    if (!stageInfo) return false;
    
    return this.progressUtils.isStageCompleted(
      this.isGenerating.value,
      stageKey,
      this.isGenerating.value ? stageInfo.generatedTasks : stageInfo.completedTasks,
      stageInfo.totalTasks
    );
  }
  
  // ========== BACKWARD COMPATIBILITY METHODS ==========
  // These methods are for backward compatibility with the old API
  // while we migrate the tab_checklist.page.ts code
  
  /**
   * @deprecated Use getStageInfo(stageKey).totalTasks instead
   */
  getExpectedTaskCountForStage(stageKey: string): number {
    const stageInfo = this.stageInfoMap.get(stageKey);
    return stageInfo?.totalTasks || 0;
  }
  
  /**
   * @deprecated Use getStageInfo(stageKey).totalTasks instead
   */
  getTotalTasksForStage(stageKey: string): number {
    return this.getExpectedTaskCountForStage(stageKey);
  }
  
  /**
   * @deprecated Use isStageComplete instead
   */
  isStageCompleted(
    isGeneratingChecklist: boolean,
    stageKey: string
  ): boolean {
    return this.isStageComplete(stageKey);
  }
  
  /**
   * @deprecated Use getStageInfo(stageKey).completedTasks instead
   */
  getCompletedTasksCountForStage(
    stageKey: string,
    countFromChecklist: boolean = false,
    checklistData?: ChecklistByStageAndCategory
  ): number {
    const stageInfo = this.stageInfoMap.get(stageKey);
    if (!stageInfo) return 0;
    
    if (!countFromChecklist) {
      return stageInfo.completedTasks;
    } else if (checklistData) {
      // Count tasks from the provided checklist data
      const stageData = checklistData[stageKey as keyof ChecklistByStageAndCategory];
      if (stageData) {
        return stageData.reduce(
          (total, category) => total + category.tasks.filter(task => task.completed).length, 0);
      }
    }
    
    return 0;
  }
  
  /**
   * @deprecated Use appropriate service methods instead
   */
  updateStageProgressFromData(checklistData: ChecklistByStageAndCategory, selectedStage: string): void {
    // Process currently selected stage
    if (selectedStage) {
      const stageCategories = checklistData[selectedStage as keyof ChecklistByStageAndCategory];
      let completedCount = 0;
      
      if (stageCategories) {
        stageCategories.forEach(cat => {
          completedCount += cat.tasks.filter(t => t.completed).length;
        });
      }
      
      this.updateCompletedTasks(selectedStage, completedCount);
    }
    
    // Process other stages in the background
    setTimeout(() => {
      this.STAGE_KEYS.forEach(stageKey => {
        if (stageKey !== selectedStage) {
          const categories = checklistData[stageKey];
          let completedCount = 0;
          
          if (categories) {
            categories.forEach(cat => {
              completedCount += cat.tasks.filter(t => t.completed).length;
            });
          }
          
          this.updateCompletedTasks(stageKey, completedCount);
        }
      });
    }, 10);
  }
  
  /**
   * @deprecated Use the new API instead
   */
  getStageProgress(): { [key: string]: { current: number, total: number } } {
    // Convert new data structure to old format
    const result: { [key: string]: { current: number, total: number } } = {};
    
    this.STAGE_KEYS.forEach(stageKey => {
      const stageInfo = this.stageInfoMap.get(stageKey);
      if (stageInfo) {
        result[stageKey] = {
          current: this.isGenerating.value ? stageInfo.generatedTasks : stageInfo.completedTasks,
          total: stageInfo.totalTasks
        };
      } else {
        result[stageKey] = { current: 0, total: 0 };
      }
    });
    
    return result;
  }
  
  /**
   * @deprecated Use setStageTotal for each stage instead
   */
  setStageProgressFromBackend(stageData: { [key: string]: number }): void {
    Object.keys(stageData).forEach(stageKey => {
      this.setStageTotal(stageKey, stageData[stageKey] || 0);
    });
  }
  
  /**
   * @deprecated Use resetStages instead
   */
  resetStageProgress(): void {
    this.STAGE_KEYS.forEach(stageKey => {
      const stageInfo = this.stageInfoMap.get(stageKey);
      if (stageInfo) {
        stageInfo.completedTasks = 0;
        this.stageInfoMap.set(stageKey, stageInfo);
      }
    });
  }
  
  /**
   * @deprecated Use STAGE_LABELS property directly
   */
  getStageLabel(
    stageKey: string,
    isGeneratingChecklist: boolean,
    workingOnStage: string,
    isQuestionnaireFilled: boolean,
    initialStructureReceived: boolean
  ): string {
    const stageInfo = this.stageInfoMap.get(stageKey);
    if (!stageInfo) return stageKey.charAt(0).toUpperCase() + stageKey.slice(1);
    
    const stageName = stageInfo.label;
    const total = stageInfo.totalTasks;
    const current = isGeneratingChecklist ? stageInfo.generatedTasks : stageInfo.completedTasks;
    
    if (isGeneratingChecklist && workingOnStage === 'preparing') {
      // We're in the preparing phase
      if (initialStructureReceived) {
        // After receiving initial structure, show expected total counts
        if (total > 0) {
          return `${stageName} (0/${total})`;
        } else {
          return `${stageName} (0)`;
        }
      } else {
        return `${stageName}`;
      }
    } 
    else if (isGeneratingChecklist && this.getTotalTasksCount() > 0) {
      // During active generation phase
      // For all stages, always display completed/total, even if 0
      let label = `${stageName} (${current}/${total})`;
      
      // Only add a checkmark for completed stages
      if (current === total && total > 0) {
        label = `${stageName} (${current}/${total}) ✓`;
      }
      
      return label;
    } 
    else if (!isGeneratingChecklist) {
      // After generation is complete - display completed/total
      if (total > 0 && current === total) {
        return `${stageName} (${current}/${total}) ✓`; // Add checkmark for completed stage
      } else if (total === 0 && isQuestionnaireFilled) {
        return `${stageName} (0)`;
      } else if (!isQuestionnaireFilled) {
        return stageName;
      } else {
        return `${stageName} (${current}/${total})`;
      }
    }
    
    // Default fallback
    return stageName;
  }
  
  /**
   * @deprecated Use calculateOverallProgress instead
   */
  getTotalTasksCount(): number {
    return Array.from(this.stageInfoMap.values()).reduce((sum, stage) => sum + stage.totalTasks, 0);
  }
  
  /**
   * @deprecated Use calculateOverallProgress instead
   */
  getTotalCompletedCount(): number {
    return Array.from(this.stageInfoMap.values()).reduce((sum, stage) => {
      return sum + (this.isGenerating.value ? stage.generatedTasks : stage.completedTasks);
    }, 0);
  }
} 