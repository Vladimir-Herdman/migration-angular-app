import { Component, Input, OnInit } from '@angular/core';
import { PopoverController, IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms'; // Import FormsModule
import { CommonModule } from '@angular/common'; // Import CommonModule

export interface ChecklistFilterData {
  status: 'all' | 'incomplete' | 'completed';
  priority: 'all' | 'High' | 'Medium' | 'Low';
  favorites: boolean;
}

@Component({
  selector: 'app-filter-popover',
  templateUrl: './filter-popover.component.html',
  styleUrls: ['./filter-popover.component.scss'],
  standalone: true, // Make it standalone
  imports: [IonicModule, FormsModule, CommonModule], // Import necessary modules
})
export class FilterPopoverComponent implements OnInit {
  @Input() currentFilters!: ChecklistFilterData;
  filters!: ChecklistFilterData;

  constructor(private popoverCtrl: PopoverController) {}

  ngOnInit() {
    // Clone the filters to avoid modifying the original object directly until "Apply"
    this.filters = { ...this.currentFilters };
  }

  onFilterChange() {
    // This method can be used for live updates if desired,
    // but current design applies on "Apply" button click.
  }

  applyFilters() {
    this.popoverCtrl.dismiss(this.filters, 'apply');
  }

  resetFilters() {
    this.filters = {
      status: 'all',
      priority: 'all',
      favorites: false,
    };
    // Optionally, apply immediately on reset or wait for "Apply"
    // this.applyFilters(); 
  }

  dismissPopover() {
    this.popoverCtrl.dismiss(null, 'cancel');
  }
}