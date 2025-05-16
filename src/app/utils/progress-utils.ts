import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ProgressUtils {
  // Track animation state
  private preparingAnimationInterval: any = null;
  private preparingAnimationComplete: boolean = false;
  private preparingMinDurationPromise: Promise<void> | null = null;
  private preparingAnimationDuration: number = 4200; // Fixed 4.2 seconds for preparing animation

  // Start the preparing progress animation with fixed duration (4.2 seconds)
  startPreparingAnimation(onProgressUpdated: (progress: number) => void): void {
    // Clear any existing animation
    this.stopPreparingAnimation();
    
    // Reset animation state
    this.preparingAnimationComplete = false;
    let preparingProgress = 0;
    
    // Calculate the total animation time (4.2 seconds) and number of steps
    const totalDuration = this.preparingAnimationDuration; // 4200ms (4.2 seconds)
    const updateInterval = 50; // Update every 50ms for smooth animation
    const totalSteps = totalDuration / updateInterval;
    
    // Instead of calculating a dynamic step, we'll use a smooth easeInOut curve
    // that gradually slows down as it approaches 95% but never goes backwards
    let currentStep = 0;
    
    // Start the animation loop with fixed interval
    this.preparingAnimationInterval = setInterval(() => {
      currentStep++;
      
      // Use easeInOutQuad function for smooth animation
      // Progress will be 0 to 0.95 over the full duration
      const progress = currentStep / totalSteps;
      const eased = this.easeInOutQuad(progress);
      preparingProgress = Math.min(eased * 0.95, 0.95); // Cap at 95%
      
      // Don't allow progress to decrease
      if (currentStep >= totalSteps) {
        // We've reached our time limit, but don't complete yet
        // The complete animation will be triggered separately
        this.stopPreparingAnimation();
      }
      
      onProgressUpdated(preparingProgress);
    }, updateInterval);
  }
  
  // NEW METHOD: Control preparing animation with variable speed based on content loading
  controlPreparingAnimation(progress: number, totalItems: number, loadedItems: number): number {
    // Slow down at 50% if we have many items left to render
    if (progress >= 0.5 && totalItems > 0) {
      const remainingPercentage = 0.5;
      const itemProgress = loadedItems / totalItems;
      // Calculate how much of the remaining 50% we should show
      return 0.5 + (remainingPercentage * itemProgress);
    }
    return progress;
  }
  
  // NEW METHOD: Determines optimal task rendering delay based on queue size
  calculateTaskRenderDelay(queueSize: number): number {
    // Faster rendering for larger queues, slower for smaller queues
    if (queueSize > 50) return 20;  // Very fast for large queues
    if (queueSize > 20) return 50;  // Medium pace
    if (queueSize > 10) return 100; // Slower
    if (queueSize > 5) return 150;  // Even slower
    return 200; // Slowest for 1-5 tasks
  }
  
  // Complete the preparing animation quickly
  completePreparingAnimation(startValue: number, onProgressUpdated: (progress: number) => void, onComplete: () => void): void {
    this.stopPreparingAnimation();
    this.preparingAnimationComplete = true;
    
    // Quick progression to 100%
    const duration = 666; // 0.666 seconds as requested
    const startTime = performance.now();
    
    // Make sure the onComplete callback is called even if animation is interrupted
    let hasCalledComplete = false;
    
    const ensureComplete = () => {
      if (!hasCalledComplete) {
        hasCalledComplete = true;
        
        // Set progress to 1 (100%) to ensure animation looks complete
        onProgressUpdated(1);
        
        // Call onComplete with a slight delay to ensure UI is updated
        setTimeout(() => {
          onComplete();
        }, 750);
      }
    };
    
    // Set a timeout to ensure onComplete is called even if animation is interrupted
    const safetyTimeout = setTimeout(ensureComplete, 2000);
    
    const animate = (currentTime: number) => {
      const elapsedTime = currentTime - startTime;
      
      if (elapsedTime < duration) {
        // Calculate progress using easeOut effect
        const t = elapsedTime / duration;
        const easeOut = 1 - Math.pow(1 - t, 2);
        const progress = startValue + (1 - startValue) * easeOut;
        onProgressUpdated(progress);
        requestAnimationFrame(animate);
      } else {
        // Ensure we end at exactly 1 and call onComplete
        onProgressUpdated(1);
        clearTimeout(safetyTimeout);
        
        // Add a 750ms delay before calling onComplete
        console.log('Preparing animation complete, waiting 750ms before continuing...');
        setTimeout(() => {
          ensureComplete();
        }, 750);
      }
    };
    
    requestAnimationFrame(animate);
  }
  
  // Stop the preparing animation
  stopPreparingAnimation(): void {
    if (this.preparingAnimationInterval) {
      clearInterval(this.preparingAnimationInterval);
      this.preparingAnimationInterval = null;
    }
  }
  
  // Start the minimum duration timer for preparing phase (4.2 seconds)
  startPreparingMinDurationTimer(): Promise<void> {
    this.preparingMinDurationPromise = new Promise(resolve => setTimeout(resolve, this.preparingAnimationDuration));
    return this.preparingMinDurationPromise;
  }
  
  // Smoothing function for animation
  easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  // Function to handle progress bar drain animation
  resetProgressBarsWithAnimation(
    onDrainStart: () => void,
    onAnimationComplete: () => void
  ): void {
    // Step 1: Trigger the drain animation
    onDrainStart();
    
    // Step 2: Wait for animation to complete, then reset counters
    // Use a longer animation duration (1200ms instead of 800ms) for more noticeable effect
    
    // Add a small delay before starting the drain animation to ensure it's noticed
    setTimeout(() => {
      // After a small delay to make the animation more noticeable, reset the counters
      setTimeout(() => {
        onAnimationComplete();
      }, 1200); // Longer animation duration for more visibility
    }, 200); // Small initial delay to make the transition more visible
  }

  // Get progress bar color for a stage
  getStageProgressColor(
    isGeneratingChecklist: boolean,
    workingOnStage: string,
    stageKey: string,
    current: number,
    total: number
  ): string {
    // During generation process
    if (isGeneratingChecklist) {
      // Only show success when ALL tasks for the stage are actually generated
      if (total > 0 && current >= total) {
        return 'success'; // Stage generation is complete
      }
      
      if (stageKey === workingOnStage) {
        return 'primary'; // Currently active stage
      }
      
      // Default for non-active, incomplete stages during generation
      return 'medium';
    } 
    // After generation is complete, show progress based on task completion
    else {
      if (total > 0 && current >= total) {
        return 'success'; // All tasks completed
      }
   
      return 'primary'; // Normal progress color for completed checklist
    }
  }

  // Calculate progress value for a stage
  getStageProgressValue(
    isGeneratingChecklist: boolean,
    workingOnStage: string,
    initialStructureReceived: boolean,
    stageKey: string,
    current: number,
    total: number,
    generatedCount: number = 0 // New parameter for generation progress
  ): number {
    // During generation, use expected total tasks (X) as denominator
    if (isGeneratingChecklist) {
      if (total <= 0) return 0;
      
      // If in preparing phase and we have received the initial structure, 
      // show tiny progress to make bars visible with stage totals
      if (workingOnStage === 'preparing' && initialStructureReceived) {
        return 0.02; // Show a tiny progress to make the bar visible during preparation
      }
      
      // Calculate the exact progress for each stage based on GENERATED tasks (not completed)
      // This makes the stage progress bars act as loading bars that fill up as tasks are generated
      const progress = generatedCount / total;
      
      // For all stages, calculate the exact progress value
      if (generatedCount === 0) {
        return 0.02; // Just a tiny bit visible when no tasks are generated
      } else if (generatedCount >= total) {
        return 1.0; // 100% if all tasks are generated
      } else {
        return progress; // Exact progress based on generated tasks
      }
    } 
    // After generation is complete, show progress of completed tasks ONLY
    // Use actual generated tasks (Y) as denominator
    else {
      // IMPORTANT: After generation, 'current' should ONLY represent completed tasks count
      // and NOT the number of generated tasks
      if (total <= 0) return 0;
      
      // Make sure we're only using task completion status for progress
      // This ensures opening categories doesn't affect progress
      return current / total; // Use completion progress after generation
    }
  }

  // Check if a stage is completed
  isStageCompleted(
    isGeneratingChecklist: boolean,
    stageKey: string,
    current: number,
    total: number
  ): boolean {
    // During generation, check if all expected tasks are generated
    if (isGeneratingChecklist) {
      // Only consider a stage complete if it has expected tasks AND all of them are generated
      return total > 0 && current >= total;
    } 
    // After generation, check if all actual tasks are checked off
    else {
      return total > 0 && current >= total;
    }
  }
} 