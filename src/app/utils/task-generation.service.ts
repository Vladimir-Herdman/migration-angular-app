import { Injectable } from '@angular/core';
import { DateUtils } from './date-utils';
import { FilterUtils, TaskCategory, RelocationTask, ChecklistByStageAndCategory } from './filter-utils';
import { ProgressUtils } from './progress-utils';
import { CacheUtils } from './cache-utils';
import { ChangeDetectorRef } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class TaskGenerationService {
  // Queue system for controlled rendering
  private init_queue: {type: 'stageTotals' | 'category', stage: string, data: any}[] = [];
  private gen_tasks: any[] = [];
  private initQueueProcessing: boolean = false;
  private genTasksProcessing: boolean = false;

  constructor(
    private progressUtils: ProgressUtils
  ) {}

  /**
   * Process a stream of tasks from the backend
   * @param response Response from the backend API
   * @param callbacks Callbacks for various events during task processing
   * @returns Object with task generation results
   */
  async processTaskStream(
    response: Response,
    callbacks: {
      onInitialStructure: (data: any) => void,
      onTaskItemAdded: (task: any) => void,
      onStreamEnd: (data: any) => void,
      onError: (error: any) => void,
      onComplete: () => void
    }
  ): Promise<{
    success: boolean,
    generatedCount: number,
    totalCount: number
  }> {
    if (!response.body) {
      callbacks.onError('No response body');
      return { success: false, generatedCount: 0, totalCount: 0 };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let partialData = '';
    let generatedTasksCount = 0;
    let totalTasksToGenerate = 0;

    try {
      // Process the stream data
      while (true) {
        const { done, value } = await reader.read();
        
        // Make sure all pending tasks are processed before exiting the loop
        if (done) {
          console.log('Stream reading complete, received', this.gen_tasks.length, 'pending tasks and', generatedTasksCount, 'rendered tasks');
          
          // If we have pending tasks, ensure they're processed
          if (this.gen_tasks.length > 0) {
            // Give some time for task processing to catch up
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          break;
        }

        partialData += decoder.decode(value, { stream: true });
        const lines = partialData.split('\n');
        partialData = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              
              if (data.event_type === 'initial_structure') {
                totalTasksToGenerate = data.total_applicable_tasks || 0;
                
                // Notify caller about initial structure
                callbacks.onInitialStructure(data);
                
                // Reset queues
                this.init_queue = [];
                this.gen_tasks = [];
                
                // Add stage totals to init_queue first (they'll be processed first)
                const stages = ['predeparture', 'departure', 'arrival'] as const;
                for (const stage of stages) {
                  const stageTotal = data.stage_totals?.[stage] || 0;
                  if (stageTotal > 0) {
                    this.init_queue.push({
                      type: 'stageTotals',
                      stage,
                      data: stageTotal
                    });
                  }
                }
                
                // Then add all categories to init_queue (they'll be processed after totals)
                for (const stage of stages) {
                  const categories = data.categories_by_stage?.[stage] || [];
                  for (const catName of categories) {
                    this.init_queue.push({
                      type: 'category',
                      stage,
                      data: catName
                    });
                  }
                }
              } else if (data.event_type === 'task_item') {
                // Add task to queue for processing
                this.gen_tasks.push(data);
                
                // Notify caller about task item
                callbacks.onTaskItemAdded(data);
                
              } else if (data.event_type === 'stream_end') {
                console.log(`Stream ended. Total tasks streamed by backend: ${data.total_streamed}`);
                callbacks.onStreamEnd(data);
              }
            } catch (e) {
              console.error('Error parsing streamed JSON:', e, 'Line:', line);
              callbacks.onError(`Error parsing streamed JSON: ${e}`);
            }
          }
        }
      }
      
      callbacks.onComplete();
      return { 
        success: true, 
        generatedCount: generatedTasksCount,
        totalCount: totalTasksToGenerate
      };
    } catch (error) {
      console.error('Error processing task stream:', error);
      callbacks.onError(error);
      return { 
        success: false, 
        generatedCount: generatedTasksCount,
        totalCount: totalTasksToGenerate
      };
    }
  }

  /**
   * Start processing the initialization queue
   * @param callbacks Callbacks for initialization events
   */
  startProcessingInitQueue(callbacks: {
    onStageTotal: (stage: string, total: number) => void,
    onCategory: (stage: string, categoryName: string) => void,
    onQueueComplete: () => void
  }): void {
    if (this.initQueueProcessing || this.init_queue.length === 0) return;
    
    this.initQueueProcessing = true;
    console.log('Starting to process init_queue with', this.init_queue.length, 'items');
    
    // Process one item every 250ms for a more noticeable sequential rendering
    const processItem = () => {
      if (this.init_queue.length === 0) {
        this.initQueueProcessing = false;
        console.log('Finished processing init_queue');
        callbacks.onQueueComplete();
        return;
      }
      
      const item = this.init_queue.shift();
      
      if (item && item.type === 'stageTotals') {
        // Process stage totals
        callbacks.onStageTotal(item.stage, item.data);
      } else if (item && item.type === 'category') {
        // Process category
        callbacks.onCategory(item.stage, item.data);
      }
      
      // Process next item after 250ms for more noticeable animation
      setTimeout(processItem, 250);
    };
    
    // Start processing
    processItem();
  }

  /**
   * Start processing the generated tasks queue
   * @param callbacks Callbacks for task generation events
   */
  startProcessingGenTasks(callbacks: {
    onTaskProcessed: (taskData: any) => void,
    onBatchComplete: () => void,
    onQueueComplete: () => void,
    getTotalTasksToGenerate: () => number,
    getCurrentTaskCount: () => number
  }): void {
    if (this.genTasksProcessing) return;
    
    // If there are no tasks in the queue yet but more are expected, mark we're processing
    // so future tasks will be processed as they arrive
    const totalExpected = callbacks.getTotalTasksToGenerate();
    const currentCount = callbacks.getCurrentTaskCount();
    
    if (this.gen_tasks.length === 0 && currentCount < totalExpected) {
      this.genTasksProcessing = true;
      console.log('Waiting for tasks to arrive...');
      return;
    }
    
    this.genTasksProcessing = true;
    console.log('Starting to process gen_tasks with', this.gen_tasks.length, 'items');
    
    // Process tasks one at a time with variable delays for a smoother sequential appearance
    const processNextTask = () => {
      // If no more tasks, check if we're done or waiting for more
      if (this.gen_tasks.length === 0) {
        if (currentCount < totalExpected) {
          // More tasks expected, schedule another check
          setTimeout(processNextTask, 500);
        } else {
          // All tasks processed
          this.genTasksProcessing = false;
          console.log('Finished processing gen_tasks - total tasks rendered:', callbacks.getCurrentTaskCount());
          callbacks.onQueueComplete();
        }
        return;
      }
      
      // Get the next task
      const task = this.gen_tasks.shift();
      if (task) {
        // Process this single task
        callbacks.onTaskProcessed(task);
        
        // Calculate delay based on progress - start slower, speed up as we get further along
        const progressRatio = callbacks.getCurrentTaskCount() / totalExpected;
        
        // Delay calculation: 
        // - Early tasks (0% progress): ~300-400ms between tasks
        // - Middle tasks (50% progress): ~200ms between tasks
        // - Late tasks (90%+ progress): ~100ms between tasks
        // - Add small random variation for natural feel (+/- 50ms)
        const baseDelay = Math.max(100, Math.floor(400 - progressRatio * 300));
        const randomVariation = Math.floor(Math.random() * 50) - 25; // Random value between -25 and +25
        const nextDelay = Math.max(80, baseDelay + randomVariation); // Ensure minimum delay of 80ms
        
        // Signal batch complete after each task (now just a single task)
        callbacks.onBatchComplete();
        
        // Schedule the next task with calculated delay
        setTimeout(processNextTask, nextDelay);
      } else {
        // No task (shouldn't happen, but handle it)
        setTimeout(processNextTask, 200);
      }
    };
    
    // Start processing the first task
    processNextTask();
  }

  /**
   * Creates a standardized task object from backend data
   * @param taskData Raw task data from backend
   * @param generateSummary Function to generate a summary 
   * @returns Formatted task object
   */
  createTaskFromData(taskData: any, generateSummary: (explanation: string | undefined) => string): RelocationTask {
    const stageKey = taskData.stage;
    const categoryName = taskData.category || 'General';
    
    return {
      task_id: taskData.task_id,
      task_description: taskData.task_description,
      priority: taskData.priority,
      due_date: taskData.due_date,
      importance_explanation: taskData.importance_explanation,
      importance_explanation_summary: generateSummary(taskData.importance_explanation),
      recommended_services: taskData.recommended_services || [],
      isExpanded: false,
      completed: taskData.completed !== undefined ? taskData.completed : false,
      isImportant: taskData.isImportant !== undefined ? taskData.isImportant : false,
      stage: stageKey,
      category: categoryName,
      notes: taskData.notes || ''
    };
  }
  
  /**
   * Clears all tasks processing queues
   */
  clearQueues(): void {
    this.init_queue = [];
    this.gen_tasks = [];
    this.initQueueProcessing = false;
    this.genTasksProcessing = false;
  }
  
  /**
   * Resets task completion status without altering structure
   * @param checklistData The checklist data to reset
   * @returns Updated checklist data with all tasks marked as not completed
   */
  resetTaskCompletionStatus(checklistData: ChecklistByStageAndCategory): ChecklistByStageAndCategory {
    Object.keys(checklistData).forEach(stageKey => {
      const stage = stageKey as keyof ChecklistByStageAndCategory;
      checklistData[stage].forEach(category => {
        category.tasks.forEach(task => {
          task.completed = false;
        });
      });
    });
    
    return checklistData;
  }
} 