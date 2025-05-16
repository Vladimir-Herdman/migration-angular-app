import { Injectable } from '@angular/core';
import { ChecklistFilterData } from '../components/filter-popover/filter-popover.component';
import { DateUtils } from './date-utils';

// Define the interfaces needed for filtering
export interface ServiceRecommendation {
  service_id: string;
  name: string;
  description: string;
  url: string;
}

export interface RelocationTask {
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
  isNewlyGenerated?: boolean; // Animation flag for newly generated tasks
}

export interface TaskCategory {
  name: string;
  tasks: RelocationTask[];
  isExpanded?: boolean;
  isNewlyCreated?: boolean; // Animation flag for newly created categories
}

export interface ChecklistByStageAndCategory {
  predeparture: TaskCategory[];
  departure: TaskCategory[];
  arrival: TaskCategory[];
}

@Injectable({
  providedIn: 'root'
})
export class FilterUtils {
  constructor(private dateUtils: DateUtils) {}

  // Filter tasks by completion status
  filterTasksByStatus(tasks: RelocationTask[], statusFilter: ChecklistFilterData['status']): RelocationTask[] {
    if (statusFilter === 'all') {
      return tasks;
    }
    return tasks.filter(task =>
      (statusFilter === 'completed' && task.completed) ||
      (statusFilter === 'incomplete' && !task.completed)
    );
  }

  // Filter tasks by priority
  filterTasksByPriority(tasks: RelocationTask[], priorityFilter: ChecklistFilterData['priority']): RelocationTask[] {
    if (priorityFilter === 'all') {
      return tasks;
    }
    return tasks.filter(task => task.priority === priorityFilter);
  }

  // Filter tasks by favorites/important status
  filterTasksByFavorites(tasks: RelocationTask[], favoritesFilter: ChecklistFilterData['favorites']): RelocationTask[] {
    if (!favoritesFilter) {
      return tasks;
    }
    return tasks.filter(task => task.isImportant);
  }

  // Filter tasks by search term
  filterTasksBySearchTerm(tasks: RelocationTask[], searchTerm: string, moveDate: string | null): RelocationTask[] {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return tasks;
    }

    // Create the regex only once
    const searchRegex = new RegExp(`\\b${this.escapeRegExp(term)}\\b`, 'i');

    // This is a performance-critical function, optimize by avoiding excessive checking
    return tasks.filter(task => {
      // Check the most common fields first (description, then priority)
      if (task.task_description && searchRegex.test(task.task_description)) {
        return true;
      }
      
      if (task.priority && searchRegex.test(task.priority)) {
        return true;
      }
      
      // Check notes next (if they exist)
      if (task.notes && task.notes.length > 0 && searchRegex.test(task.notes)) {
        return true;
      }
      
      // Check relative due dates
      let relativeDate = this.dateUtils.getRelativeDueDate(task.due_date, moveDate).toLowerCase();
      if (relativeDate.includes(term)) {
        return true;
      }
      
      // Least common case - explanation text
      if (task.importance_explanation && searchRegex.test(task.importance_explanation)) {
        return true;
      }
      
      return false;
    });
  }

  // Apply all filters to a task list
  applyAllFilters(tasks: RelocationTask[], filters: ChecklistFilterData, searchTerm: string, moveDate: string | null): RelocationTask[] {
    let filteredTasks = [...tasks];
    
    filteredTasks = this.filterTasksByStatus(filteredTasks, filters.status);
    filteredTasks = this.filterTasksByPriority(filteredTasks, filters.priority);
    filteredTasks = this.filterTasksByFavorites(filteredTasks, filters.favorites);
    filteredTasks = this.filterTasksBySearchTerm(filteredTasks, searchTerm, moveDate);
    
    return filteredTasks;
  }

  // Helper to escape special characters for regex
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
  }

  // Helper to sort tasks within a category
  sortCategoryTasks(category: TaskCategory, sortBy: 'none' | 'priority' | 'dueDate', moveDate: string | null) {
    if (sortBy === 'none') {
      category.tasks.sort((a, b) => {
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
          const valA = this.dateUtils.parseDueDateRange(a.due_date, moveDate);
          const valB = this.dateUtils.parseDueDateRange(b.due_date, moveDate);
          return valA - valB;
        }
        return orderDiff;
      });
    } else if (sortBy === 'dueDate') {
      category.tasks.sort((a, b) => {
        const valA = this.dateUtils.parseDueDateRange(a.due_date, moveDate);
        const valB = this.dateUtils.parseDueDateRange(b.due_date, moveDate);

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
} 