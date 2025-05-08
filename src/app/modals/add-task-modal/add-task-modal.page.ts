import { Component, OnInit, Input } from '@angular/core';
import { ModalController, IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

interface NewTaskData {
  task_description: string;
  priority: 'High' | 'Medium' | 'Low';
  due_date: string; // ISO string
  stage: 'predeparture' | 'departure' | 'arrival';
  category: string; // Can be existing or new
}

@Component({
  selector: 'app-add-task-modal',
  templateUrl: './add-task-modal.page.html',
  styleUrls: ['./add-task-modal.page.scss'],
  standalone: true,
  imports: [IonicModule, FormsModule, CommonModule]
})
export class AddTaskModalPage implements OnInit {
  @Input() existingCategories: { predeparture: string[], departure: string[], arrival: string[] } = {
    predeparture: [],
    departure: [],
    arrival: []
  };
  
  newTask: NewTaskData = {
    task_description: '',
    priority: 'Medium',
    due_date: new Date().toISOString(),
    stage: 'predeparture',
    category: ''
  };

  selectedStageCategories: string[] = [];
  isNewCategory: boolean = false;
  newCategoryName: string = '';

  constructor(private modalCtrl: ModalController) { }

  ngOnInit() {
    this.updateStageCategories();
    // Set initial category if possible
    if (this.selectedStageCategories.length > 0) {
        this.newTask.category = this.selectedStageCategories[0];
    } else {
        this.newTask.category = 'add_new_category'; // Default to new if no categories for stage
        this.isNewCategory = true;
    }
  }

  updateStageCategories() {
    const stageKey = this.newTask.stage as keyof typeof this.existingCategories;
    this.selectedStageCategories = this.existingCategories[stageKey] || [];
    
    // If current category is not in the new list of categories for the selected stage, reset it or set to new
    if (!this.selectedStageCategories.includes(this.newTask.category) && this.newTask.category !== 'add_new_category') {
        this.newTask.category = this.selectedStageCategories.length > 0 ? this.selectedStageCategories[0] : 'add_new_category';
    }
    this.onCategoryChange(); // To update isNewCategory state
  }

  onStageChange() {
    this.updateStageCategories();
  }
  
  onCategoryChange() {
    this.isNewCategory = this.newTask.category === 'add_new_category';
    if (!this.isNewCategory && this.newTask.category) {
        this.newCategoryName = ''; // Clear new category name if existing is selected
    }
  }

  dismissModal(data: any = null, role: string = 'cancel') {
    this.modalCtrl.dismiss(data, role);
  }

  saveTask() {
    if (!this.newTask.task_description.trim()) {
      // Add some validation feedback, e.g., a toast
      console.error("Task description is required.");
      return;
    }
    const categoryToSave = this.isNewCategory ? this.newCategoryName.trim() : this.newTask.category;
    if (!categoryToSave) {
        console.error("Category is required.");
        return;
    }

    this.dismissModal({ ...this.newTask, category: categoryToSave }, 'confirm');
  }
}