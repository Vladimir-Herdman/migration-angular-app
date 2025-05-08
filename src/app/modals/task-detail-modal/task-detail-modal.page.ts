import { Component, Input, OnInit } from '@angular/core';
import { ModalController, IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
  recommended_services: ServiceRecommendation[];
  isImportant?: boolean;
  task_id?: string;
  notes?: string; // Added notes
}


@Component({
  selector: 'app-task-detail-modal',
  templateUrl: './task-detail-modal.page.html',
  styleUrls: ['./task-detail-modal.page.scss'],
  standalone: true,
  imports: [ IonicModule, CommonModule, FormsModule ]
})
export class TaskDetailModalPage implements OnInit {
  @Input() taskData!: RelocationTask;

  currentIsImportant: boolean = false;
  currentDueDate: string = ''; // For editable due date
  currentNotes: string = '';   // For notes

  constructor(private modalCtrl: ModalController) { }

  ngOnInit() {
    if (this.taskData) {
      this.currentIsImportant = !!this.taskData.isImportant;
      // Attempt to convert to ISOString if it's a parsable date, otherwise keep original.
      // This is a basic check. More robust date parsing might be needed if due_date formats vary wildly.
      try {
        const date = new Date(this.taskData.due_date);
        if (!isNaN(date.getTime())) {
          this.currentDueDate = date.toISOString();
        } else {
          this.currentDueDate = this.taskData.due_date; // Keep as is if not standard date
        }
      } catch (e) {
        this.currentDueDate = this.taskData.due_date; // Fallback
      }
      this.currentNotes = this.taskData.notes || '';
    }
  }

  closeModal(role: string = 'cancel', data: any = null) {
    this.modalCtrl.dismiss(data, role);
  }

  toggleImportance() {
    this.currentIsImportant = !this.currentIsImportant;
  }

  saveAndClose() {
     this.modalCtrl.dismiss({
       isImportant: this.currentIsImportant,
       due_date: this.currentDueDate, // Send back updated due date
       notes: this.currentNotes,      // Send back notes
     }, 'confirm');
  }

  askChatbot() {
    // Pass back the task description for the chatbot
    this.modalCtrl.dismiss({ taskDescription: this.taskData.task_description }, 'askChatbot');
  }
}