import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DateUtils {
  // Cache maps to improve performance
  private dueDateCache: Map<string, Date | null> = new Map();
  private relativeDueDateCache: Map<string, string> = new Map();
  private formattedDateCache: Map<string, string> = new Map();
  private isAbsoluteDateCache: Map<string, boolean> = new Map();

  clearCaches() {
    this.dueDateCache.clear();
    this.relativeDueDateCache.clear();
    this.formattedDateCache.clear();
    this.isAbsoluteDateCache.clear();
  }

  interpretDueDateString(dueDateStr: string, moveDate: string | null): Date | null {
    if (!dueDateStr || !moveDate) {
      return null;
    }

    // Check cache first
    if (this.dueDateCache.has(dueDateStr)) {
      const cachedResult = this.dueDateCache.get(dueDateStr);
      return cachedResult !== undefined ? cachedResult : null;
    }

    const cleanedStr = dueDateStr.trim().toLowerCase();
    let baseMoveDate = new Date(moveDate); // User's move date from quiz

    if (isNaN(baseMoveDate.getTime())) { // Invalid moveDate in quiz
      this.dueDateCache.set(dueDateStr, null);
      return null;
    }
    
    // Set baseMoveDate to midnight for consistent day-based calculations
    baseMoveDate = new Date(baseMoveDate.getFullYear(), baseMoveDate.getMonth(), baseMoveDate.getDate());

    let result: Date | null = null;

    if (cleanedStr === "day of move" || cleanedStr === "day of arrival") {
      result = baseMoveDate;
    } else if (cleanedStr === "day before move" || cleanedStr === "1 day before move") {
      const target = new Date(baseMoveDate);
      target.setDate(baseMoveDate.getDate() - 1);
      result = target;
    } else {
      // Check for range expressions like "2-4 weeks" and use the first value for predictability
      const weeksRangeMatch = cleanedStr.match(/(\d+)(?:-(\d+))?\s*weeks?/);
      if (weeksRangeMatch) {
        const firstWeek = parseInt(weeksRangeMatch[1], 10);
        if (weeksRangeMatch[2]) {
          // It's a range like "2-4 weeks" - use the first value (not average) for better predictability
          const target = new Date();
          target.setDate(target.getDate() + (firstWeek * 7));
          result = target;
        } else {
          // Single value like "2 weeks"
          const target = new Date();
          target.setDate(target.getDate() + (firstWeek * 7));
          result = target;
        }
      } else {
        const weeksBeforeMatch = cleanedStr.match(/(\d+)(?:-\d+)?\s*weeks?\s*before\s*move/);
        if (weeksBeforeMatch && weeksBeforeMatch[1]) {
          const weeks = parseInt(weeksBeforeMatch[1], 10);
          const target = new Date(baseMoveDate);
          target.setDate(baseMoveDate.getDate() - (weeks * 7));
          result = target;
        } else {
          // Check for range expressions like "10-14 days" and use the first value (not average)
          const daysRangeMatch = cleanedStr.match(/(\d+)(?:-(\d+))?\s*days?/);
          if (daysRangeMatch) {
            const firstDays = parseInt(daysRangeMatch[1], 10);
            if (daysRangeMatch[2]) {
              // It's a range like "10-14 days" - use the first value for better predictability
              const target = new Date();
              target.setDate(target.getDate() + firstDays);
              result = target;
            } else {
              // Single value like "10 days"
              const target = new Date();
              target.setDate(target.getDate() + firstDays);
              result = target;
            }
          } else {
            const daysBeforeMatch = cleanedStr.match(/(\d+)(?:-\d+)?\s*days?\s*before\s*move/);
            if (daysBeforeMatch && daysBeforeMatch[1]) {
              const days = parseInt(daysBeforeMatch[1], 10);
              const target = new Date(baseMoveDate);
              target.setDate(baseMoveDate.getDate() - days);
              result = target;
            } else if (cleanedStr === "asap" || cleanedStr === "as soon as possible") {
              // For ASAP, use today's date
              result = new Date();
            } else if (cleanedStr === "ongoing") {
              // For ongoing, use today
              result = new Date();
            } else {
              // If the string itself is a parsable ISO date (e.g., from a custom task)
              const directDate = new Date(dueDateStr); // Try parsing original string directly
              if (!isNaN(directDate.getTime())) {
                result = directDate;
              }
            }
          }
        }
      }
    }

    // Cache the result
    this.dueDateCache.set(dueDateStr, result);
    return result;
  }

  isAbsoluteDate(dateString: string | undefined | null, moveDate: string | null): boolean {
    if (!dateString) {
      return false;
    }
    
    // Check cache first
    if (this.isAbsoluteDateCache.has(dateString)) {
      return this.isAbsoluteDateCache.get(dateString)!;
    }
    
    const cleanedDateString = dateString.trim();
    // First, try to interpret it based on known patterns relative to moveDate
    const interpretedDate = this.interpretDueDateString(cleanedDateString, moveDate);
    let result = false;
    
    if (interpretedDate) { // If successfully interpreted, it's an absolute date
      result = true;
    } else {
      // If not interpretable relative to moveDate, check if it's a standalone parsable date
      const date = new Date(cleanedDateString);
      result = !isNaN(date.getTime());
    }
    
    // Cache the result
    this.isAbsoluteDateCache.set(dateString, result);
    return result;
  }

  formatDateWithOrdinal(dateInput: string | undefined | null, moveDate: string | null): string {
    if (!dateInput) return 'N/A';
    
    // Check cache first
    if (this.formattedDateCache.has(dateInput)) {
      return this.formattedDateCache.get(dateInput)!;
    }
    
    const cleanedDateInput = dateInput.trim();

    // Attempt to interpret the string first (e.g. "Day of move")
    let dateToFormat = this.interpretDueDateString(cleanedDateInput, moveDate);
    let result: string;

    if (!dateToFormat) {
      // If not interpretable, try parsing as a direct date string
      const directDate = new Date(cleanedDateInput);
      if (!isNaN(directDate.getTime())) {
        dateToFormat = directDate;
      } else {
        // If still not a date, return original
        result = cleanedDateInput;
        this.formattedDateCache.set(dateInput, result);
        return result;
      }
    }

    const day = dateToFormat.getDate();
    const month = dateToFormat.toLocaleDateString(undefined, { month: 'long' });
    const year = dateToFormat.getFullYear();
    result = `${day}${this.getOrdinalSuffix(day)} ${month} ${year}`;
    
    // Cache the result
    this.formattedDateCache.set(dateInput, result);
    return result;
  }

  getRelativeDueDate(dueDateInput: string, moveDate: string | null): string {
    if (!dueDateInput) {
      return '';
    }
    
    // Check cache first
    if (this.relativeDueDateCache.has(dueDateInput)) {
      return this.relativeDueDateCache.get(dueDateInput)!;
    }
    
    const cleanedDueDateInput = dueDateInput.trim();
    let result: string;

    // For range expressions, explicitly mention the range and the concrete date
    const weeksRangeMatch = cleanedDueDateInput.toLowerCase().match(/(\d+)-(\d+)\s*weeks?/);
    if (weeksRangeMatch) {
      const firstWeek = parseInt(weeksRangeMatch[1], 10);
      const secondWeek = parseInt(weeksRangeMatch[2], 10);
      
      // Format with tilde to indicate approximation - remove concrete date
      result = `~${firstWeek}-${secondWeek} week window`;
    } else {
      const daysRangeMatch = cleanedDueDateInput.toLowerCase().match(/(\d+)-(\d+)\s*days?/);
      if (daysRangeMatch) {
        const firstDays = parseInt(daysRangeMatch[1], 10);
        const secondDays = parseInt(daysRangeMatch[2], 10);
        
        // Format with tilde to indicate approximation - remove concrete date
        result = `~${firstDays}-${secondDays} day window`;
      } else {
        // Attempt to interpret the string into an absolute date first
        const absoluteDate = this.interpretDueDateString(cleanedDueDateInput, moveDate);

        if (absoluteDate) { // Successfully interpreted to an absolute date
          const now = new Date();
          const dueDateDay = new Date(absoluteDate.getFullYear(), absoluteDate.getMonth(), absoluteDate.getDate());
          const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const diffTime = dueDateDay.getTime() - nowDay.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays < -1) {
            const diffWeeksOverdue = Math.floor(Math.abs(diffDays) / 7);
            if (diffWeeksOverdue >= 1) {
              result = `Overdue ~${diffWeeksOverdue} week${diffWeeksOverdue !== 1 ? 's' : ''}`;
            } else {
              result = `Overdue ~${Math.abs(diffDays)} days`;
            }
          } else if (diffDays === -1) {
            result = `Overdue ~1 day`;
          } else if (diffDays === 0) {
            result = `Due today`;
          } else if (diffDays === 1) {
            result = `Due tomorrow`;
          } else if (diffDays < 7) {
            result = `Due in ~${diffDays} days`;
          } else {
            const diffWeeks = Math.floor(diffDays / 7);
            if (diffWeeks === 1) {
              result = `Due in ~1 week`;
            } else if (diffWeeks < 52) { // Less than a year
              result = `Due in ~${diffWeeks} weeks`;
            } else {
              // If more than a year away, just show the formatted date
              result = this.formatDateWithOrdinalNoCache(dueDateDay);
            }
          }
        } else {
          // If not interpretable, return original string
          result = cleanedDueDateInput;
        }
      }
    }
    
    // Cache the result
    this.relativeDueDateCache.set(dueDateInput, result);
    return result;
  }

  parseDueDateRange(dueDateStr: string | undefined, moveDate: string | null): number {
    if (!dueDateStr) return Infinity;
    const cleanedStr = dueDateStr.trim();

    // Use the cached interpretation
    const absoluteDate = this.interpretDueDateString(cleanedStr, moveDate);
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

  private getOrdinalSuffix(day: number): string {
    const j = day % 10,
          k = day % 100;
    if (j == 1 && k != 11) return "st";
    if (j == 2 && k != 12) return "nd";
    if (j == 3 && k != 13) return "rd";
    return "th";
  }

  // Helper method to format date with ordinal without using cache
  private formatDateWithOrdinalNoCache(date: Date): string {
    const day = date.getDate();
    const month = date.toLocaleDateString(undefined, { month: 'long' });
    const year = date.getFullYear();
    return `${day}${this.getOrdinalSuffix(day)} ${month} ${year}`;
  }
} 