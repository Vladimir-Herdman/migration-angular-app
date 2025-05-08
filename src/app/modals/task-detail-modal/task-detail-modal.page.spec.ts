import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TaskDetailModalPage } from './task-detail-modal.page';

describe('TaskDetailModalPage', () => {
  let component: TaskDetailModalPage;
  let fixture: ComponentFixture<TaskDetailModalPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TaskDetailModalPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
